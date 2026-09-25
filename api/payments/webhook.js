import { createMercadoPagoClient, verifyWebhookSignature } from '../../src/payments/mercadopago.js';
import { applyPassPayment, applyPreapproval, applyAuthorizedPayment } from '../../src/payments/sync.js';
import { readBody } from '../../src/payments/http.js';

function queryValue(query, key) {
  const value = query?.[key];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * POST /api/payments/webhook — notificações do Mercado Pago (arquivo próprio
 * para existir como rota tanto no Express quanto na Vercel).
 *
 * Duas camadas:
 *  1. x-signature (HMAC com a "assinatura secreta" do painel do Mercado
 *     Pago, MERCADOPAGO_WEBHOOK_SECRET) — fail-closed sem o segredo;
 *  2. o recurso é SEMPRE re-consultado na API com o nosso token; o estado
 *     aplicado é o que a API diz, não o que veio na notificação.
 *
 * Tópicos: payment (passe PRO), subscription_preapproval (assinatura) e
 * subscription_authorized_payment (cada cobrança da assinatura).
 */
export default async function webhookHandler(req, res, deps = {}) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Payments Webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado — recusando notificação (fail-closed).');
    return res.status(401).json({ error: 'Webhook não configurado.' });
  }

  const body = (await readBody(req)) || {};
  const query = req.query || {};

  // Formato antigo (IPN: ?topic=...&id=...) não é assinado. Tudo o que ele
  // avisaria também chega no formato novo, então só confirmamos o recebimento.
  const type = queryValue(query, 'type') || body.type;
  if (!type && queryValue(query, 'topic')) {
    return res.status(200).json({ success: true, ignored: true });
  }

  const dataId = queryValue(query, 'data.id') ?? query.data?.id ?? body.data?.id;
  if (!dataId) {
    return res.status(400).json({ error: 'Notificação sem data.id.' });
  }

  const signatureOk = verifyWebhookSignature({
    xSignature: req.headers['x-signature'],
    xRequestId: req.headers['x-request-id'],
    dataId: String(dataId),
    secret,
  });
  if (!signatureOk) {
    console.warn('[Payments Webhook] x-signature inválida ou ausente — notificação rejeitada.');
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  let client;
  try {
    client = deps.mercadoPagoClient || createMercadoPagoClient();
  } catch (err) {
    console.error('[Payments Webhook] Cliente do Mercado Pago não configurado:', err.message);
    return res.status(500).json({ error: 'Pagamentos não configurados.' });
  }

  try {
    let result;
    if (type === 'payment') {
      result = await applyPassPayment(await client.getPayment(dataId));
    } else if (type === 'subscription_preapproval') {
      result = await applyPreapproval(client, await client.getPreapproval(dataId));
    } else if (type === 'subscription_authorized_payment') {
      result = await applyAuthorizedPayment(client, await client.getAuthorizedPayment(dataId));
    } else {
      return res.status(200).json({ success: true, ignored: true });
    }

    console.log(`[Payments Webhook] ${type} ${dataId}: ${result.status}${result.userId ? ` (usuário ${result.userId})` : ''}.`);
    return res.status(200).json({ success: true, result: result.status });
  } catch (err) {
    // Recurso que não existe na nossa conta (ex.: o "simular notificação"
    // do painel manda um id fictício): nada a fazer, e reenviar não ajuda.
    if (err.status === 404) {
      console.warn(`[Payments Webhook] ${type} ${dataId} não encontrado no Mercado Pago — ignorado.`);
      return res.status(200).json({ success: true, ignored: true });
    }
    console.error('[Payments Webhook] Erro ao processar notificação:', err.message);
    // 5xx faz o Mercado Pago reenviar depois — certo para falhas transitórias.
    return res.status(500).json({ error: 'Erro ao processar notificação.' });
  }
}
