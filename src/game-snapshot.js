// Validação do snapshot do jogo recebido em save-game. O próprio jogo faz
// a validação completa ao carregar (XP == soma dos acertos, ids de missão
// existentes...); aqui só o necessário para o servidor guardar com
// segurança e extrair o resumo de progresso e o XP.

export const MAX_SNAPSHOT_CHARS = 200000;

export function parseGameSnapshot(state) {
  if (typeof state !== 'string' || state.length === 0) {
    return { status: 400, error: 'Estado do jogo ausente.' };
  }
  if (state.length > MAX_SNAPSHOT_CHARS) {
    return { status: 413, error: 'Estado do jogo grande demais.' };
  }

  let data;
  try {
    data = JSON.parse(state);
  } catch {
    return { status: 400, error: 'Estado do jogo inválido.' };
  }

  const records = data?.records;
  if (
    !data || data.version !== 1
    || !Number.isSafeInteger(data.xp) || data.xp < 0
    || !Array.isArray(data.completed) || data.completed.some((id) => typeof id !== 'string')
    || !records || typeof records !== 'object' || Array.isArray(records)
  ) {
    return { status: 400, error: 'Estado do jogo inválido.' };
  }

  let answered = 0;
  let correct = 0;
  for (const record of Object.values(records)) {
    if (Number.isSafeInteger(record?.attempts) && record.attempts > 0) answered += record.attempts;
    if (record?.lastCorrect === true) correct += 1;
  }

  return { xp: data.xp, completed: data.completed, answered, correct };
}
