// CRITICAL-3 — middleware/requireAuth.js
//
// Usa createRequireAuth() com um verificador FALSO injetado (sem rede, sem
// Supabase real) para testar o contrato do middleware de forma
// determinística e rápida. O `requireAuth` default (exportado por
// middleware/requireAuth.js) usa esse mesmo contrato com um verificador
// real baseado em supabase.auth.getUser().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequireAuth } from '../middleware/requireAuth.js';
import { makeRes } from './fixtures/http.js';

// Verificador falso: só aceita o token exato "valid-token-for-userA".
async function fakeVerifyToken(token) {
  if (token === 'valid-token-for-userA') {
    return { uid: 'user_A', email: 'a@example.com' };
  }
  return null; // qualquer outro token (inválido/forjado) é rejeitado
}

const requireAuth = createRequireAuth(fakeVerifyToken);

test('1. request sem token → 401 e next() não é chamado', async () => {
  const req = { headers: {} };
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(req.user, undefined);
});

test('2. token inválido → 401 e next() não é chamado', async () => {
  const req = { headers: { authorization: 'Bearer token-forjado-invalido' } };
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
  assert.equal(req.user, undefined);
});

test('3. token válido → req.user.uid populado e next() chamado (sem 401)', async () => {
  const req = { headers: { authorization: 'Bearer valid-token-for-userA' } };
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, 200); // res.status() nunca foi chamado
  assert.deepEqual(req.user, { uid: 'user_A', email: 'a@example.com' });
});

test('4. header sem "Bearer " → 401 (formato inválido)', async () => {
  const req = { headers: { authorization: 'valid-token-for-userA' } };
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, false);
});
