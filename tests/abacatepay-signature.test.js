// Valida verifyWebhookSignature e verifyWebhookSecret (os dois fatores de
// autenticidade do webhook da AbacatePay). Este é o ponto mais crítico de
// toda a integração de pagamentos: se qualquer um dos dois puder ser
// contornado, qualquer pessoa consegue forjar "pagamento aprovado" e
// ganhar o Plano PRO de graça — seria recriar a mesma vulnerabilidade de
// payment bypass da auditoria original (com o Mercado Pago).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebhookSignature, verifyWebhookSecret } from '../src/payments/abacatepay.js';

const PUBLIC_KEY = 'chave-publica-de-teste-nao-e-a-real';

function sign(rawBody, key = PUBLIC_KEY) {
  return crypto.createHmac('sha256', key).update(Buffer.from(rawBody, 'utf8')).digest('base64');
}

test('assinatura válida (mesma chave, mesmo corpo bruto) é aceita', () => {
  const rawBody = '{"event":"subscription.completed","data":{}}';
  const ok = verifyWebhookSignature({ rawBody, signatureHeader: sign(rawBody), publicKey: PUBLIC_KEY });
  assert.equal(ok, true);
});

test('[segurança] assinatura calculada com chave ERRADA é rejeitada', () => {
  const rawBody = '{"event":"subscription.completed","data":{}}';
  const forged = sign(rawBody, 'chave-forjada-pelo-atacante');
  const ok = verifyWebhookSignature({ rawBody, signatureHeader: forged, publicKey: PUBLIC_KEY });
  assert.equal(ok, false, 'uma assinatura forjada com outra chave NUNCA pode passar');
});

test('[segurança] corpo trocado depois de assinado é rejeitado (não dá pra reaproveitar a assinatura de outra notificação)', () => {
  const originalBody = '{"event":"subscription.payment_failed","data":{"subscription":{"id":"subs_1"}}}';
  const validSignatureForOriginal = sign(originalBody);
  const tamperedBody = '{"event":"subscription.completed","data":{"subscription":{"id":"subs_1"}}}';

  const ok = verifyWebhookSignature({ rawBody: tamperedBody, signatureHeader: validSignatureForOriginal, publicKey: PUBLIC_KEY });
  assert.equal(ok, false);
});

test('header X-Webhook-Signature ausente é rejeitado', () => {
  const ok = verifyWebhookSignature({ rawBody: '{}', signatureHeader: undefined, publicKey: PUBLIC_KEY });
  assert.equal(ok, false);
});

test('chave pública ausente (webhook mal configurado) é rejeitada, nunca aceita por padrão', () => {
  const rawBody = '{}';
  const ok = verifyWebhookSignature({ rawBody, signatureHeader: sign(rawBody), publicKey: undefined });
  assert.equal(ok, false);
});

test('verifyWebhookSecret: segredo correto (mesmo valor) é aceito', () => {
  assert.equal(verifyWebhookSecret({ receivedSecret: 'segredo-123', expectedSecret: 'segredo-123' }), true);
});

test('[segurança] verifyWebhookSecret: segredo errado é rejeitado', () => {
  assert.equal(verifyWebhookSecret({ receivedSecret: 'segredo-forjado', expectedSecret: 'segredo-123' }), false);
});

test('[segurança] verifyWebhookSecret: segredo ausente na notificação é rejeitado', () => {
  assert.equal(verifyWebhookSecret({ receivedSecret: undefined, expectedSecret: 'segredo-123' }), false);
});

// A API atual da AbacatePay é a v2 (https://api.abacatepay.com/v2). Na v1 o
// caminho de cliente é /customer/create e assinaturas nem existem — o
// checkout falhava em qualquer chamada.
test('cliente da AbacatePay chama os endpoints da API v2', async () => {
  const { createAbacatePayClient } = await import('../src/payments/abacatepay.js');
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    return { ok: true, status: 200, json: async () => ({ success: true, data: { id: 'x', url: 'https://pay' } }) };
  };
  const client = createAbacatePayClient({ apiKey: 'k', fetchImpl });
  await client.createCustomer({ email: 'a@a.com' });
  await client.createSubscription({ productId: 'prod_1', customerId: 'cust_1', completionUrl: 'https://x', externalId: 'u1' });
  await client.cancelSubscription('subs_1');
  assert.deepEqual(urls, [
    'https://api.abacatepay.com/v2/customers/create',
    'https://api.abacatepay.com/v2/subscriptions/create',
    'https://api.abacatepay.com/v2/subscriptions/cancel',
  ]);
});
