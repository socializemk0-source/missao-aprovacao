import { createMercadoPagoClient, verifyWebhookSignature } from '../../src/payments/mercadopago.js';
import {
  updateUser,
  syncLeaderboardEntry,
  getSubscriptionByPreapprovalId,
  upsertSubscription,
  getSubscriptionPaymentByMpId,
  recordSubscriptionPayment,
} from '../../src/db/queries.ts';

const PRO_PLAN_PRICE_LABEL = 'R$ 29,90';

/**
 * POST /api/payments/webhook — arquivo próprio (em vez de um sub-caminho
 * despachado por req.path) para que a rota exista de verdade tanto atrás
 * do Express (server.js) quanto no roteamento por arquivo da Vercel.
 *
 * Assinatura recorrente do Plano PRO: dois tópicos de webhook importam:
 *  - subscription_preapproval: a assinatura mudou de estado (authorized,
 *    paused, cancelled) — é aqui que o PRO é liberado ou revertido.
 *  - subscription_authorized_payment: uma cobrança recorrente específica
 *    (mensal) foi processada — só entra no histórico/idempotência.
 *
 * Webhook do Mercado Pago: público por natureza (o MP não tem sessão
 * nossa) — a autenticidade vem exclusivamente da validação de assinatura
 * + da consulta do recurso na API do MP com o Access Token do servidor.
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

  if ((type !== 'subscription_preapproval' && type !== 'subscription_authorized_payment') || !dataId) {
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
    if (type === 'subscription_preapproval') {
      // Nunca confiar no corpo da notificação: buscamos a assinatura de
      // verdade na API do Mercado Pago com o Access Token do servidor.
      const subscription = await mpClient.getSubscription(dataId);
      const userId = subscription.external_reference;

      if (!userId) {
        console.warn('[Payments Webhook] Assinatura sem external_reference válido:', subscription.id);
        return res.status(200).json({ success: true, ignored: true });
      }

      await upsertSubscription({
        userId,
        mpPreapprovalId: subscription.id,
        status: subscription.status,
        amount: subscription.auto_recurring?.transaction_amount,
        currency: subscription.auto_recurring?.currency_id,
      });

      if (subscription.status === 'authorized') {
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
        console.log(`[Payments] Assinatura ${subscription.id} autorizada — usuário ${userId} promovido a PRO.`);
      } else if (subscription.status === 'cancelled' || subscription.status === 'paused') {
        // Cobre tanto o cancelamento feito pelo próprio app quanto um
        // cancelamento feito pelo usuário direto na conta do Mercado Pago.
        const updated = await updateUser(userId, { plan: 'free' });
        if (updated) {
          await syncLeaderboardEntry({
            userId,
            name: updated.name,
            targetExam: updated.targetExam || 'Polícia Federal',
            city: updated.city || 'Brasil',
            questionsAnswered: 0,
            streak: updated.streak || 1,
            xp: updated.xp || 0,
            plan: 'free',
          }).catch(() => {});
        }
        console.log(`[Payments] Assinatura ${subscription.id} (${subscription.status}) — usuário ${userId} revertido para o modo gratuito.`);
      }

      return res.status(200).json({ success: true });
    }

    // subscription_authorized_payment — uma cobrança recorrente específica.
    const authorizedPayment = await mpClient.getAuthorizedPayment(dataId);
    const preapprovalId = authorizedPayment.preapproval_id;

    if (!preapprovalId) {
      console.warn('[Payments Webhook] Cobrança recorrente sem preapproval_id válido:', authorizedPayment.id);
      return res.status(200).json({ success: true, ignored: true });
    }

    const subscription = await getSubscriptionByPreapprovalId(preapprovalId);
    const userId = subscription?.userId;
    if (!userId) {
      console.warn('[Payments Webhook] Cobrança recorrente sem assinatura local correspondente:', authorizedPayment.id);
      return res.status(200).json({ success: true, ignored: true });
    }

    const already = await getSubscriptionPaymentByMpId(String(authorizedPayment.id));
    if (already) {
      // O Mercado Pago reenvia notificações; cobrança já processada antes.
      return res.status(200).json({ success: true, alreadyProcessed: true });
    }

    await recordSubscriptionPayment({
      mpPaymentId: String(authorizedPayment.id),
      mpPreapprovalId: preapprovalId,
      userId,
      status: authorizedPayment.status,
      amount: authorizedPayment.transaction_amount,
      currency: authorizedPayment.currency_id,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[Payments Webhook] Erro ao processar notificação:', err.message);
    // 5xx faz o Mercado Pago reenviar depois — correto para falhas transitórias.
    return res.status(500).json({ error: 'Erro ao processar notificação.' });
  }
}
