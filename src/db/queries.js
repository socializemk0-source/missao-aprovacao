// src/db/queries.js
import { db } from './index.js';
import { users, leaderboard, userProgress, essays, dailyMissions, profiles, viewedTips, subscriptions, subscriptionPayments } from './schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

// Helper: Obter ou criar usuário.
//
// Get-or-create de verdade: só define nome/e-mail/plano/XP/streak no
// INSERT (primeira vez). Em conflito (uid já existe) NUNCA sobrescreve
// nada — nem nome/e-mail nem, principalmente, plan/xp/streak — só devolve
// a linha existente (com updatedAt tocado). Isso é o que torna as duas
// chamadas existentes (sync-profile no cadastro, e a autorrecuperação em
// get-profile) seguras para repetir: repetir uma "criação" nunca pode
// virar um reset de progresso ou de plano PRO de quem já existe.
// Para alterar dados de uma conta já existente, use updateUser/upsertProfile.
export async function getOrCreateUser(data) {
  try {
    const result = await db.insert(users)
      .values({
        uid: data.uid,
        email: data.email,
        name: data.name,
        passwordHash: data.passwordHash || '',
        targetExam: data.targetExam || 'Polícia Federal',
        preferredBanca: data.preferredBanca || 'Cebraspe',
        city: data.city || 'Brasil',
        whatsapp: data.whatsapp || '',
        plan: data.plan || 'free',
        planPrice: data.planPrice || 'R$ 29,90',
        xp: data.xp ?? 0,
        streak: data.streak ?? 1,
        hearts: data.hearts ?? 5,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query getOrCreateUser failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter usuário por UID
export async function getUserByUid(uid) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query getUserByUid failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter usuário por email
export async function getUserByEmail(email) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query getUserByEmail failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Atualizar usuário
export async function updateUser(uid, fields) {
  try {
    const result = await db.update(users)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(users.uid, uid))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query updateUser failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Sincronizar entrada no Leaderboard
export async function syncLeaderboardEntry(data) {
  try {
    const result = await db.insert(leaderboard)
      .values({
        userId: data.userId,
        name: data.name,
        targetExam: data.targetExam || 'Polícia Federal',
        city: data.city || 'Brasil',
        questionsAnswered: data.questionsAnswered ?? 0,
        streak: data.streak ?? 1,
        xp: data.xp ?? 0,
        plan: data.plan || 'free',
        photoUrl: data.photoUrl || '',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: leaderboard.userId,
        set: {
          name: data.name,
          targetExam: data.targetExam || 'Polícia Federal',
          city: data.city || 'Brasil',
          questionsAnswered: data.questionsAnswered ?? 0,
          streak: data.streak ?? 1,
          xp: data.xp ?? 0,
          plan: data.plan || 'free',
          photoUrl: data.photoUrl || '',
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query syncLeaderboardEntry failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter ranking público do Leaderboard
export async function getLeaderboard() {
  try {
    return await db.select().from(leaderboard).orderBy(desc(leaderboard.xp), desc(leaderboard.questionsAnswered));
  } catch (error) {
    console.error('Database query getLeaderboard failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar ou atualizar progresso detalhado
export async function saveUserProgress(userId, completedPhasesJson, questionsAnswered, correctAnswers) {
  try {
    const existing = await db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
    if (existing.length > 0) {
      const updated = await db.update(userProgress)
        .set({
          completedPhases: completedPhasesJson,
          totalQuestionsAnswered: questionsAnswered,
          correctAnswers: correctAnswers,
          updatedAt: new Date(),
        })
        .where(eq(userProgress.userId, userId))
        .returning();
      return updated[0];
    } else {
      const inserted = await db.insert(userProgress)
        .values({
          userId,
          completedPhases: completedPhasesJson,
          totalQuestionsAnswered: questionsAnswered,
          correctAnswers: correctAnswers,
          updatedAt: new Date(),
        })
        .returning();
      return inserted[0];
    }
  } catch (error) {
    console.error('Database query saveUserProgress failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter progresso detalhado do estudante
export async function getUserProgress(userId) {
  try {
    const res = await db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getUserProgress failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar Redação
export async function saveEssay(data) {
  try {
    const result = await db.insert(essays)
      .values({
        essayId: data.essayId,
        userId: data.userId,
        topic: data.topic,
        banca: data.banca || 'Cebraspe',
        content: data.content,
        score: data.score ?? 0,
        feedback: data.feedback || '',
        criterios: data.criterios || '{}',
        createdAt: new Date(),
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query saveEssay failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter Redações por Usuário
export async function getEssaysByUser(userId) {
  try {
    return await db.select().from(essays).where(eq(essays.userId, userId)).orderBy(desc(essays.createdAt));
  } catch (error) {
    console.error('Database query getEssaysByUser failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Contar correções de redação de um usuário desde uma data (limite
// semanal do Plano Grátis em api/redacao.js — o PRO não tem limite).
export async function countRecentEssaysByUser(userId, since) {
  try {
    const rows = await db.select({ id: essays.id }).from(essays)
      .where(and(eq(essays.userId, userId), gte(essays.createdAt, since)));
    return rows.length;
  } catch (error) {
    console.error('Database query countRecentEssaysByUser failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar / atualizar missão diária
export async function updateDailyMission(userId, dateStr, missionId, progress, target, completed, claimed) {
  try {
    const existing = await db.select().from(dailyMissions)
      .where(and(eq(dailyMissions.userId, userId), eq(dailyMissions.dateStr, dateStr), eq(dailyMissions.missionId, missionId)))
      .limit(1);

    if (existing.length > 0) {
      const res = await db.update(dailyMissions)
        .set({
          progress,
          completed,
          claimed,
          updatedAt: new Date(),
        })
        .where(eq(dailyMissions.id, existing[0].id))
        .returning();
      return res[0];
    } else {
      const res = await db.insert(dailyMissions)
        .values({
          userId,
          dateStr,
          missionId,
          progress,
          target,
          completed,
          claimed,
          updatedAt: new Date(),
        })
        .returning();
      return res[0];
    }
  } catch (error) {
    console.error('Database query updateDailyMission failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter missões diárias
export async function getDailyMissions(userId, dateStr) {
  try {
    return await db.select().from(dailyMissions)
      .where(and(eq(dailyMissions.userId, userId), eq(dailyMissions.dateStr, dateStr)));
  } catch (error) {
    console.error('Database query getDailyMissions failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter todos os usuários para o painel de auditoria
export async function getAllUsers() {
  try {
    return await db.select().from(users).orderBy(desc(users.xp));
  } catch (error) {
    console.error('Database query getAllUsers failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter perfil do estudante vinculado a auth.users
export async function getProfileByUserId(userId) {
  try {
    const res = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getProfileByUserId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar ou atualizar perfil do estudante (Supabase profiles).
//
// Atualização PARCIAL de verdade: um campo ausente de `data` (undefined)
// nunca é tocado em conflito (perfil já existente) — só campos realmente
// enviados pelo chamador entram no SET. Sem isso, trocar só a banca (por
// exemplo) apagava bio/avatar/cidade/telefone já preenchidos, porque o
// chamador antigo sempre montava um objeto completo com defaults para os
// campos que não mudaram. Defaults só valem no INSERT (perfil novo).
export async function upsertProfile(userId, data) {
  try {
    const result = await db.insert(profiles)
      .values({
        id: userId,
        fullName: data.fullName || 'Estudante Concurseiro',
        bio: data.bio || '',
        avatarUrl: data.avatarUrl || '',
        targetExam: data.targetExam || 'Polícia Federal',
        preferredBanca: data.preferredBanca || 'Cebraspe',
        city: data.city || 'Brasil',
        phone: data.phone || '',
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          ...(data.fullName !== undefined ? { fullName: data.fullName } : {}),
          ...(data.bio !== undefined ? { bio: data.bio } : {}),
          ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
          ...(data.targetExam !== undefined ? { targetExam: data.targetExam } : {}),
          ...(data.preferredBanca !== undefined ? { preferredBanca: data.preferredBanca } : {}),
          ...(data.city !== undefined ? { city: data.city } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query upsertProfile failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter dicas visualizadas do estudante
export async function getViewedTipsByUserId(userId) {
  try {
    return await db.select().from(viewedTips).where(eq(viewedTips.userId, userId));
  } catch (error) {
    console.error('Database query getViewedTipsByUserId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Buscar assinatura atual do usuário (estado local da assinatura na AbacatePay)
export async function getSubscriptionByUserId(userId) {
  try {
    const res = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionByUserId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Buscar assinatura pelo ID do provedor de pagamento (webhook)
export async function getSubscriptionByProviderSubscriptionId(providerSubscriptionId) {
  try {
    const res = await db.select().from(subscriptions).where(eq(subscriptions.providerSubscriptionId, providerSubscriptionId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionByProviderSubscriptionId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Buscar assinatura pelo customer id do provedor (webhook, quando o evento
// não repete o id da assinatura mas repete o do customer).
export async function getSubscriptionByProviderCustomerId(providerCustomerId) {
  try {
    const res = await db.select().from(subscriptions).where(eq(subscriptions.providerCustomerId, providerCustomerId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionByProviderCustomerId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Criar ou atualizar o estado da assinatura (1 linha por usuário).
export async function upsertSubscription(data) {
  try {
    const result = await db.insert(subscriptions)
      .values({
        userId: data.userId,
        providerCustomerId: data.providerCustomerId || null,
        providerSubscriptionId: data.providerSubscriptionId || null,
        status: data.status,
        plan: data.plan || 'pro',
        amount: data.amount !== undefined ? String(data.amount) : '29.90',
        currency: data.currency || 'BRL',
        nextPaymentDate: data.nextPaymentDate ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          ...(data.providerCustomerId !== undefined ? { providerCustomerId: data.providerCustomerId } : {}),
          ...(data.providerSubscriptionId !== undefined ? { providerSubscriptionId: data.providerSubscriptionId } : {}),
          status: data.status,
          ...(data.amount !== undefined ? { amount: String(data.amount) } : {}),
          ...(data.nextPaymentDate !== undefined ? { nextPaymentDate: data.nextPaymentDate } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query upsertSubscription failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Buscar cobrança recorrente já registrada por ID do provedor (chave de idempotência)
export async function getSubscriptionPaymentByProviderPaymentId(providerPaymentId) {
  try {
    const res = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.providerPaymentId, providerPaymentId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionPaymentByProviderPaymentId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Registrar cobrança recorrente processada (idempotente: onConflictDoNothing pelo providerPaymentId)
export async function recordSubscriptionPayment(data) {
  try {
    const result = await db.insert(subscriptionPayments)
      .values({
        providerPaymentId: data.providerPaymentId,
        providerSubscriptionId: data.providerSubscriptionId,
        userId: data.userId,
        status: data.status,
        amount: data.amount !== undefined ? String(data.amount) : null,
        currency: data.currency || 'BRL',
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: subscriptionPayments.providerPaymentId })
      .returning();
    return result[0] || null; // null quando já existia (notificação duplicada)
  } catch (error) {
    console.error('Database query recordSubscriptionPayment failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar ou atualizar dica visualizada
export async function recordViewedTipInDb(data) {
  try {
    const existing = await db.select().from(viewedTips)
      .where(and(eq(viewedTips.userId, data.userId), eq(viewedTips.tipId, data.tipId)))
      .limit(1);

    if (existing.length > 0) {
      const res = await db.update(viewedTips)
        .set({
          viewCount: (existing[0].viewCount || 1) + 1,
          ...(data.mastered !== undefined ? { mastered: data.mastered } : {}),
          ...(data.favorited !== undefined ? { favorited: data.favorited } : {}),
          updatedAt: new Date(),
        })
        .where(eq(viewedTips.id, existing[0].id))
        .returning();
      return res[0];
    } else {
      const res = await db.insert(viewedTips)
        .values({
          userId: data.userId,
          tipId: data.tipId,
          title: data.title,
          banca: data.banca || 'Geral',
          viewCount: 1,
          mastered: data.mastered ?? 0,
          favorited: data.favorited ?? 0,
          updatedAt: new Date(),
        })
        .returning();
      return res[0];
    }
  } catch (error) {
    console.error('Database query recordViewedTipInDb failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
