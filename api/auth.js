import { requireAuth } from '../middleware/requireAuth.js';
import {
  getOrCreateUser,
  getUserByUid,
  updateUser,
  syncLeaderboardEntry,
  getProfileByUserId,
  upsertProfile
} from '../src/db/queries.ts';

// Credenciais e sessão são 100% responsabilidade do Supabase Auth
// (supabase.auth.signUp / signInWithPassword no frontend). Este backend
// nunca vê senha nem emite sessão — ele só aceita um access token do
// Supabase (Authorization: Bearer <token>), valida via requireAuth e usa
// exclusivamente req.user.uid como identidade (nunca body/query).

async function runRequireAuth(req, res) {
  let authorized = false;
  await requireAuth(req, res, () => { authorized = true; });
  return authorized; // se false, requireAuth já respondeu 401
}

export default async function authHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const { method } = req;

  // Sanitizar e extrair body com limite de segurança
  let body = req.body;
  if (!body && (method === 'POST' || method === 'PUT')) {
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 64 * 1024) { // Limite de 64KB para payload de auth
          return res.status(413).json({ error: 'Payload de requisição muito extenso.' });
        }
        chunks.push(chunk);
      }
      const raw = Buffer.concat(chunks).toString();
      body = raw ? JSON.parse(raw) : {};
    } catch (_) {
      return res.status(400).json({ error: 'Formato de requisição JSON inválido.' });
    }
  }
  body = body || {};

  // Proteção contra Prototype Pollution (chaves maliciosas explícitas no payload)
  if (
    Object.prototype.hasOwnProperty.call(body, '__proto__') ||
    Object.prototype.hasOwnProperty.call(body, 'constructor') ||
    Object.prototype.hasOwnProperty.call(body, 'prototype')
  ) {
    return res.status(400).json({ error: 'Payload malicioso detectado e bloqueado.' });
  }

  const action = req.query?.action || body.action;

  try {
    // ------------------------------------------------------------------------
    // SINCRONIZAÇÃO DE PERFIL APÓS CADASTRO/LOGIN NO SUPABASE AUTH
    // O frontend já autenticou via supabase.auth.signUp/signInWithPassword;
    // aqui só garantimos que existe uma linha de dados de aplicação (nome,
    // whatsapp, cidade, XP...) para o uid do Supabase Auth já autenticado.
    // ------------------------------------------------------------------------
    if (action === 'sync-profile') {
      if (!(await runRequireAuth(req, res))) return;
      const uid = req.user.uid;

      const { name, whatsapp, cidade } = body;

      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        return res.status(400).json({ error: 'Por favor, informe seu nome completo (2 a 80 caracteres).' });
      }
      if (!whatsapp || typeof whatsapp !== 'string' || whatsapp.trim().length < 8 || whatsapp.trim().length > 25) {
        return res.status(400).json({ error: 'Por favor, informe um número de WhatsApp com DDD válido.' });
      }
      if (!cidade || typeof cidade !== 'string' || cidade.trim().length < 2 || cidade.trim().length > 80) {
        return res.status(400).json({ error: 'Por favor, informe sua cidade.' });
      }

      await getOrCreateUser({
        uid,
        name: name.trim(),
        email: req.user.email || '',
        targetExam: 'Concursos Públicos',
        preferredBanca: 'Cebraspe',
        city: cidade.trim(),
        whatsapp: whatsapp.trim(),
        plan: 'free',
        planPrice: 'R$ 29,90',
        xp: 0,
        streak: 1,
        hearts: 5,
      });

      await syncLeaderboardEntry({
        userId: uid,
        name: name.trim(),
        targetExam: 'Concursos Públicos',
        city: cidade.trim(),
        questionsAnswered: 0,
        streak: 1,
        xp: 0,
        plan: 'free',
      }).catch(() => {});

      await upsertProfile(uid, {
        fullName: name.trim(),
        bio: 'Estudante focado em concursos públicos.',
        city: cidade.trim(),
        phone: whatsapp.trim(),
        targetExam: 'Concursos Públicos',
        preferredBanca: 'Cebraspe',
      }).catch(() => {});

      const userRecord = await getUserByUid(uid);
      delete userRecord?.passwordHash;

      return res.status(200).json({
        success: true,
        message: 'Perfil sincronizado com sucesso.',
        user: userRecord,
      });
    }

    // ------------------------------------------------------------------------
    // ATUALIZAÇÃO / UPGRADE DE PLANO (GRÁTIS vs PRO R$ 29,90)
    // Sempre aplicado à conta do próprio chamador autenticado — nunca a um
    // uid arbitrário vindo do corpo da requisição.
    // ------------------------------------------------------------------------
    if (action === 'upgrade-plan') {
      if (!(await runRequireAuth(req, res))) return;
      const targetUid = req.user.uid;

      const { plan } = body;
      const safePlan = plan === 'pro' ? 'pro' : 'free';

      await updateUser(targetUid, {
        plan: safePlan,
        planPrice: 'R$ 29,90',
      });

      const currentUser = await getUserByUid(targetUid);
      if (currentUser) {
        await syncLeaderboardEntry({
          userId: targetUid,
          name: currentUser.name,
          targetExam: currentUser.targetExam || 'Polícia Federal',
          city: currentUser.city || 'Brasil',
          questionsAnswered: 0,
          streak: currentUser.streak || 1,
          xp: currentUser.xp || 0,
          plan: safePlan,
        }).catch(() => {});
      }

      console.log(`[Auth Server] Plano do aluno ${targetUid} atualizado para: ${safePlan.toUpperCase()} (R$ 29,90)`);
      return res.status(200).json({
        success: true,
        plan: safePlan,
        planPrice: 'R$ 29,90',
        message: safePlan === 'pro'
          ? 'Parabéns! Seu Plano PRO (R$ 29,90) foi ativado com sucesso. Bons estudos!'
          : 'Plano atualizado para o modo gratuito.',
      });
    }

    // ------------------------------------------------------------------------
    // CONSULTA DE PERFIL — sempre o do próprio chamador autenticado.
    // ------------------------------------------------------------------------
    if (action === 'get-profile') {
      if (!(await runRequireAuth(req, res))) return;
      const [userRecord, profileRecord] = await Promise.all([
        getUserByUid(req.user.uid),
        getProfileByUserId(req.user.uid),
      ]);
      if (userRecord) delete userRecord.passwordHash;
      const merged = {
        ...(userRecord || {}),
        ...(profileRecord || {}),
        uid: req.user.uid,
        email: req.user.email || userRecord?.email || null,
      };
      return res.status(200).json({
        success: true,
        profile: (userRecord || profileRecord) ? merged : null,
      });
    }

    // ------------------------------------------------------------------------
    // ATUALIZAÇÃO DE PERFIL — sempre o do próprio chamador autenticado.
    // ------------------------------------------------------------------------
    if (action === 'update-profile') {
      if (!(await runRequireAuth(req, res))) return;

      const { fullName, name, bio, avatarUrl, photoUrl, targetExam, preferredBanca, city, phone, whatsapp } = body;

      const updated = await upsertProfile(req.user.uid, {
        fullName: (fullName || name || '').trim() || 'Estudante Concurseiro',
        bio: typeof bio === 'string' ? bio.slice(0, 500) : '',
        avatarUrl: typeof avatarUrl === 'string' ? avatarUrl : (photoUrl || ''),
        targetExam: typeof targetExam === 'string' ? targetExam : 'Polícia Federal',
        preferredBanca: typeof preferredBanca === 'string' ? preferredBanca : 'Cebraspe',
        city: typeof city === 'string' ? city : 'Brasil',
        phone: typeof phone === 'string' ? phone : (whatsapp || ''),
      });

      return res.status(200).json({
        success: true,
        message: 'Perfil atualizado com sucesso!',
        profile: updated,
      });
    }

    return res.status(404).json({ error: 'Ação não reconhecida. Use sync-profile, get-profile, update-profile ou upgrade-plan.' });
  } catch (err) {
    console.error('[Auth Server] Erro no processamento:', err.message);
    return res.status(500).json({ error: 'Erro no servidor ao processar autenticação. Tente novamente mais tarde.' });
  }
}
