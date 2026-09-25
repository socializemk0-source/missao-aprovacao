// api/config/supabase.js — precisa existir como arquivo próprio para a
// Vercel rotear "/api/config/supabase" de verdade (não só uma rota do
// Express em server.js, que a Vercel não executa como servidor único).
// Sem isso, o cliente Supabase do navegador nunca consegue buscar suas
// próprias credenciais e login/cadastro/checkout ficam todos quebrados.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeReq, makeRes } from './fixtures/http.js';

const { default: supabaseConfigHandler } = await import('../api/config/supabase.js');

test('GET /api/config/supabase devolve a URL e a anon key quando configuradas', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://exemplo.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'anon-key-de-teste';

  const req = makeReq({ method: 'GET' });
  const res = makeRes();
  supabaseConfigHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.supabaseUrl, 'https://exemplo.supabase.co');
  assert.equal(res.body.supabaseAnonKey, 'anon-key-de-teste');

  process.env.SUPABASE_URL = originalUrl;
  process.env.SUPABASE_ANON_KEY = originalKey;
});

test('GET /api/config/supabase responde 503 (nunca finge sucesso) quando a configuração falta', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;

  const req = makeReq({ method: 'GET' });
  const res = makeRes();
  supabaseConfigHandler(req, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.body.supabaseUrl, undefined);

  process.env.SUPABASE_URL = originalUrl;
  process.env.SUPABASE_ANON_KEY = originalKey;
});

test('GET /api/config/billing informa o modo de cobrança (passe por padrão, assinatura com MERCADOPAGO_BILLING_MODE=subscription)', async () => {
  const { default: billingConfigHandler } = await import('../api/config/billing.js');
  delete process.env.MERCADOPAGO_BILLING_MODE;
  let res = makeRes();
  billingConfigHandler(makeReq({ method: 'GET' }), res);
  assert.equal(res.body.mode, 'pass');

  process.env.MERCADOPAGO_BILLING_MODE = 'subscription';
  res = makeRes();
  billingConfigHandler(makeReq({ method: 'GET' }), res);
  assert.equal(res.body.mode, 'subscription');
  delete process.env.MERCADOPAGO_BILLING_MODE;
});
