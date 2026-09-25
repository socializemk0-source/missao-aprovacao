// src/payments/mercadopago.js — validação do x-signature dos webhooks, na mesma
// regra do SDK oficial (mercadopago/sdk-nodejs, src/utils/webhook):
// manifest "id:{data.id};request-id:{x-request-id};ts:{ts};" — o par que
// faltar é OMITIDO (não vira "request-id:;"), HMAC-SHA256 em hex.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { verifyWebhookSignature, createMercadoPagoClient, checkoutUrlFor } from '../src/payments/mercadopago.js';

const SECRET = 'segredo-de-teste';

function sign(manifest, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
}

test('assinatura válida com id, request-id e ts', () => {
  const v1 = sign('id:123456;request-id:req-1;ts:1704908010;');
  assert.equal(verifyWebhookSignature({
    xSignature: `ts=1704908010,v1=${v1}`, xRequestId: 'req-1', dataId: '123456', secret: SECRET,
  }), true);
});

test('sem x-request-id o par é omitido do manifest (como no SDK oficial)', () => {
  const v1 = sign('id:123456;ts:1704908010;');
  assert.equal(verifyWebhookSignature({
    xSignature: `ts=1704908010,v1=${v1}`, xRequestId: undefined, dataId: '123456', secret: SECRET,
  }), true);
});

test('id alfanumérico: aceita a assinatura feita sobre o id em minúsculas (regra da doc)', () => {
  const v1 = sign('id:2c9380848f1a;request-id:req-1;ts:1704908010;');
  assert.equal(verifyWebhookSignature({
    xSignature: `ts=1704908010,v1=${v1}`, xRequestId: 'req-1', dataId: '2C9380848F1A', secret: SECRET,
  }), true);
});

test('header com espaços e ordem trocada ainda é aceito', () => {
  const v1 = sign('id:9;request-id:r;ts:1700000000;');
  assert.equal(verifyWebhookSignature({
    xSignature: ` v1=${v1} , ts=1700000000 `, xRequestId: 'r', dataId: '9', secret: SECRET,
  }), true);
});

test('recusa: segredo errado, id trocado, header ausente, ts não numérico, sem v1', () => {
  const v1 = sign('id:1;request-id:r;ts:1700000000;', 'outro-segredo');
  assert.equal(verifyWebhookSignature({ xSignature: `ts=1700000000,v1=${v1}`, xRequestId: 'r', dataId: '1', secret: SECRET }), false);

  const ok = sign('id:1;request-id:r;ts:1700000000;');
  assert.equal(verifyWebhookSignature({ xSignature: `ts=1700000000,v1=${ok}`, xRequestId: 'r', dataId: '2', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ xSignature: undefined, xRequestId: 'r', dataId: '1', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ xSignature: `ts=abc,v1=${ok}`, xRequestId: 'r', dataId: '1', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ xSignature: 'ts=1700000000', xRequestId: 'r', dataId: '1', secret: SECRET }), false);
  assert.equal(verifyWebhookSignature({ xSignature: `ts=1700000000,v1=${ok}`, xRequestId: 'r', dataId: '1', secret: '' }), false);
});

// Formato das chamadas à API do Mercado Pago (fetch falso, sem rede).

function recordingFetch(response = { id: 'x', init_point: 'https://mp/x' }, status = 200) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ...init, body: init.body ? JSON.parse(init.body) : undefined });
    return { ok: status < 400, status, json: async () => response };
  };
  return { calls, fetchImpl };
}

test('cliente: preferência do Checkout Pro com PIX/cartão (sem boleto), volta e webhook', async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = createMercadoPagoClient({ accessToken: 'APP_USR-1', fetchImpl });
  await client.createPreference({
    itemId: 'pro-pass-monthly', title: 'PRO 30 dias', amount: 29.9, externalReference: 'pass:monthly:u1',
    payerEmail: 'a@b.c', backUrl: 'https://app/?payment=return', notificationUrl: 'https://app/api/payments/webhook?source_news=webhooks',
  });
  const [call] = calls;
  assert.equal(call.url, 'https://api.mercadopago.com/checkout/preferences');
  assert.equal(call.method, 'POST');
  assert.equal(call.headers.Authorization, 'Bearer APP_USR-1');
  assert.ok(call.headers['X-Idempotency-Key']);
  assert.deepEqual(call.body.items, [{ id: 'pro-pass-monthly', title: 'PRO 30 dias', quantity: 1, unit_price: 29.9, currency_id: 'BRL' }]);
  assert.equal(call.body.external_reference, 'pass:monthly:u1');
  assert.deepEqual(call.body.back_urls, { success: 'https://app/?payment=return', pending: 'https://app/?payment=return', failure: 'https://app/?payment=return' });
  assert.equal(call.body.auto_return, 'approved');
  assert.deepEqual(call.body.payment_methods.excluded_payment_types, [{ id: 'ticket' }]);
});

test('cliente: assinatura (preapproval) anual a cada 12 meses; cancelar é PUT status=cancelled', async () => {
  const { calls, fetchImpl } = recordingFetch();
  const client = createMercadoPagoClient({ accessToken: 'APP_USR-1', fetchImpl });
  await client.createPreapproval({ reason: 'PRO anual', amount: 239.9, frequencyMonths: 12, externalReference: 'sub:annual:u1', payerEmail: 'a@b.c', backUrl: 'https://app/?payment=return' });
  assert.equal(calls[0].url, 'https://api.mercadopago.com/preapproval');
  assert.deepEqual(calls[0].body.auto_recurring, { frequency: 12, frequency_type: 'months', transaction_amount: 239.9, currency_id: 'BRL' });
  assert.equal(calls[0].body.status, 'pending');
  assert.equal(calls[0].body.payer_email, 'a@b.c');

  await client.cancelPreapproval('abc/../x');
  assert.equal(calls[1].url, 'https://api.mercadopago.com/preapproval/abc%2F..%2Fx');
  assert.equal(calls[1].method, 'PUT');
  assert.deepEqual(calls[1].body, { status: 'cancelled' });

  await client.getPayment(123);
  await client.getAuthorizedPayment('ap1');
  assert.equal(calls[2].url, 'https://api.mercadopago.com/v1/payments/123');
  assert.equal(calls[3].url, 'https://api.mercadopago.com/authorized_payments/ap1');
});

test('cliente: erro HTTP vira MercadoPagoError com o status; sem token não cria cliente', async () => {
  const { fetchImpl } = recordingFetch({ message: 'not found' }, 404);
  const client = createMercadoPagoClient({ accessToken: 'APP_USR-1', fetchImpl });
  await assert.rejects(client.getPayment(1), (err) => err.status === 404 && /not found/.test(err.message));
  assert.throws(() => createMercadoPagoClient({ accessToken: '' }), /MERCADOPAGO_ACCESS_TOKEN/);
});

test('link de pagamento: sandbox só com credencial de teste', () => {
  const pref = { init_point: 'https://prod', sandbox_init_point: 'https://sandbox' };
  assert.equal(checkoutUrlFor(pref, 'APP_USR-1'), 'https://prod');
  assert.equal(checkoutUrlFor(pref, 'TEST-1'), 'https://sandbox');
});
