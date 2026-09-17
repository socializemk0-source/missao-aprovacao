// src/db/queries.js
import { db } from './index.js';
import { users, leaderboard, userProgress, essays, dailyMissions, profiles, viewedTips, subscriptions, subscriptionPayments } from './schema.js';
import { eq, desc, and, gte } from 'drizzle-orm';

// Helper: Obter ou criar usuário
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
          name: data.name,
          email: data.email,
          ...(data.targetExam ? { targetExam: data.targetExam } : {}),
          ...(data.city ? { city: data.city } : {}),
          ...(data.plan ? { plan: data.plan } : {}),
          ...(data.xp !== undefined ? { xp: data.xp } : {}),
          ...(data.streak !== undefined ? { streak: data.streak } : {}),
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

// Salvar ou atualizar perfil do estudante (Supabase profiles)
export async function upsertProfile(userId, data) {
  try {
    const result = await db.insert(profiles)
      .values({
        id: userId,
        fullName: data.fullName,
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
          fullName: data.fullName,
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

// Buscar assinatura atual do usuário (estado local do Preapproval do MP)
export async function getSubscriptionByUserId(userId) {
  try {
    const res = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionByUserId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Buscar assinatura pelo ID do Preapproval no Mercado Pago (webhook)
export async function getSubscriptionByPreapprovalId(mpPreapprovalId) {
  try {
    const res = await db.select().from(subscriptions).where(eq(subscriptions.mpPreapprovalId, mpPreapprovalId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionByPreapprovalId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Criar ou atualizar o estado da assinatura (1 linha por usuário).
export async function upsertSubscription(data) {
  try {
    const result = await db.insert(subscriptions)
      .values({
        userId: data.userId,
        mpPreapprovalId: data.mpPreapprovalId || null,
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
          ...(data.mpPreapprovalId !== undefined ? { mpPreapprovalId: data.mpPreapprovalId } : {}),
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

// Buscar cobrança recorrente já registrada por ID do Mercado Pago (chave de idempotência)
export async function getSubscriptionPaymentByMpId(mpPaymentId) {
  try {
    const res = await db.select().from(subscriptionPayments).where(eq(subscriptionPayments.mpPaymentId, mpPaymentId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getSubscriptionPaymentByMpId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Registrar cobrança recorrente processada (idempotente: onConflictDoNothing pelo mpPaymentId)
export async function recordSubscriptionPayment(data) {
  try {
    const result = await db.insert(subscriptionPayments)
      .values({
        mpPaymentId: data.mpPaymentId,
        mpPreapprovalId: data.mpPreapprovalId,
        userId: data.userId,
        status: data.status,
        amount: data.amount !== undefined ? String(data.amount) : null,
        currency: data.currency || 'BRL',
        updatedAt: new Date(),
      })
      .onConflictDoNothing({ target: subscriptionPayments.mpPaymentId })
      .returning();
    return result[0] || null; // null quando já existia (notificação duplicada do MP)
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
