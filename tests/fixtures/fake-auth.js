// Dublê de middleware/requireAuth.js para os testes de handler — sem rede,
// sem Supabase real. Convenção de teste: um "token válido" tem o formato
// "TEST:<uid>"; qualquer outra coisa (ausente, malformado, forjado) é 401,
// exatamente como o middleware real faria para um token que a verificação
// no Supabase rejeitasse.

export async function requireAuth(req, res, next) {
  const header = req.headers?.authorization || '';
  const match = /^Bearer\s+TEST:(.+)$/.exec(header.trim());
  if (!match) {
    return res.status(401).json({ error: 'Autenticação necessária. Faça login novamente.' });
  }
  req.user = { uid: match[1], email: `${match[1]}@test.local` };
  return next();
}

export default requireAuth;
