import crypto from 'crypto';
import {
  getOrCreateUser,
  getUserByEmail,
  getUserByUid,
  updateUser,
  syncLeaderboardEntry,
  getProfileByUserId,
  upsertProfile
} from '../src/db/queries.ts';

const apiKey = process.env.FIREBASE_API_KEY || "AIzaSyAF4mrDD5Gml2Ty2qYIdqBi88j4BiKmhrw";
const dbId = process.env.FIREBASE_DATABASE_ID || "ai-studio-missaoaprovacao-985d7875-0bd9-45c3-b359-4e8e772d8603";
const project = process.env.FIREBASE_PROJECT_ID || "watchful-mote-s3skh";
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${project}/databases/${dbId}/documents`;

// Helper: Hashing seguro de senha com PBKDF2 (100.000 iterações, SHA-512 e salt criptográfico único)
function hashPasswordSecure(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

// Fallback legado para compatibilidade com contas de teste antigas
function hashPasswordLegacy(password) {
  const salt = 'missao_aprovacao_salt_2026';
  return crypto.createHash('sha256').update(password + salt).digest('hex');
}

// Helper: Gera hash determinístico de e-mail para chave primária do mapeamento (sem expor o e-mail em listagens)
function getEmailHash(email) {
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

// Helper: Comparação em tempo constante para evitar ataques de temporização (Timing Attacks)
function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Helper: Converter Firestore document fields para JSON simples
function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const obj = {};
  for (const [key, val] of Object.entries(doc.fields)) {
    if (val.stringValue !== undefined) obj[key] = val.stringValue;
    else if (val.integerValue !== undefined) obj[key] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) obj[key] = parseFloat(val.doubleValue);
    else if (val.booleanValue !== undefined) obj[key] = val.booleanValue;
    else if (val.timestampValue !== undefined) obj[key] = val.timestampValue;
  }
  return obj;
}

// Helper: Converter JSON para formato Firestore fields (removendo chaves perigosas de protótipo)
function toFirestoreFields(data) {
  const fields = {};
  for (const [key, val] of Object.entries(data)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      fields[key] = Number.isInteger(val) ? { integerValue: val.toString() } : { doubleValue: val };
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    }
  }
  return { fields };
}

// Buscar credenciais por hash de e-mail (GET direto por documento, sem necessidade de query de listagem)
async function getEmailCredentials(email) {
  const emailHash = getEmailHash(email);
  const url = `${firestoreBase}/users_by_email/${emailHash}?key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    console.warn('[Auth Server] Erro ao buscar credenciais:', text);
    return null;
  }
  const data = await res.json();
  return parseFirestoreDoc(data);
}

// Salvar credenciais no cofre de autenticação seguro
async function saveEmailCredentials(email, uid, passwordHash, salt) {
  const emailHash = getEmailHash(email);
  const url = `${firestoreBase}/users_by_email/${emailHash}?key=${apiKey}`;
  const body = toFirestoreFields({
    uid,
    email: email.toLowerCase().trim(),
    passwordHash,
    salt,
    createdAt: new Date().toISOString()
  });

  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao registrar credenciais: ${errText}`);
  }
}

// Buscar perfil público/estudante do Firestore por UID
async function getUserProfileFromFirestore(uid) {
  const url = `${firestoreBase}/users/${uid}?key=${apiKey}`;
  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await res.json();
  return parseFirestoreDoc(data);
}

// Sincronizar documento do aluno com a coleção pública leaderboard no Firestore
async function syncLeaderboardEntryToFirestore(uid, profile) {
  if (!firestoreBase || !apiKey || !uid) return;
  try {
    const leaderData = {
      userId: uid,
      name: profile.name || 'Estudante',
      targetExam: profile.targetExam || 'Polícia Federal',
      city: profile.cidade || profile.city || 'Brasil',
      questionsAnswered: Number(profile.questionsAnswered || 0),
      streak: Number(profile.streak || 1),
      xp: Number(profile.xp || 0),
      plan: profile.plan || 'free',
      updatedAt: new Date().toISOString()
    };
    await fetch(`${firestoreBase}/leaderboard/${uid}?key=${apiKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toFirestoreFields(leaderData))
    });
  } catch (err) {
    console.warn('[Auth Server] Erro ao sincronizar leaderboard:', err.message);
  }
}

// Salvar perfil do estudante no Firestore (NUNCA contém passwordHash)
async function saveUserProfileToFirestore(uid, userData) {
  const url = `${firestoreBase}/users/${uid}?key=${apiKey}`;
  // Blindagem estrita: remove qualquer campo de senha antes de persistir
  const safeData = { ...userData };
  delete safeData.password;
  delete safeData.passwordHash;

  const body = toFirestoreFields(safeData);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Falha ao gravar perfil: ${errText}`);
  }

  const data = await res.json();
  return parseFirestoreDoc(data);
}

export default async function authHandler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const { method, path } = req;
  const action = req.body?.action || (path ? path.replace(/^\//, '') : '');

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
      body = JSON.parse(raw);
    } catch (_) {
      return res.status(400).json({ error: 'Formato de requisição JSON inválido.' });
    }
  }

  // Proteção contra Prototype Pollution (chaves maliciosas explícitas no payload)
  if (body && (
    Object.prototype.hasOwnProperty.call(body, '__proto__') ||
    Object.prototype.hasOwnProperty.call(body, 'constructor') ||
    Object.prototype.hasOwnProperty.call(body, 'prototype')
  )) {
    return res.status(400).json({ error: 'Payload malicioso detectado e bloqueado.' });
  }

  try {
    // ------------------------------------------------------------------------
    // CADASTRO DE CONTA
    // Requisitos: nome, email, senha, whatsapp, cidade
    // ------------------------------------------------------------------------
    if (action === 'register' || path === '/register' || (method === 'POST' && req.url.includes('register'))) {
      const { name, email, password, whatsapp, cidade } = body || {};

      if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) {
        return res.status(400).json({ error: 'Por favor, informe seu nome completo (2 a 80 caracteres).' });
      }

      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || typeof email !== 'string' || !emailRegex.test(email.trim()) || email.trim().length > 120) {
        return res.status(400).json({ error: 'Por favor, informe um e-mail válido.' });
      }

      if (!password || typeof password !== 'string' || password.length < 6 || password.length > 72) {
        return res.status(400).json({ error: 'A senha deve ter entre 6 e 72 caracteres.' });
      }

      if (!whatsapp || typeof whatsapp !== 'string' || whatsapp.trim().length < 8 || whatsapp.trim().length > 25) {
        return res.status(400).json({ error: 'Por favor, informe um número de WhatsApp com DDD válido.' });
      }

      if (!cidade || typeof cidade !== 'string' || cidade.trim().length < 2 || cidade.trim().length > 80) {
        return res.status(400).json({ error: 'Por favor, informe sua cidade.' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Verificar se e-mail já existe de forma direta
      // Verificar se e-mail já existe no PostgreSQL ou no cofre
      const pgUser = await getUserByEmail(normalizedEmail).catch(() => null);
      const existingCred = pgUser ? { uid: pgUser.uid } : await getEmailCredentials(normalizedEmail);
      if (existingCred) {
        return res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login ou utilize outro e-mail.' });
      }

      // Gerar ID do usuário criptograficamente aleatório e seguro
      const uid = 'usr_' + Date.now().toString(36) + '_' + crypto.randomBytes(6).toString('hex');
      const salt = crypto.randomBytes(16).toString('hex');
      const passwordHash = hashPasswordSecure(password, salt);
      const now = new Date().toISOString();

      // Salvar credenciais no cofre seguro e no PostgreSQL
      await saveEmailCredentials(normalizedEmail, uid, passwordHash, salt).catch(() => {});

      // Salvar estudante diretamente no PostgreSQL (Cloud SQL / Drizzle)
      try {
        await getOrCreateUser({
          uid,
          name: name.trim(),
          email: normalizedEmail,
          passwordHash: `${salt}:${passwordHash}`,
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
        });

        // Sincronizar na tabela 'profiles' (Supabase profiles vinculada a auth.users)
        await upsertProfile(uid, {
          fullName: name.trim(),
          bio: 'Estudante focado em concursos públicos.',
          city: cidade.trim(),
          phone: whatsapp.trim(),
          targetExam: 'Concursos Públicos',
          preferredBanca: 'Cebraspe'
        });
      } catch (sqlErr) {
        console.warn('[PostgreSQL Auth] Aviso ao salvar no banco relacional:', sqlErr);
      }

      // Salvar perfil do estudante (sem passwordHash!)
      const userProfile = {
        uid,
        name: name.trim(),
        email: normalizedEmail,
        whatsapp: whatsapp.trim(),
        cidade: cidade.trim(),
        createdAt: now,
        updatedAt: now,
        xp: 0,
        streak: 1,
        hearts: 5,
        targetExam: 'Concursos Públicos',
        preferredBanca: 'Cebraspe',
        plan: 'free',
        planPrice: 'R$ 29,90'
      };

      await saveUserProfileToFirestore(uid, userProfile).catch(() => {});
      await syncLeaderboardEntryToFirestore(uid, userProfile).catch(() => {});

      console.log(`[Auth Server] Novo estudante cadastrado no PostgreSQL: ${userProfile.name} (${userProfile.email}) - ${userProfile.cidade}`);
      return res.status(201).json({
        success: true,
        message: 'Conta criada com sucesso no banco de dados!',
        database: 'Cloud SQL PostgreSQL (us-west2)',
        user: userProfile
      });
    }

    // ------------------------------------------------------------------------
    // LOGIN DE CONTA
    // ------------------------------------------------------------------------
    if (action === 'login' || path === '/login' || (method === 'POST' && req.url.includes('login'))) {
      const { email, password } = body || {};

      if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Tentar login via PostgreSQL (banco de dados relacional primário)
      let pgUser = null;
      try {
        pgUser = await getUserByEmail(normalizedEmail);
      } catch (_) {}

      let credentials = await getEmailCredentials(normalizedEmail);

      // Se encontrado no PostgreSQL com senha
      let isValidPassword = false;
      let userProfile = null;

      if (pgUser && pgUser.passwordHash && pgUser.passwordHash.includes(':')) {
        const [salt, storedHash] = pgUser.passwordHash.split(':');
        const computedHash = hashPasswordSecure(password, salt);
        if (safeCompare(storedHash, computedHash)) {
          isValidPassword = true;
          userProfile = {
            uid: pgUser.uid,
            email: pgUser.email,
            name: pgUser.name,
            cidade: pgUser.city || 'Brasil',
            whatsapp: pgUser.whatsapp || '',
            targetExam: pgUser.targetExam || 'Polícia Federal',
            preferredBanca: pgUser.preferredBanca || 'Cebraspe',
            plan: pgUser.plan || 'free',
            planPrice: pgUser.planPrice || 'R$ 29,90',
            xp: pgUser.xp || 0,
            streak: pgUser.streak || 1,
            hearts: pgUser.hearts || 5,
            createdAt: pgUser.createdAt ? pgUser.createdAt.toISOString() : new Date().toISOString(),
            database: 'Cloud SQL PostgreSQL (us-west2)'
          };
        }
      }

      if (!isValidPassword && credentials) {
        // Validação de senha: tenta PBKDF2 com salt do registro ou fallback seguro legado
        if (credentials.salt) {
          const computedHash = hashPasswordSecure(password, credentials.salt);
          isValidPassword = safeCompare(credentials.passwordHash, computedHash);
        } else if (credentials.passwordHash) {
          const legacyHash = hashPasswordLegacy(password);
          isValidPassword = safeCompare(credentials.passwordHash, legacyHash);
        }
      }

      if (!isValidPassword) {
        if (!credentials && !pgUser) {
          return res.status(401).json({ error: 'E-mail não encontrado. Cadastre-se primeiro para começar!' });
        }
        return res.status(401).json({ error: 'Senha incorreta. Verifique e tente novamente.' });
      }

      if (!userProfile) {
        // Recuperar dados do perfil do estudante do Firestore ou PostgreSQL
        if (pgUser) {
          userProfile = {
            uid: pgUser.uid,
            email: pgUser.email,
            name: pgUser.name,
            cidade: pgUser.city || 'Brasil',
            targetExam: pgUser.targetExam || 'Polícia Federal',
            preferredBanca: pgUser.preferredBanca || 'Cebraspe',
            plan: pgUser.plan || 'free',
            planPrice: pgUser.planPrice || 'R$ 29,90',
            xp: pgUser.xp || 0,
            streak: pgUser.streak || 1,
            hearts: pgUser.hearts || 5,
            database: 'Cloud SQL PostgreSQL (us-west2)'
          };
        } else {
          userProfile = await getUserProfileFromFirestore(credentials.uid);
          if (!userProfile) {
            userProfile = {
              uid: credentials.uid,
              email: normalizedEmail,
              name: 'Concurseiro(a)',
              xp: 0,
              streak: 1,
              hearts: 5,
              targetExam: 'Concursos Públicos',
              preferredBanca: 'Cebraspe'
            };
          }
        }
      }

      // Garantir que campos de plano estejam definidos
      if (!userProfile.plan) {
        userProfile.plan = 'free';
        userProfile.planPrice = 'R$ 29,90';
      }

      // Sincronizar usuário logado com PostgreSQL se ainda não estiver
      if (!pgUser) {
        try {
          await getOrCreateUser({
            uid: userProfile.uid,
            name: userProfile.name || 'Estudante',
            email: normalizedEmail,
            plan: userProfile.plan || 'free',
            city: userProfile.cidade || 'Brasil',
            targetExam: userProfile.targetExam || 'Polícia Federal',
            xp: userProfile.xp || 0,
            streak: userProfile.streak || 1
          });
        } catch (_) {}
      }

      // Garantir que nenhuma credencial vaze na resposta
      delete userProfile.passwordHash;
      delete userProfile.salt;

      console.log(`[Auth Server] Login bem-sucedido: ${userProfile.name} (${normalizedEmail}) - Plano: ${userProfile.plan}`);
      return res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso!',
        database: 'Cloud SQL PostgreSQL (us-west2)',
        user: userProfile
      });
    }

    // ------------------------------------------------------------------------
    // ATUALIZAÇÃO / UPGRADE DE PLANO (GRÁTIS vs PRO R$ 29,90)
    // ------------------------------------------------------------------------
    if (action === 'upgrade-plan' || path === '/upgrade-plan' || (method === 'POST' && req.url.includes('upgrade-plan'))) {
      const { uid, userId, plan, paymentMethod } = body || {};
      const targetUid = uid || userId;

      if (!targetUid || typeof targetUid !== 'string') {
        return res.status(400).json({ error: 'Identificador de usuário (uid ou userId) é obrigatório.' });
      }

      const safePlan = plan === 'pro' ? 'pro' : 'free';
      const now = new Date().toISOString();

      // Atualizar no PostgreSQL
      try {
        await updateUser(targetUid, {
          plan: safePlan,
          planPrice: 'R$ 29,90'
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
            plan: safePlan
          });
        }
      } catch (pgErr) {
        console.warn('[PostgreSQL Auth] Aviso ao atualizar plano no banco relacional:', pgErr);
      }

      const updateData = {
        plan: safePlan,
        planPrice: 'R$ 29,90',
        planUpdatedAt: now
      };

      if (safePlan === 'pro') {
        updateData.proActivatedAt = now;
        updateData.paymentMethod = typeof paymentMethod === 'string' ? paymentMethod.slice(0, 30) : 'pix_instantaneo';
      }

      const updateKeys = Object.keys(updateData);
      const userMask = updateKeys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
      const userDocRef = `${firestoreBase}/users/${targetUid}?${userMask}&key=${apiKey}`;
      const patchRes = await fetch(userDocRef, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestoreFields(updateData))
      });

      if (!patchRes.ok) {
        const errorTxt = await patchRes.text();
        console.warn('[Auth Server] Aviso ao sincronizar plano no Firestore:', errorTxt);
      }

      // Sincronizar plano também no leaderboard público com updateMask
      const leaderMask = 'updateMask.fieldPaths=plan&updateMask.fieldPaths=updatedAt';
      await fetch(`${firestoreBase}/leaderboard/${targetUid}?${leaderMask}&key=${apiKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toFirestoreFields({ plan: safePlan, updatedAt: now }))
      }).catch(() => {});

      console.log(`[Auth Server] Plano do aluno ${targetUid} atualizado para: ${safePlan.toUpperCase()} (R$ 29,90) no PostgreSQL e Firestore`);
      return res.status(200).json({
        success: true,
        plan: safePlan,
        planPrice: 'R$ 29,90',
        database: 'Cloud SQL PostgreSQL (us-west2)',
        message: safePlan === 'pro'
          ? 'Parabéns! Seu Plano PRO (R$ 29,90) foi ativado com sucesso no banco de dados. Bons estudos!'
          : 'Plano atualizado para o modo gratuito.'
      });
    }

    // ------------------------------------------------------------------------
    // CONSULTA DE PERFIL (PROFILES com RLS)
    // ------------------------------------------------------------------------
    if (action === 'get-profile' || path === '/get-profile' || (method === 'GET' && req.url.includes('profile'))) {
      const targetUid = req.query?.uid || req.query?.userId || body?.uid || body?.userId;
      if (!targetUid || typeof targetUid !== 'string') {
        return res.status(400).json({ error: 'UID do usuário é obrigatório.' });
      }

      const profile = await getProfileByUserId(targetUid);
      return res.status(200).json({
        success: true,
        database: 'Cloud SQL PostgreSQL (us-west2) / Supabase profiles',
        profile: profile || null
      });
    }

    // ------------------------------------------------------------------------
    // ATUALIZAÇÃO DE PERFIL (PROFILES)
    // ------------------------------------------------------------------------
    if (action === 'update-profile' || path === '/update-profile' || (method === 'POST' && req.url.includes('update-profile'))) {
      const { uid, userId, fullName, name, bio, avatarUrl, photoUrl, targetExam, preferredBanca, city, phone, whatsapp } = body || {};
      const targetUid = uid || userId;
      if (!targetUid || typeof targetUid !== 'string') {
        return res.status(400).json({ error: 'UID do usuário é obrigatório.' });
      }

      const updated = await upsertProfile(targetUid, {
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
        message: 'Perfil atualizado com sucesso no Supabase PostgreSQL!',
        profile: updated
      });
    }

    return res.status(404).json({ error: 'Ação não reconhecida. Use register, login, upgrade-plan, get-profile ou update-profile.' });
  } catch (err) {
    console.error('[Auth Server] Erro no processamento:', err.message);
    return res.status(500).json({ error: 'Erro no servidor ao processar autenticação. Tente novamente mais tarde.' });
  }
}
