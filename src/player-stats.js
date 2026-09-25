// Regras de integridade para o que o cliente informa em save-stats.
//
// O XP do jogo nasce no navegador (as questões e o gabarito vêm no bundle
// compilado), então o servidor não tem como validar cada resposta. O que
// dá pra garantir aqui: nada negativo, nada acima do que o tempo permite,
// e um sync nunca apaga o que já estava salvo.

export const MAX_HEARTS = 5;
export const XP_BURST = 500;
export const XP_PER_MINUTE = 120;

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// `rewardXp` é o XP já concedido pelo servidor em resgates de missões/baú:
// fica fora da conta do "XP do jogo" que o cliente informa, para que um
// sync do jogo nunca apague recompensas (nem as conte duas vezes).
export function computeStatsUpdate({ current, input, rewardXp = 0, now = Date.now() }) {
  const fields = {};

  const hearts = toInt(input.hearts);
  if (hearts !== null) fields.hearts = Math.min(MAX_HEARTS, Math.max(0, hearts));

  const streak = toInt(input.streak);
  if (streak !== null) {
    const createdAt = current.createdAt ? new Date(current.createdAt).getTime() : now;
    const accountAgeDays = Math.floor(Math.max(0, now - createdAt) / DAY_MS);
    fields.streak = Math.min(accountAgeDays + 1, Math.max(0, streak));
  }

  const xp = toInt(input.xp);
  if (xp !== null) {
    const storedGameXp = Math.max(0, (current.xp || 0) - rewardXp);
    const lastWrite = new Date(current.updatedAt || current.createdAt || now).getTime();
    const elapsedMinutes = Math.max(0, now - lastWrite) / MINUTE_MS;
    const allowance = XP_BURST + XP_PER_MINUTE * elapsedMinutes;
    // Acima do permitido é cortado, não recusado: o cliente sempre manda o
    // total absoluto, então o restante entra no próximo sync.
    const gameXp = Math.max(storedGameXp, Math.min(Math.max(0, xp), Math.floor(storedGameXp + allowance)));
    fields.xp = gameXp + rewardXp;
  }

  return fields;
}
