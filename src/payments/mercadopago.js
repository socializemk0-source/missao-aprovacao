// Cliente do Mercado Pago (Assinaturas / Preapproval) + validação de
// assinatura de webhook.
//
// O Plano PRO é uma cobrança RECORRENTE de R$ 29,90/mês, não um pagamento
// único — por isso usamos a API de Assinaturas (Preapproval), não a de
// Preferências de Checkout Pro.
//
// Ponto crítico de segurança: o estado de uma assinatura só é considerado
// válido depois de consultarmos a API do Mercado Pago diretamente com o
// Access Token do servidor — nunca confiamos no corpo da notificação do
// webhook por si só (ele pode ser forjado; a API, com o token secreto, não).

import crypto from 'crypto';

const MP_API_BASE = 'https://api.mercadopago.com';

export function createMercadoPagoClient({ accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN, fetchImpl = fetch } = {}) {
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no servidor.');
  }

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // Cria a assinatura (Preapproval) e devolve o init_point para onde o
  // usuário deve ser redirecionado para autorizar a cobrança recorrente.
  async function createSubscription({ reason, price, externalReference, payerEmail, backUrl, notificationUrl }) {
    const res = await fetchImpl(`${MP_API_BASE}/preapproval`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        reason,
        external_reference: externalReference,
        // Obrigatório pelo Mercado Pago ao criar uma assinatura sem um
        // preapproval_plan_id associado — sem isso a API responde 400
        // "payer_email is required" e a assinatura nunca é criada.
        payer_email: payerEmail,
        back_url: backUrl,
        notification_url: notificationUrl,
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: price,
          currency_id: 'BRL',
        },
        status: 'pending',
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao criar assinatura no Mercado Pago (HTTP ${res.status}): ${text}`);
    }
    return res.json();
  }

  // Re-consulta o estado real de uma assinatura (nunca confiar no corpo do webhook).
  async function getSubscription(preapprovalId) {
    const res = await fetchImpl(`${MP_API_BASE}/preapproval/${encodeURIComponent(preapprovalId)}`, {
      headers: authHeaders,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao consultar assinatura no Mercado Pago (HTTP ${res.status}): ${text}`);
    }
    return res.json();
  }

  // Cancela a assinatura de verdade no Mercado Pago (autosserviço de downgrade
  // precisa chamar isto — senão o usuário "vira grátis" no app mas continua
  // sendo cobrado todo mês).
  async function cancelSubscription(preapprovalId) {
    const res = await fetchImpl(`${MP_API_BASE}/preapproval/${encodeURIComponent(preapprovalId)}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status: 'cancelled' }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao cancelar assinatura no Mercado Pago (HTTP ${res.status}): ${text}`);
    }
    return res.json();
  }

  // Re-consulta uma cobrança recorrente específica (evento subscription_authorized_payment).
  async function getAuthorizedPayment(authorizedPaymentId) {
    const res = await fetchImpl(`${MP_API_BASE}/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`, {
      headers: authHeaders,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Falha ao consultar cobrança recorrente no Mercado Pago (HTTP ${res.status}): ${text}`);
    }
    return res.json();
  }

  return { createSubscription, getSubscription, cancelSubscription, getAuthorizedPayment };
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
