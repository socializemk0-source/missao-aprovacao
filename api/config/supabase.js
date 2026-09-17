// GET /api/config/supabase — arquivo próprio (em vez de só uma rota do
// Express) para que essa rota exista de verdade no roteamento por
// arquivo da Vercel. Sem este arquivo, /api/config/supabase nunca
// existiu como função na Vercel (só dentro do server.js, que a Vercel
// não executa como servidor único) — o cliente Supabase do navegador
// não conseguia buscar suas próprias credenciais e todo o app quebrava
// (login, cadastro, sincronização de perfil, checkout do Plano PRO).
//
// Configuração pública do Supabase Client para inicialização no
// navegador — a anon key é destinada a ser pública (a proteção real
// vem das políticas RLS e das checagens de req.user.uid no backend).
export default function supabaseConfigHandler(req, res) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('[Config] SUPABASE_URL/SUPABASE_ANON_KEY não configuradas no ambiente.');
    return res.status(503).json({ error: 'Configuração do Supabase ausente no servidor.' });
  }
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  });
}
