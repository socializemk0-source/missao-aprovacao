// Cliente da AbacatePay (Customers / Products / Subscriptions) + validação
// de assinatura de webhook.
//
// Ponto crítico de segurança: o webhook é assinado (HMAC-SHA256 sobre o
// corpo bruto da requisição, com a chave pública da AbacatePay) e exige
// também um segredo na query string configurado no cadastro do webhook —
// nunca confiamos no corpo da notificação sem essas duas verificações.

import crypto from 'crypto';

// API v2: é onde ficam /customers/* e /subscriptions/* (a v1 não tem assinaturas).
const ABACATEPAY_API_BASE = 'https://api.abacatepay.com/v2';

export function createAbacatePayClient({ apiKey = process.env.ABACATEPAY_API_KEY, fetchImpl = fetch } = {}) {
  if (!apiKey) {
    throw new Error('ABACATEPAY_API_KEY não configurado no servidor.');
  }

  const authHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  async function request(path, options) {
    const res = await fetchImpl(`${ABACATEPAY_API_BASE}${path}`, { headers: authHeaders, ...options });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.success === false) {
      const message = body?.error || `HTTP ${res.status}`;
      throw new Error(`Falha na chamada à AbacatePay (${path}): ${message}`);
    }
    return body.data;
  }

  // Um customer por usuário — a AbacatePay deduplica por CPF/CNPJ, não por
  // e-mail, então sem cachear o id retornado aqui criaríamos um customer
  // novo a cada tentativa de checkout.
  async function createCustomer({ email, name }) {
    return request('/customers/create', {
      method: 'POST',
      body: JSON.stringify({ email, ...(name ? { name } : {}) }),
    });
  }

  // Cria o checkout de assinatura e devolve a URL de pagamento hospedada
  // pela AbacatePay para onde o usuário deve ser redirecionado.
  async function createSubscription({ productId, customerId, completionUrl, externalId, methods }) {
    return request('/subscriptions/create', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: productId, quantity: 1 }],
        customerId,
        completionUrl,
        externalId,
        ...(methods ? { methods } : {}),
      }),
    });
  }

  async function cancelSubscription(providerSubscriptionId) {
    return request('/subscriptions/cancel', {
      method: 'POST',
      body: JSON.stringify({ id: providerSubscriptionId }),
    });
  }

  return { createCustomer, createSubscription, cancelSubscription };
}

// Valida o header X-Webhook-Signature de um webhook da AbacatePay.
// HMAC-SHA256 sobre o corpo BRUTO (string, antes de qualquer JSON.parse),
// com a chave pública da AbacatePay, codificado em base64.
export function verifyWebhookSignature({ rawBody, signatureHeader, publicKey }) {
  if (!rawBody || !signatureHeader || !publicKey) return false;

  const expectedB64 = crypto.createHmac('sha256', publicKey).update(Buffer.from(rawBody, 'utf8')).digest('base64');

  const expectedBuf = Buffer.from(expectedB64);
  const actualBuf = Buffer.from(String(signatureHeader));
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

// Segundo fator, independente da assinatura HMAC: o segredo cadastrado
// junto com a URL do webhook na AbacatePay, enviado de volta na query
// string a cada chamada (?webhookSecret=...). Comparação em tempo
// constante pelo mesmo motivo da assinatura.
export function verifyWebhookSecret({ receivedSecret, expectedSecret }) {
  if (!receivedSecret || !expectedSecret) return false;
  const receivedBuf = Buffer.from(String(receivedSecret));
  const expectedBuf = Buffer.from(String(expectedSecret));
  if (receivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}
