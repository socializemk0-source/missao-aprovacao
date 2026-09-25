// api/payments.js (checkout de assinatura, autenticado) + api/payments/webhook.js
// (webhook, assinatura própria) + api/auth.js (downgrade cancela a
// assinatura real). Banco mockado (fake-db.js) e requireAuth mockado
// (fake-auth.js, convenção "TEST:<uid>") como no resto da suíte.
// O cliente da AbacatePay é injetado via deps.abacatePayClient — nenhuma
// chamada de rede real acontece aqui.
//
// O Plano PRO é uma ASSINATURA RECORRENTE (R$ 29,90/mês, AbacatePay
// Subscriptions), não um pagamento único.

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
const PUBLIC_KEY = 'chave-publica-teste';
process.env.ABACATEPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
process.env.ABACATEPAY_WEBHOOK_PUBLIC_KEY = PUBLIC_KEY;
process.env.ABACATEPAY_PRODUCT_ID = 'prod_pro_29_90';

function authHeader(uid) {
  return { authorization: `Bearer TEST:${uid}` };
}

function signBody(rawBody, key = PUBLIC_KEY) {
  return crypto.createHmac('sha256', key).update(Buffer.from(rawBody, 'utf8')).digest('base64');
}

function makeWebhookReq({ event, data }) {
  const rawBody = JSON.stringify({ event, data });
  return {
    req: makeReq({
      method: 'POST',
      query: { webhookSecret: WEBHOOK_SECRET },
      headers: { 'x-webhook-signature': signBody(rawBody) },
    }),
    deps: { rawBody },
  };
}

function fakeAbacatePayClient({ customerId = 'cust_1', subscriptionId = 'bill_1', url = 'https://app.abacatepay.com/pay/bill_1' } = {}) {
  const calls = { createCustomer: [], createSubscription: [], cancelSubscription: [] };
  return {
    calls,
    createCustomer: async (args) => {
      calls.createCustomer.push(args);
      return { id: customerId };
    },
    createSubscription: async (args) => {
      calls.createSubscription.push(args);
      return { id: subscriptionId, url };
    },
    cancelSubscription: async (id) => {
      calls.cancelSubscription.push(id);
      return { id, status: 'CANCELLED' };
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
  const client = fakeAbacatePayClient();
  const req = makeReq({ body: {} });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });
  assert.equal(res.statusCode, 401);
  assert.equal(client.calls.createSubscription.length, 0);
});

test('checkout autenticado usa req.user.uid como externalId, nunca um uid do body', async () => {
  const client = fakeAbacatePayClient();
  const req = makeReq({
    body: { uid: 'user_B', userId: 'user_B' }, // tentativa de spoof — deve ser ignorada
    headers: authHeader('user_A'),
  });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.checkoutUrl, 'https://app.abacatepay.com/pay/bill_1');
  assert.equal(client.calls.createSubscription.length, 1);
  assert.equal(client.calls.createSubscription[0].externalId, 'user_A', 'externalId deve ser sempre o autenticado, nunca o do body');
  assert.equal(client.calls.createSubscription[0].productId, 'prod_pro_29_90');
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'bill_1', 'salva o estado local (pending) já na criação');
  assert.equal(store.subscriptions.user_A.status, 'pending');
});

test('checkout cria um customer na AbacatePay usando o e-mail autenticado', async () => {
  const client = fakeAbacatePayClient();
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.createCustomer.length, 1);
  assert.equal(client.calls.createCustomer[0].email, 'user_A@test.local');
  assert.equal(store.subscriptions.user_A.providerCustomerId, 'cust_1');
});

test('checkout reaproveita o customer já criado — nunca cria um customer duplicado na AbacatePay', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_ja_existente', status: 'none' };
  const client = fakeAbacatePayClient();
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.createCustomer.length, 0, 'não deve criar um customer novo se já existe um salvo');
  assert.equal(client.calls.createSubscription[0].customerId, 'cust_ja_existente');
});

// P1 da revisão de 20/09/2026: "Novo checkout pode impedir o cancelamento
// da assinatura original". upsertSubscription guarda UMA linha por
// usuário — criar um segundo checkout sobrescrevia providerSubscriptionId,
// perdendo pra sempre a referência da assinatura ativa original (que
// continuava sendo cobrada, sem ninguém saber cancelar).
test('checkout NÃO cria uma segunda assinatura quando já existe uma ativa — evita perder a referência da original', async () => {
  store.subscriptions.user_A = {
    userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_ORIGINAL_ATIVA', status: 'active',
  };
  const client = fakeAbacatePayClient({ subscriptionId: 'bill_NOVA_DUPLICADA' });
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 409);
  assert.equal(client.calls.createSubscription.length, 0, 'não pode criar uma segunda assinatura na AbacatePay');
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'subs_ORIGINAL_ATIVA', 'a referência da assinatura ativa não pode ser perdida/sobrescrita');
  assert.equal(store.subscriptions.user_A.status, 'active');
});

test('checkout com assinatura pending (tentativa anterior não confirmada) ainda pode criar um novo checkout', async () => {
  store.subscriptions.user_A = {
    userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'bill_pending_antigo', status: 'pending',
  };
  const client = fakeAbacatePayClient({ subscriptionId: 'bill_novo' });
  const req = makeReq({ body: {}, headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.createSubscription.length, 1);
});

test('checkout via GET é rejeitado (405) — o handler de pagamento nunca pode criar assinatura fora de POST', async () => {
  const client = fakeAbacatePayClient();
  const req = makeReq({ method: 'GET', headers: authHeader('user_A') });
  const res = makeRes();
  await paymentsHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 405);
  assert.equal(client.calls.createSubscription.length, 0);
});

// ---------------------------------------------------------------------
// Webhook (api/payments/webhook.js) — segredo na query + assinatura HMAC
// obrigatórios, sem auth de sessão
// ---------------------------------------------------------------------

test('[segurança] webhook sem o segredo correto na query string → 401, plano NÃO é alterado', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_1', status: 'pending' };
  const rawBody = JSON.stringify({ event: 'subscription.completed', data: { subscription: { id: 'subs_1' } } });
  const req = makeReq({
    method: 'POST',
    query: { webhookSecret: 'segredo-errado' },
    headers: { 'x-webhook-signature': signBody(rawBody) },
  });
  const res = makeRes();
  await webhookHandler(req, res, { rawBody });

  assert.equal(res.statusCode, 401);
  assert.notEqual(store.users.user_A?.plan, 'pro');
});

test('[segurança] webhook com segredo certo mas assinatura HMAC inválida → 401, plano NÃO é alterado', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_1', status: 'pending' };
  const rawBody = JSON.stringify({ event: 'subscription.completed', data: { subscription: { id: 'subs_1' } } });
  const req = makeReq({
    method: 'POST',
    query: { webhookSecret: WEBHOOK_SECRET },
    headers: { 'x-webhook-signature': 'assinatura-forjada' },
  });
  const res = makeRes();
  await webhookHandler(req, res, { rawBody });

  assert.equal(res.statusCode, 401);
  assert.notEqual(store.users.user_A?.plan, 'pro');
});

test('subscription.completed identificado pelo id da assinatura → usuário promovido a PRO', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_42', status: 'pending' };
  const { req, deps } = makeWebhookReq({
    event: 'subscription.completed',
    data: { subscription: { id: 'subs_42', amount: 2990, currency: 'BRL' }, payment: { id: 'char_1', status: 'PAID', paidAmount: 2990 } },
  });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'pro', 'assinatura completada deve liberar o PRO');
  assert.equal(store.subscriptions.user_A.status, 'active');
  assert.equal(store.subscriptionPayments.length, 1);
});

test('subscription.completed identificado pelo id do customer (quando o evento não repete o id da assinatura provisória)', async () => {
  // Estado logo após o checkout: só temos o id provisório (bill_...) salvo,
  // mas o webhook já traz o id real da assinatura (subs_...) — a
  // correlação precisa cair pro customerId.
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_99', providerSubscriptionId: 'bill_1', status: 'pending' };
  const { req, deps } = makeWebhookReq({
    event: 'subscription.completed',
    data: { subscription: { id: 'subs_novo_77', amount: 2990, currency: 'BRL' }, customer: { id: 'cust_99' } },
  });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'subs_novo_77', 'deve substituir o id provisório pelo id real da assinatura');
});

test('subscription.completed sem nenhuma correlação possível → ignorado, sem erro e sem alterar plano', async () => {
  const { req, deps } = makeWebhookReq({
    event: 'subscription.completed',
    data: { subscription: { id: 'subs_desconhecida' } },
  });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ignored, true);
});

test('subscription.payment_failed → é registrado, mas plano NÃO muda para pro nem é revogado ainda', async () => {
  store.users.user_A.plan = 'pro';
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_7', status: 'active' };
  const { req, deps } = makeWebhookReq({
    event: 'subscription.payment_failed',
    data: { subscription: { id: 'subs_7' }, retryNumber: 1 },
  });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'pro', 'uma falha de cobrança isolada não revoga o PRO — só o evento cancelled revoga');
  assert.equal(store.subscriptions.user_A.status, 'payment_failed');
});

test('subscription.cancelled → usuário revertido para o modo gratuito', async () => {
  store.users.user_A.plan = 'pro';
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_9', status: 'active' };
  const { req, deps } = makeWebhookReq({
    event: 'subscription.cancelled',
    data: { subscription: { id: 'subs_9', status: 'CANCELLED', cancelledDueTo: 'max_payment_retries_exceeded' } },
  });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(store.users.user_A.plan, 'free');
  assert.equal(store.subscriptions.user_A.status, 'cancelled');
});

test('[idempotência] o mesmo pagamento de renovação reenviado duas vezes só processa uma vez', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_99', status: 'active' };

  for (let i = 0; i < 2; i++) {
    const { req, deps } = makeWebhookReq({
      event: 'subscription.renewed',
      data: { subscription: { id: 'subs_99', amount: 2990, currency: 'BRL' }, payment: { id: 'char_99', status: 'PAID', paidAmount: 2990 } },
    });
    const res = makeRes();
    await webhookHandler(req, res, deps);
    assert.equal(res.statusCode, 200);
  }

  assert.equal(store.subscriptionPayments.length, 1, 'não deve gravar o mesmo pagamento duas vezes');
});

test('webhook de outro evento (ex: subscription.trial_started) é apenas confirmado, sem processar nada', async () => {
  const { req, deps } = makeWebhookReq({ event: 'subscription.trial_started', data: {} });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ignored, true);
});

// ---------------------------------------------------------------------
// Downgrade autosserviço (api/auth.js) precisa cancelar a assinatura de
// verdade — senão o usuário continua sendo cobrado todo mês.
// ---------------------------------------------------------------------

test('downgrade-to-free com assinatura ativa cancela de verdade na AbacatePay', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_1', providerSubscriptionId: 'subs_1', status: 'active' };
  const client = fakeAbacatePayClient();
  const req = makeReq({ body: { action: 'downgrade-to-free' }, headers: authHeader('user_A') });
  const res = makeRes();
  await authHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(client.calls.cancelSubscription, ['subs_1']);
  assert.equal(store.subscriptions.user_A.status, 'cancelled');
  assert.equal(store.users.user_A.plan, 'free');
});

test('downgrade-to-free sem assinatura ativa não tenta chamar a AbacatePay', async () => {
  const client = fakeAbacatePayClient();
  const req = makeReq({ body: { action: 'downgrade-to-free' }, headers: authHeader('user_A') });
  const res = makeRes();
  await authHandler(req, res, { abacatePayClient: client });

  assert.equal(res.statusCode, 200);
  assert.equal(client.calls.cancelSubscription.length, 0);
  assert.equal(store.users.user_A.plan, 'free');
});

// Payload copiado da documentação oficial (webhook v2, subscription.completed).
// Logo após o checkout guardamos o bill_... como providerSubscriptionId; o
// evento traz esse mesmo id em data.checkout.id e o subs_ definitivo em
// data.subscription.id, que passa a ser o guardado (é ele que o cancel usa).
test('subscription.completed no formato v2 da documentação → PRO e passa a guardar o subs_', async () => {
  store.subscriptions.user_A = { userId: 'user_A', providerCustomerId: 'cust_outro', providerSubscriptionId: 'bill_jskd3TMfScHZDJe5NSZjTmQ4', status: 'pending' };
  const data = {
    subscription: { id: 'subs_tAFqDWBhcEYTjQh2K0ZYDHau', amount: 2990, currency: 'BRL', method: 'CARD', status: 'ACTIVE', frequency: 'MONTHLY', canceledAt: null, cancelPolicy: null, cancelledDueTo: null },
    customer: { id: 'cust_def456', name: 'Maria Santos', email: 'maria@exemplo.com', taxId: '12.***.***/0001-**' },
    payment: { id: 'char_xyz789', externalId: 'pedido-456', amount: 2990, paidAmount: 2990, platformFee: 100, status: 'PAID', methods: ['CARD'] },
    checkout: { id: 'bill_jskd3TMfScHZDJe5NSZjTmQ4', externalId: null, amount: 2990, paidAmount: 2990, frequency: 'SUBSCRIPTION', status: 'PAID', customerId: 'cust_def456' },
  };
  const { req, deps } = makeWebhookReq({ event: 'subscription.completed', data });
  const res = makeRes();
  await webhookHandler(req, res, deps);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ignored, undefined, 'não pode ter sido ignorado');
  assert.equal(store.users.user_A.plan, 'pro');
  assert.equal(store.subscriptions.user_A.status, 'active');
  assert.equal(store.subscriptions.user_A.providerSubscriptionId, 'subs_tAFqDWBhcEYTjQh2K0ZYDHau');
  assert.equal(store.subscriptionPayments[0].providerPaymentId, 'char_xyz789');
});

// Assinaturas usam CARD por padrão na AbacatePay; lojas sem cartão
// habilitado recusam ("CARD is not available for this store"). O método
// passa a ser configurável por ABACATEPAY_SUBSCRIPTION_METHODS.
test('checkout envia os métodos de ABACATEPAY_SUBSCRIPTION_METHODS (ex.: só PIX)', async () => {
  process.env.ABACATEPAY_SUBSCRIPTION_METHODS = ' pix ';
  try {
    const client = fakeAbacatePayClient();
    const res = makeRes();
    await paymentsHandler(makeReq({ body: {}, headers: authHeader('user_A') }), res, { abacatePayClient: client });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(client.calls.createSubscription[0].methods, ['PIX']);
  } finally {
    delete process.env.ABACATEPAY_SUBSCRIPTION_METHODS;
  }
});

test('sem ABACATEPAY_SUBSCRIPTION_METHODS (ou com valor inválido) não envia methods — vale o padrão da AbacatePay', async () => {
  for (const value of [undefined, 'BOLETO, qualquer']) {
    if (value === undefined) delete process.env.ABACATEPAY_SUBSCRIPTION_METHODS;
    else process.env.ABACATEPAY_SUBSCRIPTION_METHODS = value;
    const client = fakeAbacatePayClient();
    await paymentsHandler(makeReq({ body: {}, headers: authHeader('user_A') }), makeRes(), { abacatePayClient: client });
    assert.equal(client.calls.createSubscription[0].methods, undefined, `valor: ${value}`);
    resetStore(store);
  }
  delete process.env.ABACATEPAY_SUBSCRIPTION_METHODS;
});
