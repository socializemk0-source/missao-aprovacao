import { requireAuth } from '../middleware/requireAuth.js';
import { createMercadoPagoClient } from '../src/payments/mercadopago.js';

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
 * POST /api/payments — cria uma preferência de checkout do Mercado Pago
 * para o PLANO PRO, sempre vinculada ao usuário autenticado (req.user.uid)
 * — nunca a um uid vindo do cliente.
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
