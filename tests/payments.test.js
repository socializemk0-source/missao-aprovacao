// api/payments.js (checkout, autenticado) + api/payments/webhook.js
// (webhook, assinatura própria). Banco mockado (fake-db.js) e requireAuth
// mockado (fake-auth.js, convenção "TEST:<uid>") como no resto da suíte.
// O cliente do Mercado Pago é injetado via deps.mpClient — nenhuma
// chamada de rede real acontece aqui.

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.ts', import.meta.url).href;
const requireAuthUrl = new URL('../middleware/requireAuth.js', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });
mock.module(requireAuthUrl, {
  namedExports: { requireAuth: (await import('./fixtures/fake-auth.js')).requireAuth },
});

const { default: paymentsHandler } = await import('../api/payments.js');
const { default: webhookHandler } = await import('../api/payments/webhook.js');

const WEBHOOK_SECRET = 'segredo-webhook-teste';
process.env.MERCADOPAGO_WEBHOOK_SECRET = WEBHOOK_SECRET;

function authHeader(uid) {
  return { authorization: `Bearer TEST:${uid}` };
}

function signedWebhookHeaders({ dataId, ts = String(Math.floor(Date.now() / 1000)), requestId = 'req-1' }) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = crypto.createHmac('sha256', WEBHOOK_SECRET).update(manifest).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId };
}

function fakeMpClient({ paymentsById = {}, preferenceResponse } = {}) {
  const calls = { createPreference: [], getPayment: [] };
  return {
    calls,
    createPreference: async (args) => {
      calls.createPreference.push(args);
      return preferenceResponse || { id: 'pref_123', init_point: 'https://mercadopago.com/checkout/pref_123' };
    },
    getPayment: async (id) => {
      calls.getPayment.push(id);
      return paymentsById[id];
    },
  };
}

beforeEach(() => {
  resetStore(store);
});

// ---------------------------------------------------------------------
// Criação de checkout (api/payments.js) — sempre para o usuário autenticado
// ---------------------------------------------------------------------

test('checkout sem token → 401, não cria preferência', async () => {
  const mp = fakeMpClient();
  const req = makeReq({ body: {} });
  const res = makeRes();
  await paymentsHandler(req, res, { mpClient: mp });
  assert.equal(res.statusCode, 401);
  assert.equal(mp.calls.createPreference.length, 0);
});

test('checkout autenticado usa req.user.uid como external_reference, nunca um uid do body', async () => {
  const mp = fakeMpClient();
  const req = makeReq({
    body: { uid: 'user_B', userId: 'user_B' }, // tentativa de spoof — deve ser ignorada
    headers: authHeader('user_A'),
  });
  const res = makeRes();
  await paymentsHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutUrl, 'https://mercadopago.com/checkout/pref_123');
  assert.equal(mp.calls.createPreference.length, 1);
  assert.equal(mp.calls.createPreference[0].externalReference, 'user_A', 'external_reference deve ser sempre o autenticado, nunca o do body');
});

test('checkout constrói a notification_url apontando para /api/payments/webhook (a rota que a Vercel de fato serve)', async () => {
  const mp = fakeMpClient();
  process.env.APP_BASE_URL = 'https://missao-aprovacao-seven.vercel.app';
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { mpClient: mp });
  delete process.env.APP_BASE_URL;

  assert.equal(
    mp.calls.createPreference[0].notificationUrl,
    'https://missao-aprovacao-seven.vercel.app/api/payments/webhook'
  );
});

// ---------------------------------------------------------------------
// Webhook (api/payments/webhook.js) — assinatura obrigatória, sem auth de sessão
// ---------------------------------------------------------------------

test('[segurança] webhook sem assinatura válida → 401, plano NÃO é alterado', async () => {
  const mp = fakeMpClient({ paymentsById: { pay_1: { id: 'pay_1', status: 'approved', external_reference: 'user_A', transaction_amount: 29.9, currency_id: 'BRL' } } });
  const req = makeReq({
    method: 'POST',
    query: { type: 'payment', 'data.id': 'pay_1' },
    body: { type: 'payment', data: { id: 'pay_1' } },
    headers: { 'x-signature': 'ts=123,v1=assinatura-forjada', 'x-request-id': 'req-1' },
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 401);
  assert.equal(mp.calls.getPayment.length, 0, 'nunca deve nem consultar o pagamento sem assinatura válida');
  assert.notEqual(store.users.user_A.plan, 'pro');
});

test('webhook com assinatura válida e pagamento aprovado → usuário promovido a PRO', async () => {
  const mp = fakeMpClient({
    paymentsById: {
      pay_42: { id: 'pay_42', status: 'approved', status_detail: 'accredited', external_reference: 'user_A', transaction_amount: 29.9, currency_id: 'BRL' },
    },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'payment', 'data.id': 'pay_42' },
    body: { type: 'payment', data: { id: 'pay_42' } },
    headers: signedWebhookHeaders({ dataId: 'pay_42' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'pro', 'pagamento aprovado e assinado deve liberar o PRO');
  assert.equal(store.payments.length, 1);
});

test('webhook com pagamento PENDENTE → é registrado, mas plano NÃO muda para pro', async () => {
  const mp = fakeMpClient({
    paymentsById: { pay_7: { id: 'pay_7', status: 'pending', status_detail: 'pending_waiting_payment', external_reference: 'user_A', transaction_amount: 29.9, currency_id: 'BRL' } },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'payment', 'data.id': 'pay_7' },
    body: { type: 'payment', data: { id: 'pay_7' } },
    headers: signedWebhookHeaders({ dataId: 'pay_7' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.notEqual(store.users.user_A.plan, 'pro');
  assert.equal(store.payments[0].status, 'pending');
});

test('[idempotência] a mesma notificação reenviada duas vezes só processa uma vez', async () => {
  const mp = fakeMpClient({
    paymentsById: { pay_99: { id: 'pay_99', status: 'approved', external_reference: 'user_A', transaction_amount: 29.9, currency_id: 'BRL' } },
  });

  for (let i = 0; i < 2; i++) {
    const req = makeReq({
      method: 'POST',
      query: { type: 'payment', 'data.id': 'pay_99' },
      body: { type: 'payment', data: { id: 'pay_99' } },
      headers: signedWebhookHeaders({ dataId: 'pay_99' }),
    });
    const res = makeRes();
    await webhookHandler(req, res, { mpClient: mp });
    assert.equal(res.statusCode, 200);
  }

  assert.equal(store.payments.length, 1, 'não deve gravar o mesmo pagamento duas vezes');
  assert.equal(mp.calls.getPayment.length, 2, 'consulta a API do MP nas duas vezes (correto), mas só grava/aplica uma');
});

test('webhook de outro tópico (não "payment") é apenas confirmado, sem processar nada', async () => {
  const mp = fakeMpClient();
  const req = makeReq({
    method: 'POST',
    query: { type: 'merchant_order', 'data.id': 'mo_1' },
    body: { type: 'merchant_order', data: { id: 'mo_1' } },
    headers: signedWebhookHeaders({ dataId: 'mo_1' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(mp.calls.getPayment.length, 0);
});
