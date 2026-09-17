// Cliente do Mercado Pago (Checkout Pro) + validação de assinatura de webhook.
//
// Ponto crítico de segurança: um pagamento só é considerado válido depois
// de consultarmos a API do Mercado Pago diretamente com o Access Token do
// servidor — nunca confiamos no corpo da notificação do webhook por si só
// (ele pode ser forjado; a API, com o token secreto, não).

import crypto from 'crypto';

const MP_API_BASE = 'https://api.mercadopago.com';

export function createMercadoPagoClient({ accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN, fetchImpl = fetch } = {}) {
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no servidor.');
  }

  async function createPreference({ title, price, externalReference, backUrls, notificationUrl }) {
    const res = await fetchImpl(`${MP_API_BASE}/checkout/preferences`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: [
          {
            title,
            quantity: 1,
            unit_price: price,
            currency_id: 'BRL',
          },
        ],
        external_reference: externalReference,
        back_urls: backUrls,
        auto_return: 'approved',
        notification_url: notificationUrl,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao criar preferência no Mercado Pago (HTTP ${res.status}): ${text}`);
    }
    return res.json();
  }

  async function getPayment(paymentId) {
    const res = await fetchImpl(`${MP_API_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao consultar pagamento no Mercado Pago (HTTP ${res.status}): ${text}`);
    }
    return res.json();
  }

  return { createPreference, getPayment };
}

// Valida o header x-signature de um webhook do Mercado Pago.
// Formato do header: "ts=1704908010,v1=618c8534524..."
// Manifest assinado: "id:{data.id};request-id:{x-request-id};ts:{ts};"
// Referência: https://www.mercadopago.com.br/developers/pt/docs/checkout-api/webhooks#Validação-da-origem-da-notificação
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }) {
  if (!xSignature || !secret || !dataId) return false;

  const parts = {};
  for (const piece of String(xSignature).split(',')) {
    const [key, ...rest] = piece.split('=');
    if (key) parts[key.trim()] = rest.join('=').trim();
  }

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId || ''};ts:${ts};`;
  const expectedHex = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuf = Buffer.from(expectedHex);
  const actualBuf = Buffer.from(v1);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
