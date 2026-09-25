import { requireAuth } from '../middleware/requireAuth.js';
import { createAbacatePayClient } from '../src/payments/abacatepay.js';
import { isProActive } from '../src/plan.js';
import {
  getOrCreateUser,
  getUserByUid,
  updateUser,
  syncLeaderboardEntry,
  getProfileByUserId,
  upsertProfile,
  getSubscriptionByUserId,
  upsertSubscription
} from '../src/db/queries.js';

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

export default async function authHandler(req, res, deps = {}) {
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
    // DOWNGRADE PARA O PLANO GRÁTIS (autosserviço, sempre a própria conta)
    //
    // Virar PRO NUNCA passa mais por aqui: só o webhook da AbacatePay
    // (api/payments/webhook.js), depois de confirmar um pagamento de
    // verdade (assinatura HMAC + segredo), pode setar plan='pro'. Isso
    // fecha o HIGH-1 da auditoria (qualquer usuário logado conseguia
    // se autopromover a PRO sem pagar nada).
    //
    // O Plano PRO é uma assinatura RECORRENTE (R$ 29,90/mês) — por isso,
    // se o usuário tiver uma assinatura ativa, o downgrade precisa
    // CANCELAR ela de verdade na AbacatePay primeiro. Sem isso, o
    // usuário "vira grátis" só no nosso banco, mas continua sendo
    // cobrado todo mês.
    // ------------------------------------------------------------------------
    if (action === 'upgrade-plan' || action === 'downgrade-to-free') {
      if (!(await runRequireAuth(req, res))) return;

      const { plan } = body;
      if (plan === 'pro') {
        return res.status(403).json({
          error: 'A ativação do Plano PRO só é confirmada após uma assinatura aprovada. Use o checkout de pagamento.',
        });
      }

      const targetUid = req.user.uid;

      const subscription = await getSubscriptionByUserId(targetUid);
      if (subscription?.providerSubscriptionId && subscription.status === 'active') {
        try {
          const client = deps.abacatePayClient || createAbacatePayClient();
          await client.cancelSubscription(subscription.providerSubscriptionId);
          await upsertSubscription({
            userId: targetUid,
            providerCustomerId: subscription.providerCustomerId,
            providerSubscriptionId: subscription.providerSubscriptionId,
            status: 'cancelled',
          });
        } catch (err) {
          console.error('[Auth Server] Falha ao cancelar assinatura na AbacatePay:', err.message);
          return res.status(502).json({
            error: 'Não foi possível cancelar sua assinatura agora. Tente novamente em instantes.',
          });
        }
      }

      await updateUser(targetUid, { plan: 'free' });

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
          plan: 'free',
        }).catch(() => {});
      }

      console.log(`[Auth Server] Plano do aluno ${targetUid} revertido para o modo gratuito.`);
      return res.status(200).json({
        success: true,
        plan: 'free',
        planPrice: 'R$ 29,90',
        message: 'Plano atualizado para o modo gratuito.',
      });
    }

    // ------------------------------------------------------------------------
    // CONSULTA DE PERFIL — sempre o do próprio chamador autenticado.
    //
    // Autorrecuperação: signUp() com confirmação de e-mail exigida devolve
    // session:null, então registerUser() nunca chega a chamar sync-profile.
    // Sem isso, o primeiro login de todo usuário que precisa confirmar
    // o e-mail (o caminho normal) nunca teria uma linha em users/profiles.
    // Criamos aqui, no primeiro get-profile autenticado que encontrar essa
    // lacuna, com os dados do cadastro (via req.user, quando disponíveis) e
    // valores de fallback nunca vazios.
    // ------------------------------------------------------------------------
    if (action === 'get-profile') {
      if (!(await runRequireAuth(req, res))) return;
      let [userRecord, profileRecord] = await Promise.all([
        getUserByUid(req.user.uid),
        getProfileByUserId(req.user.uid),
      ]);

      if (!userRecord) {
        const fallbackName = req.user.name?.trim() || req.user.email?.split('@')[0] || 'Concurseiro(a)';
        const fallbackCity = req.user.cidade?.trim() || 'Brasil';
        const fallbackWhatsapp = req.user.whatsapp?.trim() || '';

        userRecord = await getOrCreateUser({
          uid: req.user.uid,
          name: fallbackName,
          email: req.user.email || '',
          targetExam: 'Concursos Públicos',
          preferredBanca: 'Cebraspe',
          city: fallbackCity,
          whatsapp: fallbackWhatsapp,
          plan: 'free',
          planPrice: 'R$ 29,90',
          xp: 0,
          streak: 1,
          hearts: 5,
        });
        profileRecord = await upsertProfile(req.user.uid, {
          fullName: fallbackName,
          bio: 'Estudante focado em concursos públicos.',
          city: fallbackCity,
          phone: fallbackWhatsapp,
          targetExam: 'Concursos Públicos',
          preferredBanca: 'Cebraspe',
        }).catch(() => profileRecord);
      }

      // Passe PRO vencido: volta para o grátis aqui mesmo (é a leitura de
      // perfil que todo carregamento do app faz), sem depender de rotina agendada.
      if (userRecord?.plan === 'pro' && !isProActive(userRecord)) {
        userRecord = (await updateUser(req.user.uid, { plan: 'free', proUntil: null })) || { ...userRecord, plan: 'free', proUntil: null };
      }

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
    //
    // PARCIAL de propósito: só entram no update os campos que o chamador
    // realmente mandou. Ex.: trocar só a banca preferida (preferredBanca)
    // não pode apagar bio/avatar/cidade/telefone já preenchidos — por
    // isso nunca inventamos um default para um campo ausente aqui; quem
    // decide "ausente vira default" é upsertProfile, e só no INSERT.
    // ------------------------------------------------------------------------
    if (action === 'update-profile') {
      if (!(await runRequireAuth(req, res))) return;

      const { fullName, name, bio, avatarUrl, photoUrl, targetExam, preferredBanca, city, phone, whatsapp } = body;

      const fields = {};

      const resolvedFullName = typeof fullName === 'string' ? fullName : (typeof name === 'string' ? name : undefined);
      if (resolvedFullName !== undefined) {
        const trimmed = resolvedFullName.trim();
        if (!trimmed) {
          return res.status(400).json({ error: 'O nome não pode ficar vazio.' });
        }
        fields.fullName = trimmed;
      }
      if (typeof bio === 'string') fields.bio = bio.slice(0, 500);
      const resolvedAvatar = typeof avatarUrl === 'string' ? avatarUrl : (typeof photoUrl === 'string' ? photoUrl : undefined);
      if (resolvedAvatar !== undefined) fields.avatarUrl = resolvedAvatar;
      if (typeof targetExam === 'string') fields.targetExam = targetExam;
      if (typeof preferredBanca === 'string') fields.preferredBanca = preferredBanca;
      if (typeof city === 'string') fields.city = city;
      const resolvedPhone = typeof phone === 'string' ? phone : (typeof whatsapp === 'string' ? whatsapp : undefined);
      if (resolvedPhone !== undefined) fields.phone = resolvedPhone;

      if (Object.keys(fields).length === 0) {
        return res.status(400).json({ error: 'Nenhum campo válido para atualizar foi enviado.' });
      }

      const updated = await upsertProfile(req.user.uid, fields);

      return res.status(200).json({
        success: true,
        message: 'Perfil atualizado com sucesso!',
        profile: updated,
      });
    }

    return res.status(404).json({ error: 'Ação não reconhecida. Use sync-profile, get-profile, update-profile ou downgrade-to-free.' });
  } catch (err) {
    console.error('[Auth Server] Erro no processamento:', err.message);
    return res.status(500).json({ error: 'Erro no servidor ao processar autenticação. Tente novamente mais tarde.' });
  }
}
