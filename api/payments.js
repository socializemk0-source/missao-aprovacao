import { createMercadoPagoClient, checkoutUrlFor } from '../src/payments/mercadopago.js';
import { getSubscriptionByUserId, upsertSubscription } from '../src/db/queries.js';
import { billingMode, buildExternalReference, PLANS } from '../src/plan.js';
import { LIVE_SUBSCRIPTION_STATUSES } from '../src/payments/sync.js';
import { readBody, runRequireAuth, resolveAppBaseUrl } from '../src/payments/http.js';


/**
 * POST /api/payments — cria o checkout do Plano PRO no Mercado Pago, sempre
 * vinculado ao usuário autenticado (req.user.uid, nunca um uid do cliente).
 * Body: { cycle: 'monthly' | 'annual' }.
 *
 *  - modo "pass" (padrão): Checkout Pro — pagamento único por PIX ou cartão
 *    que dá 30 dias / 1 ano de PRO;
 *  - modo "subscription" (MERCADOPAGO_BILLING_MODE=subscription): assinatura
 *    recorrente no cartão.
 *
 * O PRO só é liberado depois que o pagamento é confirmado na API do Mercado
 * Pago (webhook ou /api/payments/confirm) — nunca aqui.
 *
 * `deps.mercadoPagoClient` existe só para os testes injetarem um cliente falso.
 */
export default async function paymentsHandler(req, res, deps = {}) {
  // POST-only de propósito: cria uma cobrança de verdade. Na Vercel cada
  // arquivo em api/ responde a QUALQUER método — um GET de bot/prefetch
  // não pode gerar checkout.
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido.' });
  }

  if (!(await runRequireAuth(req, res))) return;

  const body = await readBody(req);
  const cycle = body?.cycle ?? 'monthly';
  if (!Object.hasOwn(PLANS, cycle)) {
    return res.status(400).json({ success: false, error: 'Plano inválido.' });
  }
  const plan = PLANS[cycle];
  const mode = billingMode();

  let client;
  try {
    client = deps.mercadoPagoClient || createMercadoPagoClient();
  } catch (err) {
    console.error('[Payments] Cliente do Mercado Pago não configurado:', err.message);
    return res.status(503).json({ success: false, error: 'Pagamentos indisponíveis no momento.' });
  }

  try {
    const existing = await getSubscriptionByUserId(req.user.uid);

    // Uma assinatura que ainda cobra (ativa OU tentando cobrar de novo
    // depois de uma falha) bloqueia um checkout novo: seriam duas cobranças.
    if (existing && LIVE_SUBSCRIPTION_STATUSES.has(existing.status)) {
      return res.status(409).json({ success: false, error: 'Você já tem uma assinatura PRO ativa.' });
    }

    const baseUrl = resolveAppBaseUrl(req);
    const backUrl = `${baseUrl}/?payment=return`;

    if (mode === 'pass') {
      const preference = await client.createPreference({
        itemId: `pro-pass-${cycle}`,
        title: plan.passTitle,
        amount: plan.amount,
        externalReference: buildExternalReference('pass', cycle, req.user.uid),
        payerEmail: req.user.email,
        backUrl,
        // source_news=webhooks: só o formato novo (assinado), sem o IPN antigo.
        notificationUrl: `${baseUrl}/api/payments/webhook?source_news=webhooks`,
      });
      return res.status(200).json({ success: true, checkoutUrl: checkoutUrlFor(preference) });
    }

    // Assinatura: um link pendente anterior é cancelado antes de gerar
    // outro — senão o aluno poderia autorizar os dois e pagar em dobro.
    if (existing?.status === 'pending' && existing.providerSubscriptionId) {
      await client.cancelPreapproval(existing.providerSubscriptionId).catch((err) => {
        console.warn(`[Payments] Não foi possível cancelar o link pendente ${existing.providerSubscriptionId}:`, err.message);
      });
    }

    const preapproval = await client.createPreapproval({
      reason: plan.subscriptionReason,
      amount: plan.amount,
      frequencyMonths: plan.months,
      externalReference: buildExternalReference('sub', cycle, req.user.uid),
      payerEmail: req.user.email,
      backUrl,
    });

    await upsertSubscription({
      userId: req.user.uid,
      providerSubscriptionId: preapproval.id,
      status: 'pending',
      amount: plan.amount,
    });

    return res.status(200).json({ success: true, checkoutUrl: checkoutUrlFor(preapproval) });
  } catch (err) {
    console.error('[Payments] Erro ao criar checkout no Mercado Pago:', err.message);
    return res.status(502).json({ success: false, error: 'Não foi possível iniciar o pagamento. Tente novamente em instantes.' });
  }
}
