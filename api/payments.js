import { requireAuth } from '../middleware/requireAuth.js';
import { createMercadoPagoClient, verifyWebhookSignature } from '../src/payments/mercadopago.js';
import { updateUser, syncLeaderboardEntry, getPaymentByMpId, recordPayment } from '../src/db/queries.ts';

const PRO_PLAN_PRICE = 29.90;
const PRO_PLAN_PRICE_LABEL = 'R$ 29,90';

async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

function resolveAppBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

/**
 * Handler principal de pagamentos (Mercado Pago / Checkout Pro).
 *
 * `deps.mpClient` existe só para os testes injetarem um cliente falso —
 * em produção sempre usa o client real (Access Token do ambiente).
 */
export default async function paymentsHandler(req, res, deps = {}) {
  const path = req.path || '';

  if (req.method === 'POST' && (path === '/webhook' || path.endsWith('/webhook'))) {
    return handleWebhook(req, res, deps);
  }

  return handleCreateCheckout(req, res, deps);
}

/**
 * Cria uma preferência de checkout para o PLANO PRO, sempre vinculada ao
 * usuário autenticado (req.user.uid) — nunca a um uid vindo do cliente.
 */
async function handleCreateCheckout(req, res, deps) {
  if (!(await runRequireAuth(req, res))) return;

  let mpClient;
  try {
    mpClient = deps.mpClient || createMercadoPagoClient();
  } catch (err) {
    console.error('[Payments] Cliente do Mercado Pago não configurado:', err.message);
    return res.status(503).json({ success: false, error: 'Pagamentos indisponíveis no momento.' });
  }

  try {
    const baseUrl = resolveAppBaseUrl(req);
    const preference = await mpClient.createPreference({
      title: 'Missão Aprovação — Plano PRO (acesso completo)',
      price: PRO_PLAN_PRICE,
      externalReference: req.user.uid,
      backUrls: {
        success: `${baseUrl}/?payment=success`,
        pending: `${baseUrl}/?payment=pending`,
        failure: `${baseUrl}/?payment=failure`,
      },
      notificationUrl: `${baseUrl}/api/payments/webhook`,
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: preference.init_point,
      preferenceId: preference.id,
    });
  } catch (err) {
    console.error('[Payments] Erro ao criar preferência de checkout:', err.message);
    return res.status(502).json({ success: false, error: 'Não foi possível iniciar o pagamento. Tente novamente em instantes.' });
  }
}

/**
 * Webhook do Mercado Pago. Público por natureza (o MP não tem sessão
 * nossa) — a autenticidade vem exclusivamente da validação de assinatura
 * + da consulta do pagamento na API do MP com o Access Token do servidor.
 */
async function handleWebhook(req, res, deps) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];
  const dataId = req.query?.['data.id'] || req.body?.data?.id;
  const type = req.body?.type || req.query?.type;

  if (!secret) {
    console.error('[Payments Webhook] MERCADOPAGO_WEBHOOK_SECRET não configurado — recusando notificação (fail-closed).');
    return res.status(401).json({ error: 'Webhook não configurado.' });
  }

  if (!verifyWebhookSignature({ xSignature, xRequestId, dataId, secret })) {
    console.warn('[Payments Webhook] Assinatura inválida ou ausente — notificação rejeitada.');
    return res.status(401).json({ error: 'Assinatura inválida.' });
  }

  if (type !== 'payment' || !dataId) {
    // Outros tópicos (merchant_order, etc.) — confirma recebimento sem agir.
    return res.status(200).json({ success: true, ignored: true });
  }

  let mpClient;
  try {
    mpClient = deps.mpClient || createMercadoPagoClient();
  } catch (err) {
    console.error('[Payments Webhook] Cliente do Mercado Pago não configurado:', err.message);
    return res.status(500).json({ error: 'Configuração de pagamentos ausente.' });
  }

  try {
    // Nunca confiar no corpo da notificação: buscamos o pagamento de
    // verdade na API do Mercado Pago com o Access Token do servidor.
    const payment = await mpClient.getPayment(dataId);
    const userId = payment.external_reference;

    if (!userId) {
      console.warn('[Payments Webhook] Pagamento sem external_reference válido:', payment.id);
      return res.status(200).json({ success: true, ignored: true });
    }

    const already = await getPaymentByMpId(String(payment.id));
    if (already) {
      // O Mercado Pago reenvia notificações; pagamento já processado antes.
      return res.status(200).json({ success: true, alreadyProcessed: true });
    }

    const inserted = await recordPayment({
      mpPaymentId: String(payment.id),
      userId,
      status: payment.status,
      statusDetail: payment.status_detail,
      amount: payment.transaction_amount,
      currency: payment.currency_id,
      plan: 'pro',
    });

    if (inserted && payment.status === 'approved') {
      const updated = await updateUser(userId, { plan: 'pro', planPrice: PRO_PLAN_PRICE_LABEL });
      if (updated) {
        await syncLeaderboardEntry({
          userId,
          name: updated.name,
          targetExam: updated.targetExam || 'Polícia Federal',
          city: updated.city || 'Brasil',
          questionsAnswered: 0,
          streak: updated.streak || 1,
          xp: updated.xp || 0,
          plan: 'pro',
        }).catch(() => {});
      }
      console.log(`[Payments] Pagamento ${payment.id} aprovado — usuário ${userId} promovido a PRO.`);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Payments Webhook] Erro ao processar notificação:', err.message);
    // 5xx faz o Mercado Pago reenviar depois — correto para falhas transitórias.
    return res.status(500).json({ error: 'Erro ao processar notificação.' });
  }
}
