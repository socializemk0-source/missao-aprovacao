import { requireAuth } from '../middleware/requireAuth.js';
import { createMercadoPagoClient } from '../src/payments/mercadopago.js';
import { upsertSubscription } from '../src/db/queries.js';

const PRO_PLAN_PRICE = 29.90;

async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

// Sempre usar APP_BASE_URL quando configurada. Fallback via headers
// funciona tanto atrás do Express (server.js) quanto em runtimes
// serverless (Vercel) — nenhum dos dois garante req.protocol.
function resolveAppBaseUrl(req) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

/**
 * POST /api/payments — cria uma ASSINATURA (Preapproval) do Mercado Pago
 * para o PLANO PRO (R$ 29,90/mês, recorrente), sempre vinculada ao usuário
 * autenticado (req.user.uid) — nunca a um uid vindo do cliente.
 *
 * `deps.mpClient` existe só para os testes injetarem um cliente falso —
 * em produção sempre usa o client real (Access Token do ambiente).
 */
export default async function paymentsHandler(req, res, deps = {}) {
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
    const subscription = await mpClient.createSubscription({
      reason: 'Missão Aprovação — Plano PRO (assinatura mensal)',
      price: PRO_PLAN_PRICE,
      externalReference: req.user.uid,
      backUrl: `${baseUrl}/?payment=success`,
      notificationUrl: `${baseUrl}/api/payments/webhook`,
    });

    // Estado local otimista (pending) — o webhook subscription_preapproval
    // é quem confirma "authorized" de verdade e libera o PRO.
    await upsertSubscription({
      userId: req.user.uid,
      mpPreapprovalId: subscription.id,
      status: subscription.status || 'pending',
      amount: PRO_PLAN_PRICE,
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: subscription.init_point,
      preapprovalId: subscription.id,
    });
  } catch (err) {
    console.error('[Payments] Erro ao criar assinatura:', err.message);
    return res.status(502).json({ success: false, error: 'Não foi possível iniciar a assinatura. Tente novamente em instantes.' });
  }
}
