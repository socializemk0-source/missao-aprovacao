import { getLeaderboard } from './db/queries.ts';

/**
 * Consulta a coleção leaderboard (PostgreSQL). Campos expostos são
 * deliberadamente mínimos: este endpoint é público (gamificação), então
 * nunca deve incluir e-mail, telefone ou qualquer dado sensível.
 */
export async function queryLeaderboardEntries() {
  try {
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
  } catch (pgErr) {
    console.warn('[Leaderboard] Aviso ao consultar leaderboard:', pgErr.message);
    return [];
  }
}
