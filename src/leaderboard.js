import { getLeaderboard } from './db/queries.js';

/**
 * Consulta a coleção leaderboard (PostgreSQL). Campos expostos são
 * deliberadamente mínimos: este endpoint é público (gamificação), então
 * nunca deve incluir e-mail, telefone ou qualquer dado sensível.
 *
 * Nunca engole erro de banco devolvendo uma lista vazia: isso faria o
 * ranking parecer "vazio, mas funcionando" quando na verdade o banco
 * está fora do ar ou mal configurado — quem chama precisa saber que
 * falhou (ver api/data/leaderboard.js e api/data.js).
 */
export async function queryLeaderboardEntries() {
  const pgRows = await getLeaderboard();
  return pgRows.map((row) => ({
    userId: row.userId,
    name: row.name || 'Estudante',
    targetExam: row.targetExam || 'Polícia Federal',
    questionsAnswered: Number(row.questionsAnswered || 0),
    streak: Number(row.streak || 1),
    xp: Number(row.xp || 0),
    photoURL: row.photoUrl || '',
  }));
}
