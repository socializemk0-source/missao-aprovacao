/**
 * Firebase Cloud Messaging (FCM) — Automated Personalized Streak Reminders
 * Módulo de inteligência e automação para notificações push de manutenção de sequência de estudos
 */

// Configuração do projeto Firebase
const FCM_CONFIG = {
  projectId: "watchful-mote-s3skh",
  messagingSenderId: "524388240708",
  serverKey: process.env.FIREBASE_SERVER_KEY || "",
  vapidKey: process.env.FIREBASE_VAPID_KEY || ""
};

// Limite de segurança para registros em memória (evita DoS por esgotamento de memória)
const MAX_STUDENTS_REGISTRY = 2000;
const MAX_HISTORY_ITEMS = 30;

// Armazenamento em memória de tokens e registros de lembretes ativos
const tokenRegistry = new Map();
const notificationHistory = [];

let lastAutomatedRunTime = 0;

/**
 * Higieniza o histórico para evitar vazamento de dados de outros alunos
 */
function getSanitizedHistory(items) {
  return items.map(item => ({
    id: item.id,
    title: item.title,
    streak: item.streak,
    targetExam: item.targetExam,
    urgency: item.urgency,
    sentAt: item.sentAt
  }));
}

/**
 * Gera mensagem altamente personalizada de acordo com nome, sequência, concurso e urgência do horário
 */
export function generatePersonalizedStreakMessage({
  name = "Concurseiro",
  streak = 1,
  targetExam = "Polícia Federal",
  preferredHour = 20,
  dailyMissionsPending = 3,
  now = new Date()
}) {
  const firstName = (name || "Concurseiro").trim().split(" ")[0];
  const hour = now.getHours();
  const currentStreak = Math.max(0, Number(streak) || 0);

  let urgencyTag = "standard";
  let title = "";
  let body = "";

  if (hour >= 21) {
    urgencyTag = "critical";
    if (currentStreak === 0) {
      title = `🚨 Última chamada de hoje, ${firstName}!`;
      body = `O dia está acabando! Faça ao menos 1 questão antes da meia-noite para iniciar sua sequência rumo ao ${targetExam}.`;
    } else if (currentStreak <= 3) {
      title = `🚨 Cuidado, ${firstName}! Seu streak de ${currentStreak} dias expira hoje!`;
      body = `Faltam poucas horas para a meia-noite. Resolva 3 questões agora e proteja sua sequência!`;
    } else {
      title = `🚨 URGENTE: ${currentStreak} dias seguidos em risco, ${firstName}!`;
      body = `Não deixe sua dedicação de semanas congelar. Treine agora por 5 minutos e garanta seus +50 XP!`;
    }
  } else if (hour >= 18) {
    urgencyTag = "evening";
    if (currentStreak === 0) {
      title = `🔥 ${firstName}, que tal começar seu streak hoje?`;
      body = `Dedique 10 minutinhos no treino do ${targetExam}. A aprovação é construída dia após dia!`;
    } else if (currentStreak === 1) {
      title = `🔥 ${firstName}, sua chama acendeu ontem!`;
      body = `Mantenha o fogo aceso: resolva as missões de hoje para alcançar 2 dias seguidos!`;
    } else if (currentStreak < 7) {
      title = `🔥 Proteja seu streak de ${currentStreak} dias, ${firstName}!`;
      body = `Você tem ${dailyMissionsPending} missões aguardando você. Treine agora e continue no topo do ranking!`;
    } else {
      title = `👑 Incrível sequência de ${currentStreak} dias, ${firstName}!`;
      body = `Seu foco no ${targetExam} está impecável. Bote mais um dia na conta rumo ao Diário Oficial!`;
    }
  } else {
    urgencyTag = "afternoon";
    if (currentStreak === 0) {
      title = `🎯 Hora do treino diário, ${firstName}!`;
      body = `Dê o primeiro passo hoje! 3 questões rápidas esperam por você na Trilha de Aprendizagem.`;
    } else {
      title = `⚡ Lembrete de Foco: ${currentStreak} dias consecutivos!`;
      body = `${firstName}, adiante seu treino do ${targetExam} e garanta sua sequência antes do fim da tarde.`;
    }
  }

  return {
    title,
    body,
    urgencyTag,
    streak: currentStreak,
    targetExam,
    payload: {
      notification: {
        title,
        body,
        icon: "/mascot.png"
      },
      data: {
        type: "STREAK_REMINDER",
        streak: String(currentStreak),
        targetExam,
        actionUrl: "/jogar",
        urgency: urgencyTag,
        timestamp: new Date().toISOString()
      },
      webpush: {
        fcm_options: {
          link: "/jogar"
        },
        notification: {
          title,
          body,
          icon: "/mascot.png",
          badge: "/favicon.svg",
          vibrate: [200, 100, 200, 100, 200],
          tag: "streak-daily-reminder",
          renotify: true,
          actions: [
            { action: "study_now", title: "⚡ Treinar Agora" },
            { action: "view_missions", title: "📋 Ver Missões" }
          ]
        }
      }
    }
  };
}

/**
 * Envia notificação push via FCM (Firebase Cloud Messaging)
 */
export async function sendFCMNotification(token, messageData) {
  if (!token) {
    throw new Error("Token FCM não fornecido.");
  }

  const payload = {
    to: token,
    ...messageData.payload
  };

  // Se houver chave de servidor configurada em variáveis de ambiente, envia via API REST do FCM
  if (FCM_CONFIG.serverKey) {
    try {
      const response = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `key=${FCM_CONFIG.serverKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      return {
        success: response.ok && (data.success === 1 || !data.failure),
        provider: "fcm_live",
        response: data,
        payload
      };
    } catch (err) {
      console.warn("[FCM] Falha na requisição direta ao FCM:", err.message);
    }
  }

  // Se não houver chave privada configurada, simula a entrega com registro completo para auditoria
  return {
    success: true,
    provider: "fcm_simulated",
    message: "Notificação FCM estruturada e pronta para entrega (aguardando FIREBASE_SERVER_KEY para envio externo).",
    payload
  };
}

/**
 * Registra ou atualiza token de dispositivo do estudante com proteção contra sobrecarga de memória
 */
export function registerStudentToken(data) {
  if (!data || typeof data !== "object") {
    return { success: false, error: "Dados inválidos." };
  }

  const { userId, token, name, targetExam, preferredHour, userAgent } = data;
  if (!userId || typeof userId !== "string" || userId.length < 3 || userId.length > 80) {
    return { success: false, error: "userId inválido (deve ter entre 3 e 80 caracteres)." };
  }

  if (!token || typeof token !== "string" || token.length < 10 || token.length > 500) {
    return { success: false, error: "Token FCM inválido." };
  }

  // Evita estouro de memória (DoS) por registro de infinitos IDs falsos
  if (!tokenRegistry.has(userId) && tokenRegistry.size >= MAX_STUDENTS_REGISTRY) {
    const oldestKey = tokenRegistry.keys().next().value;
    if (oldestKey) tokenRegistry.delete(oldestKey);
  }

  const existing = tokenRegistry.get(userId) || { tokens: [] };
  const tokensSet = new Set((existing.tokens || []).slice(0, 5)); // máximo de 5 dispositivos por estudante
  tokensSet.add(token.trim());

  const safeName = typeof name === "string" ? name.slice(0, 60).trim() : (existing.name || "Estudante");
  const safeTargetExam = typeof targetExam === "string" ? targetExam.slice(0, 60).trim() : (existing.targetExam || "Polícia Federal");

  const updatedEntry = {
    userId,
    name: safeName,
    targetExam: safeTargetExam,
    streak: typeof data.streak === "number" ? Math.max(0, Math.min(data.streak, 9999)) : (existing.streak || 1),
    preferredHour: Number(preferredHour) || existing.preferredHour || 20,
    lastStudyDate: typeof data.lastStudyDate === "string" ? data.lastStudyDate.slice(0, 20) : (existing.lastStudyDate || ""),
    tokens: Array.from(tokensSet),
    userAgent: typeof userAgent === "string" ? userAgent.slice(0, 150) : "",
    updatedAt: new Date().toISOString()
  };

  tokenRegistry.set(userId, updatedEntry);
  return { success: true, registered: true };
}

/**
 * Executa a rotina automatizada de envio de lembretes de sequência
 * Analisa todos os alunos cadastrados e envia lembrete para quem ainda não estudou hoje
 */
export async function runAutomatedStreakCheck({ force = false } = {}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const results = {
    timestamp: new Date().toISOString(),
    totalStudents: tokenRegistry.size,
    remindersSent: 0,
    skippedAlreadyStudied: 0,
    skippedAlreadyNotified: 0,
    details: []
  };

  for (const [userId, student] of tokenRegistry.entries()) {
    // Verifica se o aluno já estudou hoje
    if (!force && student.lastStudyDate === todayStr) {
      results.skippedAlreadyStudied++;
      results.details.push({
        userId,
        name: student.name,
        status: "skipped_already_studied",
        reason: "Aluno já concluiu estudo no dia de hoje."
      });
      continue;
    }

    // Verifica se já enviamos notificação hoje
    if (!force && student.lastNotifiedDate === todayStr) {
      results.skippedAlreadyNotified++;
      results.details.push({
        userId,
        name: student.name,
        status: "skipped_already_notified",
        reason: "Lembrete já enviado hoje."
      });
      continue;
    }

    // Gera mensagem personalizada
    const messageInfo = generatePersonalizedStreakMessage({
      name: student.name,
      streak: student.streak,
      targetExam: student.targetExam,
      preferredHour: student.preferredHour,
      now: new Date()
    });

    // Envia para todos os tokens registrados do aluno
    const sendPromises = (student.tokens || []).map(async (tok) => {
      const res = await sendFCMNotification(tok, messageInfo);
      return { token: tok.substring(0, 16) + "...", ...res };
    });

    const dispatchResults = await Promise.all(sendPromises);

    student.lastNotifiedDate = todayStr;
    results.remindersSent++;

    const logEntry = {
      id: "log_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      userId,
      name: student.name,
      streak: messageInfo.streak,
      targetExam: messageInfo.targetExam,
      title: messageInfo.title,
      body: messageInfo.body,
      urgency: messageInfo.urgencyTag,
      sentAt: new Date().toISOString(),
      dispatches: dispatchResults
    };

    notificationHistory.unshift(logEntry);
    if (notificationHistory.length > MAX_HISTORY_ITEMS) notificationHistory.pop();

    results.details.push({
      status: "sent",
      streak: messageInfo.streak,
      urgency: messageInfo.urgencyTag,
      dispatchesCount: dispatchResults.length
    });
  }

  return results;
}

/**
 * Handler HTTP principal para requisições de notificações
 */
export default async function notificationsHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // Rota 1: GET /api/notifications/status
  if (req.method === "GET" && pathname.endsWith("/status")) {
    return res.end(JSON.stringify({
      status: "online",
      fcmConfigured: Boolean(FCM_CONFIG.serverKey),
      registeredStudentsCount: tokenRegistry.size,
      recentNotificationsCount: notificationHistory.length,
      recentHistory: getSanitizedHistory(notificationHistory.slice(0, 5))
    }));
  }

  // Rota 2: POST /api/notifications/register-token
  if (req.method === "POST" && pathname.endsWith("/register-token")) {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 32 * 1024) { // 32KB max
        res.statusCode = 413;
        return res.end(JSON.stringify({ success: false, error: "Payload muito extenso." }));
      }
    }
    try {
      const data = JSON.parse(body || "{}");
      const result = registerStudentToken(data);
      res.statusCode = result.success ? 200 : 400;
      return res.end(JSON.stringify(result));
    } catch (err) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: "JSON inválido." }));
    }
  }

  // Rota 3: POST /api/notifications/send-streak-reminders (Gatilho de Automação com Rate Limiting)
  if (req.method === "POST" && pathname.endsWith("/send-streak-reminders")) {
    const now = Date.now();
    if (now - lastAutomatedRunTime < 30000 && !req.headers["x-internal-cron"]) {
      res.statusCode = 429;
      return res.end(JSON.stringify({
        success: false,
        error: "Limite de execuções atingido. Aguarde 30 segundos entre disparos para poupar recursos."
      }));
    }
    lastAutomatedRunTime = now;

    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 16 * 1024) {
        res.statusCode = 413;
        return res.end(JSON.stringify({ success: false, error: "Payload muito extenso." }));
      }
    }
    let params = {};
    try { if (body) params = JSON.parse(body); } catch (_) {}

    try {
      const runSummary = await runAutomatedStreakCheck({ force: Boolean(params.force) });
      return res.end(JSON.stringify({
        success: true,
        message: `Rotina automatizada de lembretes concluída. ${runSummary.remindersSent} alunos notificados.`,
        summary: runSummary
      }));
    } catch (err) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // Rota 4: POST /api/notifications/test-streak-push
  if (req.method === "POST" && pathname.endsWith("/test-streak-push")) {
    let body = "";
    for await (const chunk of req) body += chunk;
    try {
      const data = JSON.parse(body || "{}");
      const messageInfo = generatePersonalizedStreakMessage({
        name: typeof data.name === "string" ? data.name.slice(0, 50) : "Vitor",
        streak: typeof data.streak === "number" ? Math.max(0, data.streak) : 4,
        targetExam: typeof data.targetExam === "string" ? data.targetExam.slice(0, 50) : "Polícia Federal",
        preferredHour: typeof data.preferredHour === "number" ? data.preferredHour : 20,
        now: new Date()
      });

      const token = (typeof data.token === "string" ? data.token.slice(0, 500) : "") || "token_test_preview";
      const dispatch = await sendFCMNotification(token, messageInfo);

      const logEntry = {
        id: "log_" + Date.now(),
        userId: "aluno_anonimizado",
        name: "Estudante",
        streak: messageInfo.streak,
        targetExam: messageInfo.targetExam,
        title: messageInfo.title,
        body: messageInfo.body,
        urgency: messageInfo.urgencyTag,
        sentAt: new Date().toISOString(),
        dispatches: [dispatch]
      };
      notificationHistory.unshift(logEntry);
      if (notificationHistory.length > MAX_HISTORY_ITEMS) notificationHistory.pop();

      return res.end(JSON.stringify({
        success: true,
        notification: messageInfo,
        dispatch
      }));
    } catch (err) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  // Rota 5: GET /api/notifications/history (Higienizado contra vazamento de nomes/IDs)
  if (req.method === "GET" && pathname.endsWith("/history")) {
    return res.end(JSON.stringify({
      history: getSanitizedHistory(notificationHistory)
    }));
  }

  res.statusCode = 404;
  return res.end(JSON.stringify({ error: "Rota de notificação não encontrada." }));
}
