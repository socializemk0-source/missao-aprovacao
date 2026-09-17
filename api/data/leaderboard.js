import { queryLeaderboardEntries } from '../../src/leaderboard.js';

// Arquivo próprio (em vez de um sub-caminho despachado por req.path) para
// que "/api/data/leaderboard" exista de verdade tanto atrás do Express
// (server.js) quanto no roteamento por arquivo da Vercel.
//
// Única leitura pública deste conjunto de rotas (gamificação) — payload já
// reduzido ao mínimo necessário em queryLeaderboardEntries.
export default async function leaderboardHandler(req, res) {
  const entries = await queryLeaderboardEntries();
  return res.status(200).json({
    success: true,
    count: entries.length,
    entries,
  });
}
