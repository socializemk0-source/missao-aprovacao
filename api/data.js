import { requireAuth } from '../middleware/requireAuth.js';
import { queryLeaderboardEntries } from '../src/leaderboard.js';
import { computeStatsUpdate } from '../src/player-stats.js';
import { parseGameSnapshot } from '../src/game-snapshot.js';
import {
  missionDefinitions,
  findMission,
  bonusChestId,
  rewardXpForMissionId,
  isClaimableDate,
  BONUS_CHEST,
} from '../src/daily-missions.js';
import {
  getAllUsers,
  getUserByUid,
  updateUser,
  syncLeaderboardEntry,
  saveUserProgress,
  getUserProgress,
  getGameSnapshot,
  saveGameSnapshot,
  getEssaysByUser,
  updateDailyMission,
  getDailyMissions,
  getClaimedMissionIds,
  claimMissionReward,
  claimBonusChest,
  recordViewedTipInDb,
  getViewedTipsByUserId
} from '../src/db/queries.js';

async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

function syncLeaderboardFor(uid, user) {
  if (!user) return Promise.resolve();
  return syncLeaderboardEntry({
    userId: uid,
    name: user.name,
    targetExam: user.targetExam || 'Polícia Federal',
    city: user.city || 'Brasil',
    questionsAnswered: 0,
    streak: user.streak || 1,
    xp: user.xp || 0,
    plan: user.plan || 'free',
  }).catch(() => {});
}

function publicUser(user) {
  if (!user) return user;
  const { passwordHash: _omit, ...rest } = user;
  return rest;
}

// save-stats e save-game passam pelas mesmas regras de integridade.
async function applyStatsUpdate(uid, input) {
  const current = await getUserByUid(uid);
  if (!current) return null;
  const claimedIds = await getClaimedMissionIds(uid);
  const rewardXp = claimedIds.reduce((sum, id) => sum + rewardXpForMissionId(id), 0);
  const fields = computeStatsUpdate({ current, input, rewardXp });
  if (Object.keys(fields).length === 0) return current;
  const updated = await updateUser(uid, fields);
  await syncLeaderboardFor(uid, updated);
  return updated;
}

function snapshotSummary(snap, withState) {
  if (!snap) return null;
  return { xp: snap.xp, updatedAt: snap.updatedAt, ...(withState ? { state: snap.state } : {}) };
}

const CLAIM_REFUSALS = {
  not_completed: 'Essa recompensa ainda não foi liberada.',
  already_claimed: 'Essa recompensa já foi resgatada.',
};

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

  // 1.1b Estatísticas do jogador (xp/streak/hearts) — sempre a própria
  // conta, e sempre passando pelas regras de src/player-stats.js.
  if (action === 'save-stats') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const updated = await applyStatsUpdate(req.user.uid, req.body || {});
      if (!updated) return res.status(404).json({ success: false, error: 'Perfil não encontrado.' });
      return res.status(200).json({ success: true, user: publicUser(updated) });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 1.1c Snapshot completo do jogo (trilha) — ver src/game-snapshot.js
  if (action === 'get-game') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const snap = await getGameSnapshot(req.user.uid);
      return res.status(200).json({ success: true, snapshot: snapshotSummary(snap, true) });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action === 'save-game') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const parsed = parseGameSnapshot(req.body?.state);
      if (parsed.error) return res.status(parsed.status).json({ success: false, error: parsed.error });

      const saved = await saveGameSnapshot(req.user.uid, req.body.state, parsed.xp);
      if (!saved) {
        const current = await getGameSnapshot(req.user.uid);
        return res.status(200).json({ success: true, accepted: false, snapshot: snapshotSummary(current, false) });
      }

      await saveUserProgress(req.user.uid, JSON.stringify(parsed.completed), parsed.answered, parsed.correct);
      await applyStatsUpdate(req.user.uid, { xp: parsed.xp });
      return res.status(200).json({ success: true, accepted: true, snapshot: snapshotSummary(saved, false) });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // 1.2 Missões Diárias (daily_missions). Meta, "concluída" e "resgatada"
  // são decididos aqui — o cliente só informa o progresso.
  if (action === 'save-mission') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { dateStr, missionId, progress } = req.body || {};
      if (!isClaimableDate(dateStr)) return res.status(400).json({ success: false, error: 'Data de missão inválida.' });
      const mission = findMission(dateStr, missionId);
      if (!mission) return res.status(400).json({ success: false, error: 'Missão desconhecida.' });
      const existing = (await getDailyMissions(req.user.uid, dateStr)).find((m) => m.missionId === missionId);
      const requested = Math.round(Number(progress) || 0);
      const safeProgress = Math.min(mission.target, Math.max(existing?.progress || 0, requested, 0));
      const saved = await updateDailyMission(
        req.user.uid, dateStr, missionId, safeProgress, mission.target,
        safeProgress >= mission.target ? 1 : 0,
        existing?.claimed ? 1 : 0,
      );
      return res.status(200).json({ success: true, mission: saved });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action === 'claim-mission' || action === 'claim-chest') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const { dateStr, missionId } = req.body || {};
      if (!isClaimableDate(dateStr)) return res.status(400).json({ success: false, error: 'Data de missão inválida.' });

      let result;
      if (action === 'claim-mission') {
        const mission = findMission(dateStr, missionId);
        if (!mission) return res.status(400).json({ success: false, error: 'Missão desconhecida.' });
        result = await claimMissionReward({
          userId: req.user.uid, dateStr, missionId, target: mission.target, xp: mission.xpReward,
        });
      } else {
        result = await claimBonusChest({
          userId: req.user.uid,
          dateStr,
          chestId: bonusChestId(dateStr),
          missionIds: missionDefinitions(dateStr).map((m) => m.id),
          requiredCompleted: BONUS_CHEST.requiredCompleted,
          xp: BONUS_CHEST.xpReward,
        });
      }

      if (result.status !== 'claimed') {
        return res.status(409).json({ success: false, code: result.status, error: CLAIM_REFUSALS[result.status] });
      }
      await syncLeaderboardFor(req.user.uid, result.user);
      return res.status(200).json({ success: true, user: publicUser(result.user) });
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

  // 1.4 Redações (essays) — só leitura aqui. Correções são gravadas
  // exclusivamente por /api/redacao, com a nota que a própria IA deu.
  if (action === 'get-essays') {
    if (!(await runRequireAuth(req, res))) return;
    try {
      const userEssays = await getEssaysByUser(req.user.uid);
      return res.status(200).json({ success: true, essays: userEssays });
    } catch (e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (action) return res.status(400).json({ success: false, error: 'Ação não reconhecida.' });

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
