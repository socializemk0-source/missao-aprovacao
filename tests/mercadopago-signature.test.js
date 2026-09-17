// Valida verifyWebhookSignature (HMAC-SHA256 do webhook do Mercado Pago).
// Este é o ponto mais crítico de toda a integração de pagamentos: se essa
// validação estiver errada (ou puder ser contornada), qualquer pessoa
// consegue forjar "pagamento aprovado" e ganhar o Plano PRO de graça —
// seria recriar a mesma vulnerabilidade de payment bypass da auditoria.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyWebhookSignature } from '../src/payments/mercadopago.js';

const SECRET = 'segredo-de-teste-nao-e-o-real';

function signManifest({ dataId, requestId, ts, secret = SECRET }) {
  const manifest = `id:${dataId};request-id:${requestId || ''};ts:${ts};`;
  return crypto.createHmac('sha256', secret).update(manifest).digest('hex');
}

test('assinatura válida (mesmo segredo, mesmo manifest) é aceita', () => {
  const ts = '1704908010';
  const dataId = '123456789';
  const xRequestId = 'req-abc-123';
  const v1 = signManifest({ dataId, requestId: xRequestId, ts });

  const ok = verifyWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId,
    dataId,
    secret: SECRET,
  });
  assert.equal(ok, true);
});

test('[segurança] assinatura calculada com segredo ERRADO é rejeitada', () => {
  const ts = '1704908010';
  const dataId = '123456789';
  const xRequestId = 'req-abc-123';
  const v1 = signManifest({ dataId, requestId: xRequestId, ts, secret: 'segredo-forjado-pelo-atacante' });

  const ok = verifyWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId,
    dataId,
    secret: SECRET,
  });
  assert.equal(ok, false, 'uma assinatura forjada com outro segredo NUNCA pode passar');
});

test('[segurança] payment id trocado depois de assinado é rejeitado (não dá pra reaproveitar assinatura de outro pagamento)', () => {
  const ts = '1704908010';
  const xRequestId = 'req-abc-123';
  const v1 = signManifest({ dataId: '111111111', requestId: xRequestId, ts }); // assinado para o pagamento 111...

  const ok = verifyWebhookSignature({
    xSignature: `ts=${ts},v1=${v1}`,
    xRequestId,
    dataId: '999999999', // atacante tenta reaproveitar a assinatura para outro pagamento
    secret: SECRET,
  });
  assert.equal(ok, false);
});

test('header x-signature ausente é rejeitado', () => {
  const ok = verifyWebhookSignature({ xSignature: undefined, xRequestId: 'req-1', dataId: '123', secret: SECRET });
  assert.equal(ok, false);
});

test('secret ausente (webhook mal configurado) é rejeitado, nunca aceito por padrão', () => {
  const ts = '1704908010';
  const dataId = '123456789';
  const v1 = signManifest({ dataId, requestId: 'req-1', ts });
  const ok = verifyWebhookSignature({ xSignature: `ts=${ts},v1=${v1}`, xRequestId: 'req-1', dataId, secret: undefined });
  assert.equal(ok, false);
});

test('header x-signature malformado (sem v1) é rejeitado', () => {
  const ok = verifyWebhookSignature({ xSignature: 'ts=1704908010', xRequestId: 'req-1', dataId: '123', secret: SECRET });
  assert.equal(ok, false);
});
