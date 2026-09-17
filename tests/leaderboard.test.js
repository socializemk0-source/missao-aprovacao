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
