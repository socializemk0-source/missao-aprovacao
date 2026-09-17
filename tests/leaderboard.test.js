// api/data/leaderboard.js — rota pública, arquivo próprio (compatível com
// o roteamento por arquivo da Vercel, ver comentário no próprio arquivo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { createStore, buildNamedExports } from './fixtures/fake-db.js';
import { makeReq, makeRes } from './fixtures/http.js';

const queriesUrl = new URL('../src/db/queries.ts', import.meta.url).href;
const store = createStore();
mock.module(queriesUrl, { namedExports: buildNamedExports(store) });

const { default: leaderboardHandler } = await import('../api/data/leaderboard.js');

test('GET /api/data/leaderboard não exige autenticação e nunca inclui campos sensíveis', async () => {
  const req = makeReq({ method: 'GET' });
  const res = makeRes();
  await leaderboardHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.body.entries));
  for (const entry of res.body.entries) {
    assert.equal(entry.email, undefined);
    assert.equal(entry.city, undefined);
    assert.equal(entry.plan, undefined);
  }
});

test('[honestidade] quando o banco falha, a rota NUNCA finge sucesso com lista vazia — responde erro explícito', async () => {
  store.__forceLeaderboardError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  try {
    const req = makeReq({ method: 'GET' });
    const res = makeRes();
    await leaderboardHandler(req, res);

    assert.notEqual(res.statusCode, 200, 'não deve responder 200 quando o banco está fora do ar');
    assert.equal(res.body.success, false);
    assert.ok(!('entries' in res.body) || res.body.entries === undefined, 'não deve fingir uma lista vazia bem-sucedida');
  } finally {
    delete store.__forceLeaderboardError;
  }
});
