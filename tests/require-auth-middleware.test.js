// CRITICAL-3 — TDD RED suite (nível middleware)
//
// Estes testes descrevem o contrato do futuro middleware/requireAuth.js
// (Supabase Auth). Ele ainda NÃO existe — por isso ambos os testes falham
// hoje ao tentar importá-lo. Essa falha É o resultado RED esperado: prova
// que não existe nenhum controle de autenticação de sessão no backend.
//
// Rodar com:
//   node --experimental-test-module-mocks --test tests/require-auth-middleware.test.js

import { test } from 'node:test';
import { makeRes } from './fixtures/http.js';

test('[RED] 1. request sem token → 401 (middleware/requireAuth.js)', async () => {
  const { requireAuth } = await import('../middleware/requireAuth.js');
  const req = { headers: {} };
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  if (res.statusCode !== 401 || nextCalled) {
    throw new Error(`esperado 401 e next() não chamado; recebido status=${res.statusCode} next=${nextCalled}`);
  }
});

test('[RED] 2. token inválido → 401 (middleware/requireAuth.js)', async () => {
  const { requireAuth } = await import('../middleware/requireAuth.js');
  const req = { headers: { authorization: 'Bearer token-forjado-invalido' } };
  const res = makeRes();
  let nextCalled = false;
  await requireAuth(req, res, () => { nextCalled = true; });
  if (res.statusCode !== 401 || nextCalled) {
    throw new Error(`esperado 401 e next() não chamado; recebido status=${res.statusCode} next=${nextCalled}`);
  }
});
