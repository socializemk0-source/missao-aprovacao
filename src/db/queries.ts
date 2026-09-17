// src/db/queries.ts
import { db } from './index.ts';
import { users, leaderboard, userProgress, essays, dailyMissions, profiles, viewedTips } from './schema.ts';
import { eq, desc, and } from 'drizzle-orm';

// Helper: Obter ou criar usuário
export async function getOrCreateUser(data: {
  uid: string;
  name: string;
  email: string;
  passwordHash?: string;
  targetExam?: string;
  preferredBanca?: string;
  city?: string;
  whatsapp?: string;
  plan?: string;
  planPrice?: string;
  xp?: number;
  streak?: number;
  hearts?: number;
}) {
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
export async function getUserByUid(uid: string) {
  try {
    const result = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query getUserByUid failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Obter usuário por email
export async function getUserByEmail(email: string) {
  try {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error('Database query getUserByEmail failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Atualizar usuário
export async function updateUser(uid: string, fields: Partial<typeof users.$inferInsert>) {
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
export async function syncLeaderboardEntry(data: {
  userId: string;
  name: string;
  targetExam?: string;
  city?: string;
  questionsAnswered?: number;
  streak?: number;
  xp?: number;
  plan?: string;
  photoUrl?: string;
}) {
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
export async function saveUserProgress(userId: string, completedPhasesJson: string, questionsAnswered: number, correctAnswers: number) {
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
export async function getUserProgress(userId: string) {
  try {
    const res = await db.select().from(userProgress).where(eq(userProgress.userId, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getUserProgress failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar Redação
export async function saveEssay(data: {
  essayId: string;
  userId: string;
  topic: string;
  banca?: string;
  content: string;
  score?: number;
  feedback?: string;
  criterios?: string;
}) {
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
export async function getEssaysByUser(userId: string) {
  try {
    return await db.select().from(essays).where(eq(essays.userId, userId)).orderBy(desc(essays.createdAt));
  } catch (error) {
    console.error('Database query getEssaysByUser failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar / atualizar missão diária
export async function updateDailyMission(userId: string, dateStr: string, missionId: string, progress: number, target: number, completed: number, claimed: number) {
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
export async function getDailyMissions(userId: string, dateStr: string) {
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
export async function getProfileByUserId(userId: string) {
  try {
    const res = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    return res[0] || null;
  } catch (error) {
    console.error('Database query getProfileByUserId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar ou atualizar perfil do estudante (Supabase profiles)
export async function upsertProfile(userId: string, data: {
  fullName: string;
  bio?: string;
  avatarUrl?: string;
  targetExam?: string;
  preferredBanca?: string;
  city?: string;
  phone?: string;
}) {
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
export async function getViewedTipsByUserId(userId: string) {
  try {
    return await db.select().from(viewedTips).where(eq(viewedTips.userId, userId));
  } catch (error) {
    console.error('Database query getViewedTipsByUserId failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

// Salvar ou atualizar dica visualizada
export async function recordViewedTipInDb(data: {
  userId: string;
  tipId: string;
  title: string;
  banca?: string;
  mastered?: number;
  favorited?: number;
}) {
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
