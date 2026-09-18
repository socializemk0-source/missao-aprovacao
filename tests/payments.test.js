// api/payments.js (checkout de assinatura, autenticado) + api/payments/webhook.js
// (webhook, assinatura própria) + api/auth.js (downgrade cancela a
// assinatura real). Banco mockado (fake-db.js) e requireAuth mockado
// (fake-auth.js, convenção "TEST:<uid>") como no resto da suíte.
// O cliente do Mercado Pago é injetado via deps.mpClient — nenhuma
// chamada de rede real acontece aqui.
//
// O Plano PRO é uma ASSINATURA RECORRENTE (R$ 29,90/mês, Mercado Pago
// Preapproval), não um pagamento único.

import { test, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createStore, resetStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.js', import.meta.url).href;
const requireAuthUrl = new URL('../middleware/requireAuth.js', import.meta.url).href;

const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });
mock.module(requireAuthUrl, {
  namedExports: { requireAuth: (await import('./fixtures/fake-auth.js')).requireAuth },
});

const { default: paymentsHandler } = await import('../api/payments.js');
const { default: webhookHandler } = await import('../api/payments/webhook.js');
const { default: authHandler } = await import('../api/auth.js');

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

function fakeMpClient({ subscriptionsById = {}, authorizedPaymentsById = {}, subscriptionResponse } = {}) {
  const calls = { createSubscription: [], getSubscription: [], cancelSubscription: [], getAuthorizedPayment: [] };
  return {
    calls,
    createSubscription: async (args) => {
      calls.createSubscription.push(args);
      return subscriptionResponse || { id: 'sub_123', init_point: 'https://mercadopago.com/subscriptions/sub_123', status: 'pending' };
    },
    getSubscription: async (id) => {
      calls.getSubscription.push(id);
      return subscriptionsById[id];
    },
    cancelSubscription: async (id) => {
      calls.cancelSubscription.push(id);
      return { id, status: 'cancelled' };
    },
    getAuthorizedPayment: async (id) => {
      calls.getAuthorizedPayment.push(id);
      return authorizedPaymentsById[id];
    },
  };
}

beforeEach(() => {
  resetStore(store);
});

// ---------------------------------------------------------------------
// Criação de checkout de assinatura (api/payments.js) — sempre para o
// usuário autenticado
// ---------------------------------------------------------------------

test('checkout sem token → 401, não cria assinatura', async () => {
  const mp = fakeMpClient();
  const req = makeReq({ body: {} });
  const res = makeRes();
  await paymentsHandler(req, res, { mpClient: mp });
  assert.equal(res.statusCode, 401);
  assert.equal(mp.calls.createSubscription.length, 0);
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
  assert.equal(res.body.checkoutUrl, 'https://mercadopago.com/subscriptions/sub_123');
  assert.equal(mp.calls.createSubscription.length, 1);
  assert.equal(mp.calls.createSubscription[0].externalReference, 'user_A', 'external_reference deve ser sempre o autenticado, nunca o do body');
  assert.equal(store.subscriptions.user_A.mpPreapprovalId, 'sub_123', 'salva o estado local (pending) já na criação');
});

test('checkout envia payer_email do usuário autenticado — o Mercado Pago rejeita a criação da assinatura sem ele', async () => {
  const mp = fakeMpClient();
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(mp.calls.createSubscription[0].payerEmail, 'user_A@test.local');
});

test('checkout constrói a notification_url apontando para /api/payments/webhook (a rota que a Vercel de fato serve)', async () => {
  const mp = fakeMpClient();
  process.env.APP_BASE_URL = 'https://missao-aprovacao-lemon.vercel.app';
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { mpClient: mp });
  delete process.env.APP_BASE_URL;

  assert.equal(
    mp.calls.createSubscription[0].notificationUrl,
    'https://missao-aprovacao-lemon.vercel.app/api/payments/webhook'
  );
});

// ---------------------------------------------------------------------
// Webhook (api/payments/webhook.js) — assinatura obrigatória, sem auth de sessão
// ---------------------------------------------------------------------

test('[segurança] webhook sem assinatura válida → 401, plano NÃO é alterado', async () => {
  const mp = fakeMpClient({
    subscriptionsById: { sub_1: { id: 'sub_1', status: 'authorized', external_reference: 'user_A', auto_recurring: { transaction_amount: 29.9, currency_id: 'BRL' } } },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'subscription_preapproval', 'data.id': 'sub_1' },
    body: { type: 'subscription_preapproval', data: { id: 'sub_1' } },
    headers: { 'x-signature': 'ts=123,v1=assinatura-forjada', 'x-request-id': 'req-1' },
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 401);
  assert.equal(mp.calls.getSubscription.length, 0, 'nunca deve nem consultar a assinatura sem assinatura válida');
  assert.notEqual(store.users.user_A.plan, 'pro');
});

test('webhook subscription_preapproval com status "authorized" → usuário promovido a PRO', async () => {
  const mp = fakeMpClient({
    subscriptionsById: {
      sub_42: { id: 'sub_42', status: 'authorized', external_reference: 'user_A', auto_recurring: { transaction_amount: 29.9, currency_id: 'BRL' } },
    },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'subscription_preapproval', 'data.id': 'sub_42' },
    body: { type: 'subscription_preapproval', data: { id: 'sub_42' } },
    headers: signedWebhookHeaders({ dataId: 'sub_42' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'pro', 'assinatura autorizada deve liberar o PRO');
  assert.equal(store.subscriptions.user_A.status, 'authorized');
});

test('webhook subscription_preapproval com status "pending" → é registrado, mas plano NÃO muda para pro', async () => {
  const mp = fakeMpClient({
    subscriptionsById: { sub_7: { id: 'sub_7', status: 'pending', external_reference: 'user_A', auto_recurring: { transaction_amount: 29.9, currency_id: 'BRL' } } },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'subscription_preapproval', 'data.id': 'sub_7' },
    body: { type: 'subscription_preapproval', data: { id: 'sub_7' } },
    headers: signedWebhookHeaders({ dataId: 'sub_7' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.notEqual(store.users.user_A.plan, 'pro');
  assert.equal(store.subscriptions.user_A.status, 'pending');
});

test('webhook subscription_preapproval com status "cancelled" → usuário revertido para o modo gratuito', async () => {
  store.users.user_A.plan = 'pro';
  store.subscriptions.user_A = { userId: 'user_A', mpPreapprovalId: 'sub_9', status: 'authorized' };
  const mp = fakeMpClient({
    subscriptionsById: { sub_9: { id: 'sub_9', status: 'cancelled', external_reference: 'user_A', auto_recurring: { transaction_amount: 29.9, currency_id: 'BRL' } } },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'subscription_preapproval', 'data.id': 'sub_9' },
    body: { type: 'subscription_preapproval', data: { id: 'sub_9' } },
    headers: signedWebhookHeaders({ dataId: 'sub_9' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'free', 'cancelamento direto no Mercado Pago também precisa rebaixar o usuário');
  assert.equal(store.subscriptions.user_A.status, 'cancelled');
});

test('webhook subscription_authorized_payment → grava histórico da cobrança recorrente', async () => {
  store.subscriptions.user_A = { userId: 'user_A', mpPreapprovalId: 'sub_42', status: 'authorized' };
  const mp = fakeMpClient({
    authorizedPaymentsById: {
      auth_pay_1: { id: 'auth_pay_1', preapproval_id: 'sub_42', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL' },
    },
  });
  const req = makeReq({
    method: 'POST',
    query: { type: 'subscription_authorized_payment', 'data.id': 'auth_pay_1' },
    body: { type: 'subscription_authorized_payment', data: { id: 'auth_pay_1' } },
    headers: signedWebhookHeaders({ dataId: 'auth_pay_1' }),
  });
  const res = makeRes();
  await webhookHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(store.subscriptionPayments.length, 1);
  assert.equal(store.subscriptionPayments[0].userId, 'user_A');
});

test('[idempotência] a mesma cobrança recorrente reenviada duas vezes só processa uma vez', async () => {
  store.subscriptions.user_A = { userId: 'user_A', mpPreapprovalId: 'sub_99', status: 'authorized' };
  const mp = fakeMpClient({
    authorizedPaymentsById: {
      auth_pay_99: { id: 'auth_pay_99', preapproval_id: 'sub_99', status: 'approved', transaction_amount: 29.9, currency_id: 'BRL' },
    },
  });

  for (let i = 0; i < 2; i++) {
    const req = makeReq({
      method: 'POST',
      query: { type: 'subscription_authorized_payment', 'data.id': 'auth_pay_99' },
      body: { type: 'subscription_authorized_payment', data: { id: 'auth_pay_99' } },
      headers: signedWebhookHeaders({ dataId: 'auth_pay_99' }),
    });
    const res = makeRes();
    await webhookHandler(req, res, { mpClient: mp });
    assert.equal(res.statusCode, 200);
  }

  assert.equal(store.subscriptionPayments.length, 1, 'não deve gravar a mesma cobrança duas vezes');
  assert.equal(mp.calls.getAuthorizedPayment.length, 2, 'consulta a API do MP nas duas vezes (correto), mas só grava uma');
});

test('webhook de outro tópico (ex: merchant_order) é apenas confirmado, sem processar nada', async () => {
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
  assert.equal(mp.calls.getSubscription.length, 0);
  assert.equal(mp.calls.getAuthorizedPayment.length, 0);
});

// ---------------------------------------------------------------------
// Downgrade autosserviço (api/auth.js) precisa cancelar a assinatura de
// verdade — senão o usuário continua sendo cobrado todo mês.
// ---------------------------------------------------------------------

test('downgrade-to-free com assinatura ativa cancela de verdade no Mercado Pago', async () => {
  store.subscriptions.user_A = { userId: 'user_A', mpPreapprovalId: 'sub_1', status: 'authorized' };
  const mp = fakeMpClient();
  const req = makeReq({ body: { action: 'downgrade-to-free' }, headers: authHeader('user_A') });
  const res = makeRes();
  await authHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(mp.calls.cancelSubscription, ['sub_1']);
  assert.equal(store.subscriptions.user_A.status, 'cancelled');
  assert.equal(store.users.user_A.plan, 'free');
});

test('downgrade-to-free sem assinatura ativa não tenta chamar o Mercado Pago', async () => {
  const mp = fakeMpClient();
  const req = makeReq({ body: { action: 'downgrade-to-free' }, headers: authHeader('user_A') });
  const res = makeRes();
  await authHandler(req, res, { mpClient: mp });

  assert.equal(res.statusCode, 200);
  assert.equal(mp.calls.cancelSubscription.length, 0);
  assert.equal(store.users.user_A.plan, 'free');
});
