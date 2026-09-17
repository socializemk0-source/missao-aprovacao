/**
 * Firebase Cloud Messaging (FCM) — Client Notification Controller & UI
 * Missão Aprovação — Gerenciador de Lembretes de Sequência de Estudos
 */
(function () {
  'use strict';

  // Áudio da notificação (acorde suave C5-E5-G5 Duolingo Style)
  let audioCtx = null;
  function playNotificationChime() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.06, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.4);
      });
    } catch (_) {}
  }

  // Toast Container
  let toastContainer = null;
  function ensureToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'fcm-toast-container';
      toastContainer.id = 'fcm-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  // Exibir notificação em primeiro plano com interação rica
  function showForegroundToast(title, body, data = {}) {
    playNotificationChime();
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = 'fcm-toast';
    toast.id = 'fcm-toast-' + Date.now();

    const streakCount = data.streak || localStorage.getItem('vlp_streak_count') || '4';

    toast.innerHTML = `
      <div class="fcm-toast-icon">🔥</div>
      <div class="fcm-toast-content">
        <div class="fcm-toast-title">${title || '🔥 Proteja seu Streak de Estudos!'}</div>
        <div class="fcm-toast-body">${body || 'Não deixe sua sequência de questões zerar hoje!'}</div>
        <div class="fcm-toast-actions">
          <button class="fcm-toast-btn" id="fcm-toast-act-${Date.now()}">⚡ Treinar Agora</button>
          <button class="fcm-toast-close" title="Fechar">&times;</button>
        </div>
      </div>
    `;

    // Eventos
    const actBtn = toast.querySelector('.fcm-toast-btn');
    const closeBtn = toast.querySelector('.fcm-toast-close');

    const removeToast = () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };

    actBtn.addEventListener('click', () => {
      removeToast();
      // Rola para a trilha ou abre primeira fase ativa
      const activePhase = document.querySelector('.vlp-phase-btn:not(.locked)');
      if (activePhase) {
        activePhase.scrollIntoView({ behavior: 'smooth', block: 'center' });
        activePhase.click();
      } else {
        window.location.href = '/jogar';
      }
    });

    closeBtn.addEventListener('click', removeToast);

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto-dismiss após 8 segundos
    setTimeout(() => {
      if (document.body.contains(toast)) {
        removeToast();
      }
    }, 8000);
  }

  // Criar ou obter modal de notificações FCM
  let modalOverlay = null;

  function createNotificationModal() {
    if (modalOverlay) return modalOverlay;

    modalOverlay = document.createElement('div');
    modalOverlay.className = 'fcm-modal-overlay';
    modalOverlay.id = 'fcm-streak-modal-overlay';

    modalOverlay.innerHTML = `
      <div class="fcm-modal" id="fcm-streak-modal">
        <div class="fcm-modal-header">
          <div class="fcm-modal-title">
            <span style="font-size: 24px;">🔔</span>
            <div>
              <div>Lembretes de Sequência (FCM Push)</div>
              <div style="font-size: 12px; font-weight: 500; color: #64748b;">Notificações automatizadas e personalizadas</div>
            </div>
          </div>
          <button class="fcm-modal-close" id="fcm-modal-close-btn">&times;</button>
        </div>

        <div class="fcm-modal-body">
          <!-- Card de Status da Permissão -->
          <div class="fcm-status-card">
            <div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">Status do Firebase Push</div>
              <div style="font-size: 12.5px; color: #64748b;" id="fcm-perm-desc">Verificando permissão do navegador...</div>
            </div>
            <div id="fcm-perm-badge" class="fcm-status-pill pending">⏳ Verificando</div>
          </div>

          <!-- Botão de Ativação -->
          <button class="fcm-btn-duo-green" id="fcm-enable-btn">
            <span>🔔</span>
            <span>Ativar Lembretes de Sequência no Navegador</span>
          </button>

          <!-- Teste Imediato -->
          <button class="fcm-btn-duo-orange" id="fcm-test-btn">
            <span>🚀</span>
            <span>Testar Notificação de Sequência Agora</span>
          </button>

          <!-- Executar Rotina Automática -->
          <button class="fcm-btn-duo-outline" id="fcm-scheduler-btn">
            <span>⚡</span>
            <span>Executar Rotina Automática de Lembretes (Simular Cron)</span>
          </button>

          <!-- Configurações de Personalização -->
          <div style="border-top: 1.5px solid #f1f5f9; padding-top: 16px;">
            <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; margin-bottom: 10px;">
              ⚙️ Preferências de Personalização
            </div>

            <div class="fcm-setting-row">
              <span>Horário do Lembrete Diário:</span>
              <select class="fcm-setting-select" id="fcm-time-select">
                <option value="18">18:00 (Fim de Tarde)</option>
                <option value="19">19:00 (Início da Noite)</option>
                <option value="20" selected>20:00 (Recomendado)</option>
                <option value="21">21:00 (Última Chamada)</option>
              </select>
            </div>

            <div class="fcm-setting-row">
              <span>Alerta de Urgência Noturna (às 22h):</span>
              <input type="checkbox" id="fcm-urgency-check" checked style="width: 18px; height: 18px; accent-color: #f97316; cursor: pointer;">
            </div>

            <div class="fcm-setting-row">
              <span>Som com o Mascote Tico:</span>
              <input type="checkbox" id="fcm-sound-check" checked style="width: 18px; height: 18px; accent-color: #58cc02; cursor: pointer;">
            </div>
          </div>

          <!-- Log de Auditoria Recente -->
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
              📋 Histórico de Disparos Recentes
            </div>
            <div class="fcm-log-box" id="fcm-log-container">
              <div style="text-align: center; color: #94a3b8; padding: 12px;">Nenhum disparo registrado nesta sessão.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    // Eventos do modal
    const closeBtn = modalOverlay.querySelector('#fcm-modal-close-btn');
    closeBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });

    const enableBtn = modalOverlay.querySelector('#fcm-enable-btn');
    enableBtn.addEventListener('click', handleEnableNotifications);

    const testBtn = modalOverlay.querySelector('#fcm-test-btn');
    testBtn.addEventListener('click', handleTestPush);

    const schedulerBtn = modalOverlay.querySelector('#fcm-scheduler-btn');
    schedulerBtn.addEventListener('click', handleRunScheduler);

    return modalOverlay;
  }

  function updateModalUI() {
    if (!modalOverlay) return;
    const badge = modalOverlay.querySelector('#fcm-perm-badge');
    const desc = modalOverlay.querySelector('#fcm-perm-desc');
    const enableBtn = modalOverlay.querySelector('#fcm-enable-btn');

    if (!('Notification' in window)) {
      badge.className = 'fcm-status-pill inactive';
      badge.textContent = '❌ Incompatível';
      desc.textContent = 'Este navegador não suporta notificações Push da Web.';
      enableBtn.style.display = 'none';
      return;
    }

    const perm = Notification.permission;
    if (perm === 'granted') {
      badge.className = 'fcm-status-pill active';
      badge.textContent = '✅ Ativo e Pronto';
      desc.textContent = 'Notificações push ativadas. Você receberá lembretes diários.';
      enableBtn.innerHTML = '<span>✅</span><span>Lembretes Ativos (Clique para Re-sincronizar)</span>';
      updateBellBadge(true);
    } else if (perm === 'denied') {
      badge.className = 'fcm-status-pill inactive';
      badge.textContent = '🚫 Bloqueado';
      desc.textContent = 'Notificações bloqueadas nas configurações do navegador.';
      enableBtn.innerHTML = '<span>⚠️</span><span>Permissão Bloqueada no Navegador</span>';
      updateBellBadge(false);
    } else {
      badge.className = 'fcm-status-pill pending';
      badge.textContent = '⚠️ Desativado';
      desc.textContent = 'Ative para não perder sua sequência de dias e seus XP!';
      enableBtn.innerHTML = '<span>🔔</span><span>Ativar Notificações Push no Navegador</span>';
      updateBellBadge(false);
    }
  }

  function updateBellBadge(isActive) {
    const bells = document.querySelectorAll('.fcm-bell-badge');
    bells.forEach(b => {
      if (isActive) b.classList.add('active');
      else b.classList.remove('active');
    });
  }

  function openModal() {
    const modal = createNotificationModal();
    updateModalUI();
    loadNotificationLogs();
    modal.classList.add('open');
  }

  function closeModal() {
    if (modalOverlay) {
      modalOverlay.classList.remove('open');
    }
  }

  // Manipulador para ativar notificações
  async function handleEnableNotifications() {
    const enableBtn = modalOverlay.querySelector('#fcm-enable-btn');
    const oldText = enableBtn.innerHTML;
    enableBtn.disabled = true;
    enableBtn.innerHTML = '<span>⏳</span><span>Registrando no Firebase Cloud Messaging...</span>';

    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      const userId = user ? user.uid : (localStorage.getItem('vlp_local_uid') || 'aluno_duolingo');
      const timeSelect = modalOverlay.querySelector('#fcm-time-select');

      const result = await window.FirebaseApplet.enableStreakNotifications(userId, {
        name: user?.displayName || localStorage.getItem('vlp_user_name') || 'Concurseiro(a)',
        targetExam: localStorage.getItem('vlp_target_exam') || 'Polícia Federal',
        streak: Number(localStorage.getItem('vlp_streak_count') || 4),
        preferredHour: Number(timeSelect.value) || 20
      });

      if (result.success) {
        updateModalUI();
        showForegroundToast('🎉 Notificações Ativadas com Sucesso!', 'O Tico lembrará você de manter sua sequência acesa todos os dias!');
      } else {
        alert('Não foi possível ativar as notificações: ' + (result.error || 'Permissão recusada.'));
        updateModalUI();
      }
    } catch (err) {
      alert('Erro ao registrar no FCM: ' + err.message);
    } finally {
      enableBtn.disabled = false;
    }
  }

  // Manipulador para disparar teste imediato
  async function handleTestPush() {
    const testBtn = modalOverlay.querySelector('#fcm-test-btn');
    testBtn.disabled = true;
    testBtn.innerHTML = '<span>⏳</span><span>Disparando via FCM...</span>';

    try {
      const user = window.FirebaseApplet?.auth?.currentUser;
      const name = user?.displayName || localStorage.getItem('vlp_user_name') || 'Vitor';
      const streak = Number(localStorage.getItem('vlp_streak_count') || 4);
      const targetExam = localStorage.getItem('vlp_target_exam') || 'Polícia Federal';

      const res = await window.FirebaseApplet.testStreakPushNotification({
        userId: user ? user.uid : 'test_student',
        name,
        streak,
        targetExam
      });

      appendLogItem({
        title: res.notification?.title || '🔥 Teste de Lembrete',
        body: res.notification?.body || 'Lembrete de sequência enviado.',
        sentAt: new Date().toLocaleTimeString('pt-BR'),
        status: res.dispatch?.provider || 'fcm_dispatched'
      });
    } catch (err) {
      alert('Erro ao disparar teste: ' + err.message);
    } finally {
      testBtn.disabled = false;
      testBtn.innerHTML = '<span>🚀</span><span>Testar Notificação de Sequência Agora</span>';
    }
  }

  // Manipulador para executar rotina automatizada
  async function handleRunScheduler() {
    const btn = modalOverlay.querySelector('#fcm-scheduler-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span><span>Executando checagem automatizada...</span>';

    try {
      const res = await window.FirebaseApplet.triggerAutomatedStreakCheck(true);
      alert(`✅ Rotina Automática Concluída!\n${res.message || 'Lembretes verificados com sucesso.'}`);
      loadNotificationLogs();
    } catch (err) {
      alert('Erro na rotina automatizada: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>⚡</span><span>Executar Rotina Automática de Lembretes (Simular Cron)</span>';
    }
  }

  function appendLogItem(log) {
    const box = modalOverlay?.querySelector('#fcm-log-container');
    if (!box) return;

    if (box.querySelector('div[style*="text-align: center"]')) {
      box.innerHTML = '';
    }

    const item = document.createElement('div');
    item.className = 'fcm-log-item';
    item.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-weight: 800; color: #0f172a;">
        <span>${log.title}</span>
        <span style="font-size: 11px; color: #64748b;">${log.sentAt}</span>
      </div>
      <div style="font-size: 12px; color: #475569;">${log.body}</div>
      <div style="font-size: 11px; color: #16a34a; font-weight: 700;">Status: Entrega FCM (${log.status})</div>
    `;
    box.prepend(item);
  }

  async function loadNotificationLogs() {
    try {
      const res = await fetch('/api/notifications/status');
      const data = await res.json();
      const box = modalOverlay?.querySelector('#fcm-log-container');
      if (!box || !data.recentHistory || data.recentHistory.length === 0) return;

      box.innerHTML = '';
      data.recentHistory.forEach(h => {
        appendLogItem({
          title: h.title,
          body: h.body,
          sentAt: new Date(h.sentAt).toLocaleTimeString('pt-BR'),
          status: h.urgency || 'entregue'
        });
      });
    } catch (_) {}
  }

  // Injetar botão de sino na barra de navegação/status
  function injectBellButton() {
    // Procura por barra de estatísticas ou cabeçalho de progresso
    const streakElement = document.querySelector('.col-streak') || document.querySelector('[data-stat="streak"]') || document.querySelector('.vlp-header-streak');
    
    // Se o sino já existe, nada a fazer
    if (document.querySelector('#fcm-bell-trigger-btn')) return;

    const bellBtn = document.createElement('button');
    bellBtn.className = 'fcm-bell-btn';
    bellBtn.id = 'fcm-bell-trigger-btn';
    bellBtn.setAttribute('title', 'Lembretes de Sequência (Firebase Cloud Messaging)');
    bellBtn.innerHTML = `
      <span>🔔</span>
      <div class="fcm-bell-badge active"></div>
    `;

    bellBtn.addEventListener('click', openModal);

    if (streakElement && streakElement.parentElement) {
      streakElement.parentElement.appendChild(bellBtn);
    } else {
      // Cria botão flutuante de acesso rápido se não houver container específico
      bellBtn.style.position = 'fixed';
      bellBtn.style.bottom = '24px';
      bellBtn.style.right = '24px';
      bellBtn.style.zIndex = '9999';
      bellBtn.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.15)';
      document.body.appendChild(bellBtn);
    }

    if (typeof Notification !== 'undefined') {
      updateBellBadge(Notification.permission === 'granted');
    }
  }

  // Conectar listener de mensagens em primeiro plano
  if (typeof window !== 'undefined') {
    window.addEventListener('fcm-foreground-message', (e) => {
      const notif = e.detail?.notification || {};
      const data = e.detail?.data || {};
      showForegroundToast(notif.title, notif.body, data);
    });

    // Expor métodos globais para facilitar testes
    window.FCMNotificationUI = {
      openModal,
      closeModal,
      showToast: showForegroundToast,
      playChime: playNotificationChime
    };

    // Suspende áudio em background para economia de bateria
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && audioCtx && audioCtx.state === 'running') {
        audioCtx.suspend().catch(() => {});
      }
    });
  }

  // Inicialização inteligente no DOM sem consumo contínuo de CPU
  function safeInitBell() {
    if (document.querySelector('#fcm-bell-trigger-btn')) return;
    injectBellButton();
  }

  let bellCheckScheduled = false;
  const bellObserver = new MutationObserver(() => {
    if (document.querySelector('#fcm-bell-trigger-btn')) return;
    if (bellCheckScheduled) return;
    bellCheckScheduled = true;
    requestAnimationFrame(() => {
      safeInitBell();
      bellCheckScheduled = false;
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(safeInitBell, 600);
      bellObserver.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    setTimeout(safeInitBell, 600);
    bellObserver.observe(document.body, { childList: true, subtree: true });
  }

})();
