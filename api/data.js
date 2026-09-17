import { requireAuth } from '../middleware/requireAuth.js';
import { queryLeaderboardEntries } from '../src/leaderboard.js';
import {
  getAllUsers,
  getUserByUid,
  updateUser,
  syncLeaderboardEntry,
  saveUserProgress,
  getUserProgress,
  saveEssay,
  getEssaysByUser,
  updateDailyMission,
  getDailyMissions,
  recordViewedTipInDb,
  getViewedTipsByUserId
} from '../src/db/queries.ts';

async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

/**
 * Handler principal para dados da plataforma (progresso, redações,
 * missões, dicas, ranking). Toda ação que opera sobre dados de um usuário
 * específico exige sessão válida (requireAuth) e usa exclusivamente
 * req.user.uid — nunca um userId vindo do cliente.
 *
 * O ranking público mora em api/data/leaderboard.js (arquivo próprio, não
 * um sub-caminho despachado por req.path — ver o comentário lá).
 */
export default async function dataHandler(req, res) {
  const action = req.query?.action || req.body?.action;

  // 1.1 Progresso na Trilha (user_progress)
  if (action === 'save-progress') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { completedPhases, totalQuestionsAnswered, correctAnswers } = req.body || {};
      const saved = await saveUserProgress(req.user.uid, completedPhases || [], Number(totalQuestionsAnswered || 0), Number(correctAnswers || 0));
      return res.status(200).json({ success: true, progress: saved });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action === 'get-progress') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const prog = await getUserProgress(req.user.uid);
      return res.status(200).json({ success: true, progress: prog });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 1.1b Estatísticas do jogador (xp/streak/hearts) — sempre a própria conta
  if (action === 'save-stats') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { xp, streak, hearts } = req.body || {};
      const fields = {};
      if (Number.isFinite(Number(xp))) fields.xp = Number(xp);
      if (Number.isFinite(Number(streak))) fields.streak = Number(streak);
      if (Number.isFinite(Number(hearts))) fields.hearts = Number(hearts);
      const updated = await updateUser(req.user.uid, fields);
      if (updated) {
        await syncLeaderboardEntry({
          userId: req.user.uid,
          name: updated.name,
          targetExam: updated.targetExam || 'Polícia Federal',
          city: updated.city || 'Brasil',
          questionsAnswered: 0,
          streak: updated.streak || 1,
          xp: updated.xp || 0,
          plan: updated.plan || 'free',
        }).catch(() => {});
      }
      delete updated?.passwordHash;
      return res.status(200).json({ success: true, user: updated });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 1.2 Missões Diárias (daily_missions)
  if (action === 'save-mission') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { dateStr, missionId, progress, target, completed, claimed } = req.body || {};
      if (!dateStr || !missionId) return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes' });
      const saved = await updateDailyMission(req.user.uid, dateStr, missionId, Number(progress || 0), Number(target || 1), Number(completed || 0), Number(claimed || 0));
      return res.status(200).json({ success: true, mission: saved });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action === 'get-missions') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const dateStr = req.query?.dateStr || req.body?.dateStr;
      if (!dateStr) return res.status(400).json({ success: false, error: 'dateStr é obrigatório' });
      const missions = await getDailyMissions(req.user.uid, dateStr);
      return res.status(200).json({ success: true, missions });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 1.3 Macetes e Dicas (viewed_tips)
  if (action === 'save-tip') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { tipId, title, banca, mastered, favorited } = req.body || {};
      if (!tipId) return res.status(400).json({ success: false, error: 'tipId é obrigatório' });
      const saved = await recordViewedTipInDb({ userId: req.user.uid, tipId, title: title || 'Dica', banca, mastered, favorited });
      return res.status(200).json({ success: true, tip: saved });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action === 'get-tips') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const tips = await getViewedTipsByUserId(req.user.uid);
      return res.status(200).json({ success: true, tips });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 1.4 Redações (essays)
  if (action === 'save-essay') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { essayId, topic, banca, content, score, feedback, criterios } = req.body || {};
      if (!essayId || !content) return res.status(400).json({ success: false, error: 'essayId e content são obrigatórios' });
      const saved = await saveEssay({ essayId, userId: req.user.uid, topic: topic || 'Tema Livre', banca, content, score, feedback, criterios: typeof criterios === 'object' ? JSON.stringify(criterios) : criterios });
      return res.status(200).json({ success: true, essay: saved });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action === 'get-essays') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const userEssays = await getEssaysByUser(req.user.uid);
      return res.status(200).json({ success: true, essays: userEssays });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 2. Painel de auditoria/estatísticas agregadas — exige sessão válida e
  //    NUNCA inclui conteúdo de redação de terceiros (só contadores).
  if (!(await runRequireAuth(req, res))) return;
  try {
    const [leaderboard, allDbUsers] = await Promise.all([
      queryLeaderboardEntries(),
      getAllUsers().catch(() => []),
    ]);

    const totalQuestionsResolved = leaderboard.reduce((acc, curr) => acc + (curr.questionsAnswered || 0), 0);
    const totalXpEarned = leaderboard.reduce((acc, curr) => acc + (curr.xp || 0), 0);

    return res.status(200).json({
      success: true,
      status: 'online',
      summary: {
        totalRealStudents: allDbUsers.length,
        totalQuestionsResolved,
        totalXpEarned,
        totalChaptersAvailable: 37,
        totalPhasesAvailable: 111,
        officialBancas: ['Cebraspe (Certo/Errado)', 'FGV (Múltipla Escolha)', 'FCC', 'Vunesp'],
      },
      leaderboardRanking: leaderboard,
    });
  } catch (err) {
    console.error('[API Data] Erro ao consolidar estatísticas:', err);
    return res.status(500).json({
      success: false,
      error: 'Erro ao carregar dados agregados.',
    });
  }
}
