// Fonte de verdade do SERVIDOR para metas e recompensas das missões
// diárias. Títulos e descrições exibidos ficam em fetchDailyMissions
// (public/supabase-client.js) — se mudar meta/XP lá, mude aqui também:
// é este arquivo que decide quanto XP um resgate vale de verdade.

const MISSIONS = [
  { suffix: '1', target: 5, xpReward: 50 },
  { suffix: '2', target: 5, xpReward: 55 },
  { suffix: '3', target: 1, xpReward: 80 },
  { suffix: '4', target: 1, xpReward: 40 },
];

export const BONUS_CHEST = { suffix: 'bonus', xpReward: 100, requiredCompleted: 3 };

const DAY_MS = 24 * 60 * 60 * 1000;

export function missionDefinitions(dateStr) {
  return MISSIONS.map((m) => ({ id: `daily-${dateStr}-${m.suffix}`, target: m.target, xpReward: m.xpReward }));
}

export function bonusChestId(dateStr) {
  return `daily-${dateStr}-${BONUS_CHEST.suffix}`;
}

export function findMission(dateStr, missionId) {
  return missionDefinitions(dateStr).find((m) => m.id === missionId) || null;
}

// XP de qualquer linha já resgatada (inclusive de dias anteriores), pelo
// sufixo do id — usado para separar "XP de recompensas" do "XP do jogo".
export function rewardXpForMissionId(missionId) {
  const suffix = typeof missionId === 'string' ? missionId.slice(missionId.lastIndexOf('-') + 1) : '';
  if (suffix === BONUS_CHEST.suffix) return BONUS_CHEST.xpReward;
  return MISSIONS.find((m) => m.suffix === suffix)?.xpReward || 0;
}

// Só o dia corrente (UTC, igual ao toISOString() do cliente) e o anterior,
// para quem resgata logo depois da meia-noite. Sem isso, dava pra
// "farmar" XP resgatando as mesmas missões em qualquer data.
export function isClaimableDate(dateStr, now = Date.now()) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const today = new Date(now).toISOString().split('T')[0];
  const yesterday = new Date(now - DAY_MS).toISOString().split('T')[0];
  return dateStr === today || dateStr === yesterday;
}
