// Pagamentos pelo Mercado Pago: api/payments.js (checkout), api/payments/webhook.js
// (notificações), api/payments/confirm.js (volta do checkout) e o downgrade
// em api/auth.js. Banco mockado (fake-db.js) e requireAuth mockado
// (fake-auth.js, convenção "TEST:<uid>"). O cliente do Mercado Pago é
// injetado via deps.mercadoPagoClient — nenhuma chamada de rede real.
//
// Os testes marcados [revisão #N] cobrem as falhas da revisão de 25/09/2026.

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
const { default: confirmHandler } = await import('../api/payments/confirm.js');
const { default: authHandler } = await import('../api/auth.js');
const { MercadoPagoError } = await import('../src/payments/mercadopago.js');

const WEBHOOK_SECRET = 'segredo-webhook-teste';
const DAY = 24 * 60 * 60 * 1000;

function authHeader(uid) {
  return { authorization: `Bearer TEST:${uid}` };
}

// Cliente falso: devolve os recursos cadastrados em `resources`, como a API
// real devolveria ao ser consultada com o nosso token.
function fakeMercadoPago(resources = {}) {
  const calls = { createPreference: [], createPreapproval: [], cancelPreapproval: [], getPayment: [], getPreapproval: [], getAuthorizedPayment: [] };
  const lookup = (kind, id) => {
    const found = resources[kind]?.[id];
    if (found instanceof Error) throw found;
    if (!found) throw new MercadoPagoError(`HTTP 404 ${kind} ${id}`, 404);
    return found;
  };
  return {
    calls,
    createPreference: async (args) => {
      calls.createPreference.push(args);
      return { id: 'pref_1', init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref_1' };
    },
    createPreapproval: async (args) => {
      calls.createPreapproval.push(args);
      return { id: `preap_new_${calls.createPreapproval.length}`, status: 'pending', init_point: 'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=preap_new' };
    },
    cancelPreapproval: async (id) => {
      calls.cancelPreapproval.push(id);
      if (resources.cancelError) throw resources.cancelError;
      return { id, status: 'cancelled', next_payment_date: resources.preapproval?.[id]?.next_payment_date };
    },
    getPayment: async (id) => { calls.getPayment.push(id); return lookup('payment', id); },
    getPreapproval: async (id) => { calls.getPreapproval.push(id); return lookup('preapproval', id); },
    getAuthorizedPayment: async (id) => { calls.getAuthorizedPayment.push(id); return lookup('authorized_payment', id); },
  };
}

function signedWebhook({ type, id, secret = WEBHOOK_SECRET, requestId = 'req-1' }) {
  const ts = '1727200000';
  const v1 = crypto.createHmac('sha256', secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  return makeReq({
    method: 'POST',
    query: { 'data.id': id, type },
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId, 'content-type': 'application/json' },
    body: { action: `${type}.updated`, type, data: { id } },
  });
}

async function webhook(client, args) {
  const res = makeRes();
  await webhookHandler(signedWebhook(args), res, { mercadoPagoClient: client });
  return res;
}

async function checkout(uid, body = {}, client = fakeMercadoPago()) {
  const req = makeReq({ method: 'POST', body, headers: { ...authHeader(uid), host: 'app.test' } });
  const res = makeRes();
  await paymentsHandler(req, res, { mercadoPagoClient: client });
  return { res, body: (res.body || {}), client };
}

async function confirm(uid, body, client) {
  const req = makeReq({ method: 'POST', body, headers: authHeader(uid) });
  const res = makeRes();
  await confirmHandler(req, res, { mercadoPagoClient: client });
  return { res, body: (res.body || {}) };
}

async function downgrade(uid, client = fakeMercadoPago()) {
  const req = makeReq({ method: 'POST', body: { action: 'downgrade-to-free' }, headers: authHeader(uid) });
  const res = makeRes();
  await authHandler(req, res, { mercadoPagoClient: client });
  return { res, body: (res.body || {}), client };
}

function withSubscriptionMode(fn) {
  return async () => {
    process.env.MERCADOPAGO_BILLING_MODE = 'subscription';
    try { await fn(); } finally { delete process.env.MERCADOPAGO_BILLING_MODE; }
  };
}

const approvedPass = (id, uid = 'user_A', cycle = 'monthly', extra = {}) => ({
  id, status: 'approved', currency_id: 'BRL', transaction_amount: cycle === 'annual' ? 239.9 : 29.9,
  external_reference: `pass:${cycle}:${uid}`, ...extra,
});

const preapproval = (id, status, uid = 'user_A', extra = {}) => ({
  id, status, external_reference: `sub:monthly:${uid}`,
  auto_recurring: { frequency: 1, frequency_type: 'months', transaction_amount: 29.9, currency_id: 'BRL' },
  next_payment_date: new Date(Date.now() + 20 * DAY).toISOString(), ...extra,
});

beforeEach(() => {
  resetStore(store);
  process.env.MERCADOPAGO_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.MERCADOPAGO_BILLING_MODE;
  delete process.env.MERCADOPAGO_ACCESS_TOKEN;
  delete process.env.APP_BASE_URL;
});

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

test('checkout sem token → 401, nada é criado no Mercado Pago', async () => {
  const client = fakeMercadoPago();
  const res = makeRes();
  await paymentsHandler(makeReq({ method: 'POST', body: {} }), res, { mercadoPagoClient: client });
  assert.equal(res.statusCode, 401);
  assert.equal(client.calls.createPreference.length, 0);
});

test('checkout via GET → 405 (na Vercel a rota responde a qualquer método)', async () => {
  const client = fakeMercadoPago();
  const res = makeRes();
  await paymentsHandler(makeReq({ method: 'GET', headers: authHeader('user_A') }), res, { mercadoPagoClient: client });
  assert.equal(res.statusCode, 405);
  assert.equal(client.calls.createPreference.length + client.calls.createPreapproval.length, 0);
});

test('passe (padrão): cria um Checkout Pro de R$ 29,90 ligado ao usuário logado, nunca a um uid do body', async () => {
  const { res, body, client } = await checkout('user_A', { cycle: 'monthly', uid: 'user_B', userId: 'user_B' });
  assert.equal(res.statusCode, 200);
  assert.match(body.checkoutUrl, /mercadopago\.com\.br/);
  const [args] = client.calls.createPreference;
  assert.equal(args.amount, 29.9);
  assert.equal(args.externalReference, 'pass:monthly:user_A');
  assert.equal(args.payerEmail, 'user_A@test.local');
  assert.equal(args.backUrl, 'https://app.test/?payment=return');
  assert.equal(args.notificationUrl, 'https://app.test/api/payments/webhook?source_news=webhooks');
  assert.equal(client.calls.createPreapproval.length, 0, 'modo passe não cria assinatura');
});

test('passe anual: R$ 239,90 e referência do ciclo anual', async () => {
  const { client } = await checkout('user_A', { cycle: 'annual' });
  assert.equal(client.calls.createPreference[0].amount, 239.9);
  assert.equal(client.calls.createPreference[0].externalReference, 'pass:annual:user_A');
});

test('ciclo desconhecido → 400, sem chamar o Mercado Pago', async () => {
  const { res, client } = await checkout('user_A', { cycle: 'vitalicio' });
  assert.equal(res.statusCode, 400);
  assert.equal(client.calls.createPreference.length, 0);
});

test('sem MERCADOPAGO_ACCESS_TOKEN → 503 (sem cliente injetado)', async () => {
  const res = makeRes();
  await paymentsHandler(makeReq({ method: 'POST', body: {}, headers: authHeader('user_A') }), res);
  assert.equal(res.statusCode, 503);
});

test('passe: quem já tem passe ativo pode comprar mais tempo', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: new Date(Date.now() + 5 * DAY) });
  store.subscriptions.user_A = { userId: 'user_A', status: 'pass_active' };
  const { res } = await checkout('user_A');
  assert.equal(res.statusCode, 200);
});

test('[revisão #3] assinatura ativa OU em falha de cobrança bloqueia um checkout novo (seriam duas cobranças)', async () => {
  for (const status of ['active', 'payment_failed']) {
    store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status };
    const { res, client } = await checkout('user_A');
    assert.equal(res.statusCode, 409, `status ${status}`);
    assert.equal(client.calls.createPreference.length, 0);
  }
});

test('assinatura: cria preapproval mensal/anual no cartão e grava como pending', withSubscriptionMode(async () => {
  const monthly = await checkout('user_A', { cycle: 'monthly' });
  assert.equal(monthly.res.statusCode, 200);
  assert.deepEqual(
    { amount: monthly.client.calls.createPreapproval[0].amount, months: monthly.client.calls.createPreapproval[0].frequencyMonths },
    { amount: 29.9, months: 1 },
  );
  assert.equal(monthly.client.calls.createPreapproval[0].externalReference, 'sub:monthly:user_A');
  assert.equal(store.subscriptions.user_A.status, 'pending');
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'preap_new_1');

  const annual = await checkout('user_B', { cycle: 'annual' });
  assert.equal(annual.client.calls.createPreapproval[0].frequencyMonths, 12);
  assert.equal(annual.client.calls.createPreapproval[0].amount, 239.9);
}));

test('[revisão #2] assinatura: um link pendente anterior é cancelado antes de gerar outro', withSubscriptionMode(async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_old', status: 'pending' };
  const { res, client } = await checkout('user_A');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.calls.cancelPreapproval, ['preap_old']);
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'preap_new_1');
}));

// ---------------------------------------------------------------------------
// Webhook — autenticidade
// ---------------------------------------------------------------------------

test('[segurança] webhook sem MERCADOPAGO_WEBHOOK_SECRET configurado → 401 (fail-closed)', async () => {
  delete process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const client = fakeMercadoPago({ payment: { 1: approvedPass('1') } });
  const res = await webhook(client, { type: 'payment', id: '1' });
  assert.equal(res.statusCode, 401);
  assert.equal(client.calls.getPayment.length, 0);
});

test('[segurança] webhook com x-signature inválida → 401, nem consulta a API, plano não muda', async () => {
  const client = fakeMercadoPago({ payment: { 1: approvedPass('1') } });
  const res = await webhook(client, { type: 'payment', id: '1', secret: 'segredo-errado' });
  assert.equal(res.statusCode, 401);
  assert.equal(client.calls.getPayment.length, 0);
  assert.equal(store.users.user_A.plan, 'free');
});

test('notificação no formato antigo (IPN ?topic=) é só confirmada, sem processar', async () => {
  const client = fakeMercadoPago();
  const res = makeRes();
  await webhookHandler(makeReq({ method: 'POST', query: { topic: 'payment', id: '1' }, body: {} }), res, { mercadoPagoClient: client });
  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.getPayment.length, 0);
});

// ---------------------------------------------------------------------------
// Webhook — passe (pagamento único)
// ---------------------------------------------------------------------------

test('passe: pagamento aprovado dá 30 dias de PRO; reenviado, não dá em dobro', async () => {
  const client = fakeMercadoPago({ payment: { 111: approvedPass(111) } });
  assert.equal((await webhook(client, { type: 'payment', id: '111' })).statusCode, 200);
  const until = new Date(store.users.user_A.proUntil).getTime();
  assert.equal(store.users.user_A.plan, 'pro');
  assert.ok(Math.abs(until - (Date.now() + 30 * DAY)) < 5000);
  assert.equal(store.subscriptions.user_A.status, 'pass_active');

  await webhook(client, { type: 'payment', id: '111' });
  assert.equal(new Date(store.users.user_A.proUntil).getTime(), until);
});

test('passe anual aprovado dá 365 dias', async () => {
  const client = fakeMercadoPago({ payment: { 5: approvedPass(5, 'user_A', 'annual') } });
  await webhook(client, { type: 'payment', id: '5' });
  assert.ok(Math.abs(new Date(store.users.user_A.proUntil).getTime() - (Date.now() + 365 * DAY)) < 5000);
});

test('passe: PIX ainda pendente não libera PRO', async () => {
  const client = fakeMercadoPago({ payment: { 7: approvedPass(7, 'user_A', 'monthly', { status: 'pending' }) } });
  await webhook(client, { type: 'payment', id: '7' });
  assert.equal(store.users.user_A.plan, 'free');
});

test('passe: valor abaixo do preço ou moeda errada não libera PRO', async () => {
  const client = fakeMercadoPago({ payment: {
    8: approvedPass(8, 'user_A', 'annual', { transaction_amount: 29.9 }),
    9: approvedPass(9, 'user_A', 'monthly', { currency_id: 'USD' }),
  } });
  await webhook(client, { type: 'payment', id: '8' });
  await webhook(client, { type: 'payment', id: '9' });
  assert.equal(store.users.user_A.plan, 'free');
});

test('passe: estorno tira os dias daquele pagamento e volta para o grátis se acabar', async () => {
  const resources = { payment: { 10: approvedPass(10) } };
  const client = fakeMercadoPago(resources);
  await webhook(client, { type: 'payment', id: '10' });
  resources.payment[10] = approvedPass(10, 'user_A', 'monthly', { status: 'refunded' });
  await webhook(client, { type: 'payment', id: '10' });
  assert.equal(store.users.user_A.plan, 'free');
});

test('pagamento que não é de passe (ex.: cobrança de assinatura) não é tratado como passe', async () => {
  const client = fakeMercadoPago({ payment: { 12: approvedPass(12, 'user_A', 'monthly', { external_reference: 'sub:monthly:user_A' }) } });
  await webhook(client, { type: 'payment', id: '12' });
  assert.equal(store.users.user_A.plan, 'free');
});

test('recurso inexistente no Mercado Pago (ex.: "simular" do painel) → 200 ignorado; erro da API → 500 para reenviar', async () => {
  const client = fakeMercadoPago({ payment: { 99: new MercadoPagoError('HTTP 500', 500) } });
  assert.equal((await webhook(client, { type: 'payment', id: '123456' })).statusCode, 200);
  assert.equal((await webhook(client, { type: 'payment', id: '99' })).statusCode, 500);
});

// ---------------------------------------------------------------------------
// Webhook — assinatura
// ---------------------------------------------------------------------------

test('[revisão #7] assinatura autorizada → PRO sem data de fim, mesmo com um passe antigo vencido', async () => {
  Object.assign(store.users.user_A, { plan: 'free', proUntil: new Date(Date.now() - DAY) });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'pending' };
  const client = fakeMercadoPago({ preapproval: { preap_1: preapproval('preap_1', 'authorized') } });
  await webhook(client, { type: 'subscription_preapproval', id: 'preap_1' });
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(store.users.user_A.proUntil, null);
  assert.equal(store.users.user_A.planPrice, 'R$ 29,90/mês');
  assert.equal(store.subscriptions.user_A.status, 'active');
});

test('assinatura anual autorizada grava o rótulo anual', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'pending' };
  const client = fakeMercadoPago({ preapproval: { preap_1: preapproval('preap_1', 'authorized', 'user_A', {
    external_reference: 'sub:annual:user_A', auto_recurring: { frequency: 12, transaction_amount: 239.9 },
  }) } });
  await webhook(client, { type: 'subscription_preapproval', id: 'preap_1' });
  assert.equal(store.users.user_A.planPrice, 'R$ 239,90/ano');
});

test('[revisão #1] cancelamento de uma assinatura ANTIGA não derruba a atual', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_atual', status: 'active' };
  const client = fakeMercadoPago({ preapproval: { preap_velha: preapproval('preap_velha', 'cancelled') } });
  await webhook(client, { type: 'subscription_preapproval', id: 'preap_velha' });
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(store.subscriptions.user_A.status, 'active');
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'preap_atual');
});

test('[revisão #2] segunda assinatura autorizada com outra viva é cancelada no Mercado Pago', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'active' };
  const client = fakeMercadoPago({ preapproval: { preap_2: preapproval('preap_2', 'authorized') } });
  const res = await webhook(client, { type: 'subscription_preapproval', id: 'preap_2' });
  assert.equal(res.body.result, 'duplicate_cancelled');
  assert.deepEqual(client.calls.cancelPreapproval, ['preap_2']);
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'preap_1');
});

test('[revisão #5] assinatura ativa cancelada mantém o PRO até a próxima cobrança que não vai acontecer', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'active' };
  const next = new Date(Date.now() + 12 * DAY).toISOString();
  const client = fakeMercadoPago({ preapproval: { preap_1: preapproval('preap_1', 'cancelled', 'user_A', { next_payment_date: next }) } });
  await webhook(client, { type: 'subscription_preapproval', id: 'preap_1' });
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(new Date(store.users.user_A.proUntil).toISOString(), next);
  assert.equal(store.subscriptions.user_A.status, 'cancelled');
});

test('assinatura cancelada depois de falhas de cobrança volta para o grátis na hora', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'payment_failed' };
  const client = fakeMercadoPago({ preapproval: { preap_1: preapproval('preap_1', 'cancelled') } });
  await webhook(client, { type: 'subscription_preapproval', id: 'preap_1' });
  assert.equal(store.users.user_A.plan, 'free');
});

test('cobrança recorrente aprovada é registrada uma vez só; recusada marca payment_failed sem tirar o PRO', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'active' };
  const resources = {
    preapproval: { preap_1: preapproval('preap_1', 'authorized') },
    authorized_payment: {
      ap_1: { id: 'ap_1', preapproval_id: 'preap_1', status: 'processed', transaction_amount: 29.9, currency_id: 'BRL', payment: { id: 555, status: 'approved' } },
      ap_2: { id: 'ap_2', preapproval_id: 'preap_1', status: 'recycling', retry_attempt: 1, payment: { id: 556, status: 'rejected' } },
    },
  };
  const client = fakeMercadoPago(resources);
  await webhook(client, { type: 'subscription_authorized_payment', id: 'ap_1' });
  await webhook(client, { type: 'subscription_authorized_payment', id: 'ap_1' });
  assert.equal(store.subscriptionPayments.filter((p) => p.providerPaymentId === '555').length, 1);

  await webhook(client, { type: 'subscription_authorized_payment', id: 'ap_2' });
  assert.equal(store.subscriptions.user_A.status, 'payment_failed');
  assert.equal(store.users.user_A.plan, 'pro');

  // A nova tentativa passa: volta a ativa.
  resources.authorized_payment.ap_2.payment.status = 'approved';
  await webhook(client, { type: 'subscription_authorized_payment', id: 'ap_2' });
  assert.equal(store.subscriptions.user_A.status, 'active');
});

test('cobrança de uma assinatura que não é a atual de ninguém é ignorada', async () => {
  const client = fakeMercadoPago({ authorized_payment: { ap_9: { id: 'ap_9', preapproval_id: 'preap_x', payment: { id: 9, status: 'rejected' } } } });
  const res = await webhook(client, { type: 'subscription_authorized_payment', id: 'ap_9' });
  assert.equal(res.body.result, 'ignored');
});

// ---------------------------------------------------------------------------
// Confirmação na volta do checkout
// ---------------------------------------------------------------------------

test('[revisão #8] voltar do checkout confirma o pagamento sem depender do webhook', async () => {
  const client = fakeMercadoPago({ payment: { 321: approvedPass(321) } });
  const { res, body } = await confirm('user_A', { paymentId: '321' }, client);
  assert.equal(res.statusCode, 200);
  assert.equal(body.plan, 'pro');
  assert.equal(store.users.user_A.plan, 'pro');
});

test('[segurança] confirmar o pagamento de OUTRA pessoa → 404, nada é liberado', async () => {
  const client = fakeMercadoPago({ payment: { 321: approvedPass(321, 'user_B') } });
  const { res } = await confirm('user_A', { paymentId: '321' }, client);
  assert.equal(res.statusCode, 404);
  assert.equal(store.users.user_A.plan, 'free');
  assert.equal(store.users.user_B.plan, 'free');
});

test('confirmar assinatura autorizada do próprio usuário ativa o PRO; id inválido → 400; sem login → 401', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'pending' };
  const client = fakeMercadoPago({ preapproval: { preap_1: preapproval('preap_1', 'authorized') } });
  assert.equal((await confirm('user_A', { preapprovalId: 'preap_1' }, client)).body.plan, 'pro');
  assert.equal((await confirm('user_A', { paymentId: '../x' }, client)).res.statusCode, 400);

  const res = makeRes();
  await confirmHandler(makeReq({ method: 'POST', body: { paymentId: '1' } }), res, { mercadoPagoClient: client });
  assert.equal(res.statusCode, 401);
});

// ---------------------------------------------------------------------------
// Cancelar / voltar para o grátis
// ---------------------------------------------------------------------------

test('[revisão #5] cancelar assinatura ativa cancela no Mercado Pago e mantém o PRO até a próxima cobrança', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'active' };
  const next = new Date(Date.now() + 9 * DAY).toISOString();
  const client = fakeMercadoPago({ preapproval: { preap_1: preapproval('preap_1', 'authorized', 'user_A', { next_payment_date: next }) } });
  const { res, body } = await downgrade('user_A', client);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.calls.cancelPreapproval, ['preap_1']);
  assert.equal(body.plan, 'pro');
  assert.equal(body.proUntil, next);
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(store.subscriptions.user_A.status, 'cancelled');
});

test('[revisão #4] cancelar com cobrança em falha ou link pendente também cancela no Mercado Pago', async () => {
  for (const status of ['payment_failed', 'pending']) {
    Object.assign(store.users.user_A, { plan: status === 'pending' ? 'free' : 'pro', proUntil: null });
    store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: `preap_${status}`, status };
    const { res, client } = await downgrade('user_A');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(client.calls.cancelPreapproval, [`preap_${status}`], status);
    assert.equal(store.users.user_A.plan, 'free');
  }
});

test('falha ao cancelar assinatura ativa no Mercado Pago → 502 e nada muda', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: null });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_1', status: 'active' };
  const client = fakeMercadoPago({ cancelError: new MercadoPagoError('HTTP 500', 500) });
  const { res } = await downgrade('user_A', client);
  assert.equal(res.statusCode, 502);
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(store.subscriptions.user_A.status, 'active');
});

test('passe ativo: "voltar para o grátis" não joga fora o tempo pago (409) e não chama o Mercado Pago', async () => {
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: new Date(Date.now() + 10 * DAY) });
  store.subscriptions.user_A = { userId: 'user_A', status: 'pass_active' };
  const { res, client } = await downgrade('user_A');
  assert.equal(res.statusCode, 409);
  assert.equal(client.calls.cancelPreapproval.length, 0);
  assert.equal(store.users.user_A.plan, 'pro');
});

test('sem assinatura nenhuma: vira grátis sem chamar o Mercado Pago', async () => {
  const { res, client } = await downgrade('user_A');
  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.cancelPreapproval.length, 0);
  assert.equal(store.users.user_A.plan, 'free');
});

test('pedir plano "pro" pelo downgrade é recusado (403) — PRO só com pagamento confirmado', async () => {
  const req = makeReq({ method: 'POST', body: { action: 'upgrade-plan', plan: 'pro' }, headers: authHeader('user_A') });
  const res = makeRes();
  await authHandler(req, res, { mercadoPagoClient: fakeMercadoPago() });
  assert.equal(res.statusCode, 403);
  assert.equal(store.users.user_A.plan, 'free');
});

test('cancelar um link pendente não joga fora o tempo de um passe que ainda vale', async () => {
  const until = new Date(Date.now() + 10 * DAY);
  Object.assign(store.users.user_A, { plan: 'pro', proUntil: until });
  store.subscriptions.user_A = { userId: 'user_A', providerSubscriptionId: 'preap_p', status: 'pending' };
  const { res, body, client } = await downgrade('user_A');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.calls.cancelPreapproval, ['preap_p']);
  assert.equal(body.plan, 'pro');
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(new Date(store.users.user_A.proUntil).getTime(), until.getTime());
});
