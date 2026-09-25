// Cliente do Mercado Pago + validação de assinatura de webhook.
//
//  - Modo "pass" (padrão): Checkout Pro (/checkout/preferences) — pagamento
//    único por PIX ou cartão que dá 30 dias / 1 ano de PRO.
//  - Modo "subscription": Assinaturas (/preapproval) — cobrança recorrente
//    no cartão, mensal ou anual.
//
// Ponto crítico de segurança: o estado de um pagamento/assinatura só é
// considerado depois de consultarmos a API do Mercado Pago com o Access
// Token do servidor. O corpo de uma notificação nunca decide nada sozinho.

import crypto from 'crypto';

const MP_API_BASE = 'https://api.mercadopago.com';

export class MercadoPagoError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'MercadoPagoError';
    this.status = status;
  }
}

export function createMercadoPagoClient({ accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN, fetchImpl = fetch } = {}) {
  if (!accessToken) {
    throw new Error('MERCADOPAGO_ACCESS_TOKEN não configurado no servidor.');
  }

  async function request(path, { method = 'GET', body } = {}) {
    const headers = { Authorization: `Bearer ${accessToken}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // Uma criação repetida (retry de rede) com a mesma chave não gera
    // uma segunda cobrança/assinatura do lado do Mercado Pago.
    if (method === 'POST') headers['X-Idempotency-Key'] = crypto.randomUUID();

    const res = await fetchImpl(`${MP_API_BASE}${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const detail = data?.message || data?.error || '';
      throw new MercadoPagoError(`Falha na chamada ao Mercado Pago (${method} ${path}): HTTP ${res.status} ${detail}`.trim(), res.status);
    }
    return data;
  }

  const id = (value) => encodeURIComponent(String(value));

  // Checkout Pro: devolve { id, init_point } — o init_point é a página de
  // pagamento hospedada pelo Mercado Pago (PIX, cartão).
  function createPreference({ itemId, title, amount, externalReference, payerEmail, backUrl, notificationUrl }) {
    return request('/checkout/preferences', {
      method: 'POST',
      body: {
        items: [{ id: itemId, title, quantity: 1, unit_price: amount, currency_id: 'BRL' }],
        external_reference: externalReference,
        ...(payerEmail ? { payer: { email: payerEmail } } : {}),
        back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
        auto_return: 'approved',
        ...(notificationUrl ? { notification_url: notificationUrl } : {}),
        // Boleto leva dias para compensar e o aluno ficaria esperando o PRO.
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }] },
        statement_descriptor: 'MISSAOAPROVACAO',
      },
    });
  }

  function getPayment(paymentId) {
    return request(`/v1/payments/${id(paymentId)}`);
  }

  // Assinatura sem plano associado, com pagamento pendente: o aluno
  // autoriza o cartão no init_point e o Mercado Pago passa a cobrar
  // sozinho a cada `frequencyMonths` meses.
  function createPreapproval({ reason, amount, frequencyMonths, externalReference, payerEmail, backUrl }) {
    return request('/preapproval', {
      method: 'POST',
      body: {
        reason,
        external_reference: externalReference,
        payer_email: payerEmail,
        back_url: backUrl,
        auto_recurring: {
          frequency: frequencyMonths,
          frequency_type: 'months',
          transaction_amount: amount,
          currency_id: 'BRL',
        },
        status: 'pending',
      },
    });
  }

  function getPreapproval(preapprovalId) {
    return request(`/preapproval/${id(preapprovalId)}`);
  }

  function cancelPreapproval(preapprovalId) {
    return request(`/preapproval/${id(preapprovalId)}`, { method: 'PUT', body: { status: 'cancelled' } });
  }

  // Cada cobrança recorrente de uma assinatura (evento subscription_authorized_payment).
  function getAuthorizedPayment(authorizedPaymentId) {
    return request(`/authorized_payments/${id(authorizedPaymentId)}`);
  }

  return { createPreference, getPayment, createPreapproval, getPreapproval, cancelPreapproval, getAuthorizedPayment };
}

// Link de pagamento a usar: credenciais de teste (TEST-...) abrem o sandbox.
export function checkoutUrlFor(resource, accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN) {
  if (String(accessToken || '').startsWith('TEST-') && resource?.sandbox_init_point) return resource.sandbox_init_point;
  return resource?.init_point;
}

function firstValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === null) return undefined;
  const trimmed = String(raw).trim();
  return trimmed || undefined;
}

function hmacMatches(manifestParts, ts, received, secret) {
  const manifest = [...manifestParts, `ts:${ts}`].join(';') + ';';
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  if (Buffer.byteLength(expected) !== Buffer.byteLength(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

// Valida o header x-signature ("ts=...,v1=...") de um webhook do Mercado
// Pago, na regra do SDK oficial: manifest "id:{data.id};request-id:{x-request-id};ts:{ts};",
// omitindo o par que não veio. A doc manda usar o data.id em minúsculas
// quando for alfanumérico; aceitamos a assinatura feita sobre o id como
// veio ou em minúsculas (as duas exigem o nosso segredo).
export function verifyWebhookSignature({ xSignature, xRequestId, dataId, secret }) {
  const header = firstValue(xSignature);
  if (!header || !secret) return false;

  let ts;
  let v1;
  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    const value = part.slice(eq + 1).trim();
    if (key === 'ts') ts = value;
    else if (key === 'v1') v1 = value;
  }
  if (!ts || !/^\d+$/.test(ts) || !v1) return false;

  const requestId = firstValue(xRequestId);
  const id = firstValue(dataId);
  const candidates = id && id.toLowerCase() !== id ? [id, id.toLowerCase()] : [id];
  return candidates.some((candidate) => {
    const parts = [];
    if (candidate) parts.push(`id:${candidate}`);
    if (requestId) parts.push(`request-id:${requestId}`);
    return hmacMatches(parts, ts, v1, secret);
  });
}
