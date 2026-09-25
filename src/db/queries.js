// src/db/queries.js
import { db } from './index.js';
import { users, leaderboard, userProgress, essays, dailyMissions, profiles, viewedTips, subscriptions, subscriptionPayments, gameSnapshots } from './schema.js';
import { eq, desc, and, gte, sql } from 'drizzle-orm';

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

export async function getGameSnapshot(userId) {
  try {
    const res = await db.select().from(gameSnapshots).where(eq(gameSnapshots.userId, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getGameSnapshot failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Grava o snapshot só se ele não estiver ATRÁS do que já está salvo (o XP
// do jogo só cresce). A condição fica no próprio ON CONFLICT, então dois
// aparelhos enviando ao mesmo tempo não conseguem fazer a nuvem regredir.
// Devolve a linha gravada, ou null se foi recusado por ter menos XP.
export async function saveGameSnapshot(userId, state, xp) {
  try {
    const result = await db.insert(gameSnapshots)
      .values({ userId, state, xp, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: gameSnapshots.userId,
        set: { state, xp, updatedAt: new Date() },
        setWhere: sql`${gameSnapshots.xp} <= ${xp}`,
      })
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query saveGameSnapshot failed:', error);
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

// Reserva uma vaga na cota de correções do Plano Grátis ANTES de chamar a
// IA. Contar e inserir precisam ser uma operação só: com um count seguido
// de um insert soltos, duas requisições simultâneas do mesmo usuário viam
// "0 correções" e as duas passavam. O advisory lock por usuário (liberado
// sozinho no fim da transação) serializa só as reservas desse usuário.
// Devolve a linha reservada, ou null se a cota já estiver esgotada.
export async function reserveEssayQuota({ userId, since, limit, essay }) {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`essay_quota:${userId}`}))`);
      const rows = await tx.select({ id: essays.id }).from(essays)
        .where(and(eq(essays.userId, userId), gte(essays.createdAt, since)));
      if (rows.length >= limit) return null;
      const inserted = await tx.insert(essays)
        .values({
          essayId: essay.essayId,
          userId,
          topic: essay.topic,
          banca: essay.banca || 'Cebraspe',
          content: essay.content,
          createdAt: new Date(),
        })
        .returning();
      return inserted[0];
    });
  } catch (error) {
    console.error('Database query reserveEssayQuota failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Preenche a reserva com o resultado da correção.
export async function completeEssayReservation(essayId, { score, feedback, criterios }) {
  try {
    const result = await db.update(essays)
      .set({ score, feedback, criterios })
      .where(eq(essays.essayId, essayId))
      .returning();
    return result[0] || null;
  } catch (error) {
    console.error('Database query completeEssayReservation failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Devolve a vaga quando a correção não aconteceu (erro da IA, timeout...).
export async function releaseEssayReservation(essayId) {
  try {
    await db.delete(essays).where(eq(essays.essayId, essayId));
  } catch (error) {
    console.error('Database query releaseEssayReservation failed:', error);
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

// Ids de todas as missões/baús já resgatados pelo usuário (qualquer dia).
export async function getClaimedMissionIds(userId) {
  try {
    const rows = await db.select({ missionId: dailyMissions.missionId }).from(dailyMissions)
      .where(and(eq(dailyMissions.userId, userId), eq(dailyMissions.claimed, 1)));
    return rows.map((r) => r.missionId);
  } catch (error) {
    console.error('Database query getClaimedMissionIds failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Resgates de recompensa: checar + marcar + somar XP numa transação só,
// sob um advisory lock por usuário+dia — dois cliques (ou duas abas) ao
// mesmo tempo não podem conceder a mesma recompensa duas vezes. O XP é
// somado no próprio banco (xp = xp + n), sem ler-e-regravar.
function lockDailyRewards(tx, userId, dateStr) {
  return tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`daily_reward:${userId}:${dateStr}`}))`);
}

function addXp(tx, userId, xp) {
  return tx.update(users)
    .set({ xp: sql`coalesce(${users.xp}, 0) + ${xp}`, updatedAt: new Date() })
    .where(eq(users.uid, userId))
    .returning();
}

export async function claimMissionReward({ userId, dateStr, missionId, target, xp }) {
  try {
    return await db.transaction(async (tx) => {
      await lockDailyRewards(tx, userId, dateStr);
      const [row] = await tx.select().from(dailyMissions)
        .where(and(eq(dailyMissions.userId, userId), eq(dailyMissions.dateStr, dateStr), eq(dailyMissions.missionId, missionId)))
        .limit(1);
      if (!row || (row.progress || 0) < target) return { status: 'not_completed' };
      if (row.claimed) return { status: 'already_claimed' };
      await tx.update(dailyMissions)
        .set({ claimed: 1, completed: 1, updatedAt: new Date() })
        .where(eq(dailyMissions.id, row.id));
      const [user] = await addXp(tx, userId, xp);
      return { status: 'claimed', user };
    });
  } catch (error) {
    console.error('Database query claimMissionReward failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function claimBonusChest({ userId, dateStr, chestId, missionIds, requiredCompleted, xp }) {
  try {
    return await db.transaction(async (tx) => {
      await lockDailyRewards(tx, userId, dateStr);
      const rows = await tx.select().from(dailyMissions)
        .where(and(eq(dailyMissions.userId, userId), eq(dailyMissions.dateStr, dateStr)));
      if (rows.some((r) => r.missionId === chestId && r.claimed)) return { status: 'already_claimed' };
      if (rows.filter((r) => missionIds.includes(r.missionId) && r.completed).length < requiredCompleted) {
        return { status: 'not_completed' };
      }
      await tx.insert(dailyMissions).values({
        userId, dateStr, missionId: chestId, progress: 1, target: 1, completed: 1, claimed: 1, updatedAt: new Date(),
      });
      const [user] = await addXp(tx, userId, xp);
      return { status: 'claimed', user };
    });
  } catch (error) {
    console.error('Database query claimBonusChest failed:', error);
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
