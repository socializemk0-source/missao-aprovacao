import { createMercadoPagoClient, verifyWebhookSignature } from '../../src/payments/mercadopago.js';
import { updateUser, syncLeaderboardEntry, getPaymentByMpId, recordPayment } from '../../src/db/queries.ts';

const PRO_PLAN_PRICE_LABEL = 'R$ 29,90';

/**
 * POST /api/payments/webhook — arquivo próprio (em vez de um sub-caminho
 * despachado por req.path) para que a rota exista de verdade tanto atrás
 * do Express (server.js) quanto no roteamento por arquivo da Vercel, onde
 * cada api/*.js vira uma função isolada e "/api/payments/webhook" só
 * existe de fato se houver um arquivo em api/payments/webhook.js.
 *
 * Webhook do Mercado Pago: público por natureza (o MP não tem sessão
 * nossa) — a autenticidade vem exclusivamente da validação de assinatura
 * + da consulta do pagamento na API do MP com o Access Token do servidor.
 *
 * `deps.mpClient` existe só para os testes injetarem um cliente falso.
 */
export default async function webhookHandler(req, res, deps = {}) {
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
