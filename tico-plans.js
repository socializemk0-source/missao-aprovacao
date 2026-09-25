/**
 * tico-plans.js - Sistema de Planos (Modo Grátis vs Modo PRO R$ 29,90)
 * Aprova Tico: Plataforma Gamificada para Concursos Públicos
 */

(function() {
  'use strict';

  // Escapa HTML antes de inserir qualquer texto vindo do usuário (nome,
  // e-mail) via innerHTML — nunca confiar em campos de perfil como HTML seguro.
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Configuração padrão dos Planos
  const PLAN_CONFIG = {
    price: 'R$ 29,90',
    priceValue: 29.90,
    // Valores só para exibição — quem decide o que é cobrado é o servidor
    // (api/payments.js), a partir do ciclo escolhido.
    cycles: {
      monthly: { whole: '29', cents: ',90', period: '/ mês', subtext: 'Menos de R$ 1,00 por dia · cancele quando quiser' },
      annual: { whole: '19', cents: ',99', period: '/ mês', subtext: 'R$ 239,90 cobrados por ano · economize R$ 118,90' },
    },
    // Modo passe (pagamento único): paga uma vez e ganha 30 dias / 1 ano de PRO.
    passCycles: {
      monthly: { whole: '29', cents: ',90', period: '/ 30 dias', subtext: 'Pagamento único no PIX ou cartão · sem renovação automática' },
      annual: { whole: '239', cents: ',90', period: '/ 1 ano', subtext: 'Pagamento único no PIX ou cartão · sai por R$ 19,99/mês' },
    },
    periodLabel: 'Assinatura Mensal · Cancele quando quiser',
    freeChapterLimit: 5, // Capítulos 1 a 5 no modo gratuito (índices 0 a 4)
    freeFeatures: {
      hearts: '5 Vidas com tempo de recarga',
      chapters: 'Capítulos 1 a 5 (disciplinas base do edital)',
      redacao: '1 correção semanal com IA',
      bancas: 'Critérios básicos Cebraspe',
      simulados: 'Modo treino simples',
      ranking: 'Selo Padrão de Estudante'
    },
    proFeatures: {
      hearts: 'Vidas Infinitas (∞) — estude sem medo de errar',
      chapters: 'Todos os 37 Capítulos e 111 Fases 100% liberados',
      redacao: 'Redações Ilimitadas com espelho de notas da IA',
      bancas: '4 Bancas Oficiais: Cebraspe, FGV, FCC e Vunesp',
      simulados: 'Simulados cronometrados + Raio-X de fraquezas',
      ranking: 'Selo Dourado VIP PRO no ranking e perfil'
    }
  };

  // Ícone por categoria de recurso, usado nos dois cards de preço (Grátis / PRO)
  const FEATURE_ICONS = {
    hearts: '💖',
    chapters: '🗺️',
    redacao: '✍️',
    bancas: '🏛️',
    simulados: '⏱️',
    ranking: '🏆',
  };

  const CHECK_ICON_SVG = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';

  // Monta a lista de recursos de um plano (mesma ordem/chaves de PLAN_CONFIG.freeFeatures e .proFeatures)
  function renderFeatureList(featuresObj, variant) {
    return Object.keys(featuresObj).map((key) => `
      <li class="tico-pricing-feature-item">
        <span class="tico-pricing-feature-icon ${variant}">${variant === 'pro' ? CHECK_ICON_SVG : FEATURE_ICONS[key] || '•'}</span>
        <span>${featuresObj[key]}</span>
      </li>
    `).join('');
  }

  // Gerenciador central do estado do Plano
  const TicoPlan = {
    config: PLAN_CONFIG,

    // Só o plano que veio do servidor (get-profile, gravado no cache do
    // usuário) conta. A chave solta 'missao_aprovacao_plan' nunca é gravada
    // como 'pro' pelo app — aceitá-la só servia pra alguém se autopromover
    // pelo console. Convidado nunca é PRO.
    getPlan() {
      try {
        const userRaw = localStorage.getItem('missao_aprovacao_auth_user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          const expired = user?.proUntil && new Date(user.proUntil).getTime() <= Date.now();
          if (user && !user.isGuest && user.plan === 'pro' && !expired) return 'pro';
        }
      } catch (_) {}
      return 'free';
    },

    // Chamado pelo bundle no reducer que inicia QUALQUER missão da trilha
    // (botão da fase, "continuar de onde parei", ferramenta de missão) —
    // um ponto só, em vez de interceptar botões no DOM. O conteúdo em si
    // continua embarcado no bundle; isto barra o caminho normal de uso.
    allowsChapter(chapterIndex) {
      if (chapterIndex < PLAN_CONFIG.freeChapterLimit || this.isPro()) return true;
      setTimeout(() => this.openModal('details', `🦉 O Capítulo ${chapterIndex + 1} é exclusivo do <strong>Plano PRO</strong>! Desbloqueie todos os 37 capítulos e 111 fases por apenas R$ 29,90/mês.`), 0);
      return false;
    },

    getUser() {
      try {
        const raw = localStorage.getItem('missao_aprovacao_auth_user');
        if (raw) return JSON.parse(raw);
      } catch (_) {}
      return null;
    },

    isPro() {
      return this.getPlan() === 'pro';
    },

    // Virar PRO: redireciona para o checkout real do Mercado Pago (a
    // página navega para fora — nada aqui "ativa" nada de fato; só o
    // servidor, conferindo o pagamento na API do Mercado Pago, faz isso).
    // Voltar para grátis: autosserviço direto, sem risco de segurança.
    async setPlan(newPlan, cycle = 'monthly') {
      if (newPlan === 'pro') {
        if (!window.MissaoFirebase || typeof window.MissaoFirebase.startProCheckout !== 'function') {
          throw new Error('Pagamento indisponível no momento. Tente novamente em instantes.');
        }
        await window.MissaoFirebase.startProCheckout(cycle); // navega para o Mercado Pago
        return true;
      }

      let result = { plan: 'free' };
      if (window.MissaoFirebase && typeof window.MissaoFirebase.upgradeUserPlan === 'function') {
        result = await window.MissaoFirebase.upgradeUserPlan('free');
      }
      // Assinatura cancelada com período pago: o servidor mantém o PRO até a data.
      if (result?.plan !== 'pro') {
        localStorage.setItem('missao_aprovacao_plan', 'free');
        window.dispatchEvent(new CustomEvent('plan_state_changed', { detail: { plan: 'free', planPrice: PLAN_CONFIG.price } }));
      }
      this.updateUI();
      return result;
    },

    // Ao voltar do checkout do Mercado Pago (?payment=return, mais os
    // parâmetros que ele acrescenta: payment_id/collection_id e status no
    // passe, preapproval_id na assinatura). NUNCA confia nesses parâmetros
    // (são controláveis pelo usuário): o servidor confere o pagamento na
    // API do Mercado Pago e só então a interface reflete o plano.
    async checkPaymentReturn() {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('payment')) return;
      const paymentId = params.get('payment_id') || params.get('collection_id');
      const preapprovalId = params.get('preapproval_id');
      const mpStatus = params.get('collection_status') || params.get('status') || params.get('payment');

      const url = new URL(window.location.href);
      ['payment', 'payment_id', 'collection_id', 'collection_status', 'status', 'external_reference', 'payment_type',
        'merchant_order_id', 'preference_id', 'site_id', 'processing_mode', 'merchant_account_id', 'preapproval_id']
        .forEach((key) => url.searchParams.delete(key));
      history.replaceState({}, '', url.pathname + url.search + url.hash);

      // "null": voltou pelo link do checkout sem pagar.
      if (mpStatus === 'failure' || mpStatus === 'rejected' || mpStatus === 'null' || mpStatus === 'cancelled') {
        this.openModal('details', 'O pagamento não foi concluído. Você pode tentar novamente quando quiser.');
        return;
      }

      // supabase-client.js é um módulo e costuma carregar DEPOIS deste
      // script — espera a ponte ficar pronta (como refreshPlanOnLoad).
      for (let i = 0; i < 25 && !window.MissaoFirebase?.refreshPlanFromServer; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!window.MissaoFirebase || typeof window.MissaoFirebase.refreshPlanFromServer !== 'function') return;

      const validId = (id) => (id && /^[A-Za-z0-9_-]{1,64}$/.test(id) && id !== 'null' ? id : null);
      const confirmArgs = validId(paymentId) ? { paymentId } : (validId(preapprovalId) ? { preapprovalId } : null);

      // O webhook pode chegar alguns segundos depois do redirecionamento
      // de volta — tenta algumas vezes antes de desistir.
      for (let attempt = 0; attempt < 6; attempt++) {
        let profile = null;
        try {
          if (confirmArgs && typeof window.MissaoFirebase.confirmProPayment === 'function') {
            await window.MissaoFirebase.confirmProPayment(confirmArgs);
          }
          profile = await window.MissaoFirebase.refreshPlanFromServer();
        } catch (_) {}

        if (profile?.plan === 'pro') {
          this.updateUI();
          this.openModal('details');
          const inner = document.querySelector('#tico-plan-modal-inner');
          if (inner) {
            inner.innerHTML = `
              <div class="tico-plan-success-splash">
                <div class="tico-success-icon">🎉👑</div>
                <h2>Parabéns, Concurseiro PRO!</h2>
                <p>Seu <strong>Passaporte Aprovação PRO</strong> foi confirmado e ativado.</p>
                <div class="tico-success-unlocked-card">
                  <ul>
                    <li>✓ Vidas Infinitas (∞) desbloqueadas</li>
                    <li>✓ Acesso integral aos 37 Capítulos e 111 Fases</li>
                    <li>✓ Oficina de Redação Ilimitada com IA ativada</li>
                    <li>✓ Selo Dourado PRO adicionado ao seu perfil</li>
                  </ul>
                </div>
                <button type="button" class="tico-plan-confirm-btn" id="tico-close-and-enjoy-btn">
                  Bora Estudar com Vidas Infinitas! 🚀
                </button>
              </div>
            `;
            inner.querySelector('#tico-close-and-enjoy-btn')?.addEventListener('click', () => this.closeModal());
          }
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      if (mpStatus === 'pending' || mpStatus === 'in_process') {
        this.openModal('details', 'Seu pagamento está em processamento. Assim que for aprovado o PRO libera automaticamente — pode continuar estudando enquanto isso.');
      } else {
        this.openModal('details', 'Estamos confirmando seu pagamento. Se a confirmação demorar mais que alguns minutos, atualize a página.');
      }
    },

    openModal(preferredTab = 'details', customMessage = '') {
      let modal = document.getElementById('tico-plan-modal');
      if (!modal) {
        modal = this.createModalElement();
        document.body.appendChild(modal);
      }
      modal.classList.add('active');
      document.body.classList.add('tico-modal-open');
      this.renderModalContent(modal, preferredTab, customMessage);
    },

    closeModal() {
      const modal = document.getElementById('tico-plan-modal');
      if (modal) {
        modal.classList.remove('active');
      }
      document.body.classList.remove('tico-modal-open');
    },

    openProfileModal() {
      let modal = document.getElementById('tico-profile-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'tico-profile-modal';
        modal.className = 'tico-plan-modal-backdrop';
        modal.innerHTML = `
          <div class="tico-plan-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="tico-profile-modal-title" style="max-width: 480px;">
            <button type="button" class="tico-plan-modal-close" id="tico-profile-modal-close" aria-label="Fechar modal">&times;</button>
            <div class="tico-plan-modal-content" id="tico-profile-modal-inner"></div>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#tico-profile-modal-close').addEventListener('click', () => {
          modal.classList.remove('active');
          document.body.classList.remove('tico-modal-open');
        });
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.classList.remove('active');
            document.body.classList.remove('tico-modal-open');
          }
        });
      }

      const user = this.getUser();
      const isPro = this.isPro();
      const inner = modal.querySelector('#tico-profile-modal-inner');

      if (!user) {
        inner.innerHTML = `
          <div class="tico-plan-modal-header" style="padding-bottom: 12px;">
            <span style="font-size: 40px;">🦉</span>
            <h2 id="tico-profile-modal-title" class="tico-plan-title">Acesso do Estudante</h2>
            <p class="tico-plan-subtitle">Cadastre-se gratuitamente para salvar suas fases, XP e redações na nuvem.</p>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px;">
            <a href="/cadastro" class="tico-plan-confirm-btn" style="text-align: center; text-decoration: none; display: block;">
              <span>Criar Conta Gratuita</span>
            </a>
            <a href="/entrar" class="tico-copy-btn" style="text-align: center; text-decoration: none; display: block; background: #f1f5f9; color: #1e293b;">
              <span>Já tenho conta (Entrar)</span>
            </a>
          </div>
        `;
      } else {
        inner.innerHTML = `
          <div class="tico-plan-modal-header" style="padding-bottom: 8px;">
            <div class="tico-plan-mascot-badge">
              <span class="tico-plan-mascot-emoji">🎓</span>
              <div class="tico-plan-tag-pill">${isPro ? '👑 ASSINANTE PRO' : '🆓 MODO GRATUITO'}</div>
            </div>
            <h2 id="tico-profile-modal-title" class="tico-plan-title">${escapeHtml(user.name || 'Concurseiro')}</h2>
            <p class="tico-plan-subtitle">Seu progresso está salvo e sincronizado na nuvem.</p>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 16px 0; display: flex; flex-direction: column; gap: 10px; font-size: 14px;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              <span style="color: #64748b;">E-mail:</span>
              <strong style="color: #0f172a;">${user.email || '-'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              <span style="color: #64748b;">WhatsApp:</span>
              <strong style="color: #0f172a;">${user.whatsapp || 'Não informado'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              <span style="color: #64748b;">Cidade:</span>
              <strong style="color: #0f172a;">${user.cidade || 'Não informada'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
              <span style="color: #64748b;">Banca Alvo:</span>
              <strong style="color: #0f172a;">${user.preferredBanca || 'Cebraspe'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 4px;">
              <span style="color: #64748b;">Plano:</span>
              <strong style="color: ${isPro ? '#166534' : '#d97706'};">${isPro ? '👑 Passaporte PRO (Acesso Total)' : '🆓 Modo Grátis (5 Vidas)'}</strong>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${!isPro ? `
              <button type="button" class="tico-plan-confirm-btn" id="tico-profile-upgrade-btn" style="width: 100%;">
                <span>👑 Assinar Modo PRO (R$ 29,90/mês)</span>
              </button>
            ` : ''}
            <button type="button" id="tico-profile-logout-btn" style="background: #fff; border: 1px solid #fecaca; color: #dc2626; padding: 10px 16px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              🚪 Sair da Conta
            </button>
          </div>
        `;

        const upBtn = inner.querySelector('#tico-profile-upgrade-btn');
        if (upBtn) {
          upBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            this.openModal();
          });
        }

        const logoutBtn = inner.querySelector('#tico-profile-logout-btn');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', async () => {
            if (confirm('Deseja realmente sair da sua conta?')) {
              localStorage.removeItem('missao_aprovacao_auth_user');
              localStorage.removeItem('missao_aprovacao_user_profile');
              if (window.MissaoFirebase && window.MissaoFirebase.logoutUser) {
                try { await window.MissaoFirebase.logoutUser(); } catch(_) {}
              }
              window.location.reload();
            }
          });
        }
      }

      modal.classList.add('active');
      document.body.classList.add('tico-modal-open');
    },

    createModalElement() {
      const modal = document.createElement('div');
      modal.id = 'tico-plan-modal';
      modal.className = 'tico-plan-modal-backdrop';
      modal.innerHTML = `
        <div class="tico-plan-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="tico-plan-modal-title">
          <button type="button" class="tico-plan-modal-close" aria-label="Fechar modal">&times;</button>
          <div class="tico-plan-modal-content" id="tico-plan-modal-inner"></div>
        </div>
      `;

      modal.querySelector('.tico-plan-modal-close').addEventListener('click', () => this.closeModal());
      modal.addEventListener('click', (e) => {
        if (e.target === modal) this.closeModal();
      });

      // Fechar no ESC
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          this.closeModal();
        }
      });

      return modal;
    },

    renderModalContent(modal, initialTab = 'details', customMessage = '') {
      const inner = modal.querySelector('#tico-plan-modal-inner');
      if (!inner) return;

      const isPro = this.isPro();
      const user = this.getUser();
      const passMode = this.billingMode === 'pass';
      const cycles = passMode ? PLAN_CONFIG.passCycles : PLAN_CONFIG.cycles;
      if (!cycles[this.selectedCycle]) this.selectedCycle = 'monthly';
      const cycle = this.selectedCycle;
      const cycleInfo = cycles[cycle];
      // PRO com data de fim (passe, ou assinatura cancelada no período já
      // pago): no modo passe dá para comprar mais tempo; não há nada a cancelar.
      const proUntil = user?.proUntil ? new Date(user.proUntil) : null;
      const validUntil = proUntil && !Number.isNaN(proUntil.getTime()) ? proUntil.toLocaleDateString('pt-BR') : null;
      const isPassUser = isPro && Boolean(validUntil);
      const showPurchase = !isPro || (passMode && isPassUser);
      const ctaLabel = passMode ? (isPro ? 'Adicionar mais tempo' : 'Pagar com PIX ou cartão') : 'Assinar agora';

      inner.innerHTML = `
        <div class="tico-plan-modal-header">
          <div class="tico-plan-mascot-badge">
            <span class="tico-plan-mascot-emoji">🦉👑</span>
            <div class="tico-plan-tag-pill">PASSAPORTE APROVAÇÃO</div>
          </div>
          <h2 id="tico-plan-modal-title" class="tico-plan-title">
            ${isPro ? 'Você já é Estudante PRO!' : 'Acelere sua Aprovação com o Plano PRO'}
          </h2>
          <p class="tico-plan-subtitle">
            ${customMessage ? `<span class="tico-plan-custom-alert">${customMessage}</span><br>` : ''}
            ${isPro
              ? (isPassUser
                ? `Seu PRO está ativo até <strong>${validUntil}</strong>: acesso ilimitado a todos os 37 capítulos, 111 fases e redações com IA.`
                : 'Sua assinatura está ativa: acesso ilimitado a todos os 37 capítulos, 111 fases e redações com IA.')
              : (passMode
                ? 'Treine sem limites de vidas, desbloqueie todo o edital e tenha correções de redação ilimitadas por <strong>R$ 29,90 (30 dias)</strong> ou <strong>R$ 239,90 (1 ano)</strong>, pagos no PIX ou no cartão.'
                : 'Treine sem limites de vidas, desbloqueie todo o edital e tenha correções de redação ilimitadas por <strong>R$ 29,90/mês</strong> ou <strong>R$ 239,90/ano</strong>.')}
          </p>
        </div>

        <!-- Cards de preço lado a lado: Grátis vs PRO -->
        <div class="tico-pricing-grid">
          <div class="tico-pricing-card">
            <div class="tico-pricing-card-head">
              <h3 class="tico-pricing-plan-name">Grátis</h3>
              <p class="tico-pricing-plan-desc">Para começar a treinar sem compromisso</p>
              <div class="tico-pricing-price-row">
                <span class="tico-pricing-currency">R$</span>
                <span class="tico-pricing-amount">0</span>
                <span class="tico-pricing-period">/ sempre</span>
              </div>
            </div>
            <div class="tico-pricing-card-body">
              ${isPro
                ? (isPassUser
                  ? `<div class="tico-pricing-cta-ghost is-current">Sem renovação automática · volta para o Grátis em ${validUntil}</div>`
                  : `<button type="button" class="tico-pricing-cta-ghost" id="tico-toggle-free-btn">Cancelar assinatura e voltar para o Grátis</button>`)
                : `<div class="tico-pricing-cta-ghost is-current">Seu plano atual</div>`}
              <ul class="tico-pricing-feature-list">
                ${renderFeatureList(PLAN_CONFIG.freeFeatures, 'free')}
              </ul>
            </div>
          </div>

          <div class="tico-pricing-card popular ${isPro ? 'is-active' : ''}">
            <div class="tico-pricing-badge-popular">${isPro ? '✓ Plano Ativo' : '⭐ Recomendado'}</div>
            <div class="tico-pricing-card-head">
              <h3 class="tico-pricing-plan-name">PRO</h3>
              <p class="tico-pricing-plan-desc">Edital completo + redações ilimitadas com IA</p>
              ${showPurchase ? `
              <div class="tico-cycle-toggle" role="group" aria-label="Período do plano">
                <button type="button" data-cycle="monthly" aria-pressed="${cycle === 'monthly'}">${passMode ? '30 dias' : 'Mensal'}</button>
                <button type="button" data-cycle="annual" aria-pressed="${cycle === 'annual'}">${passMode ? '1 ano' : 'Anual'} <span class="tico-cycle-save">-33%</span></button>
              </div>` : ''}
              <div class="tico-pricing-price-row">
                <span class="tico-pricing-currency">R$</span>
                <span class="tico-pricing-amount"><span data-price-whole>${cycleInfo.whole}</span><span class="tico-pricing-cents" data-price-cents>${cycleInfo.cents}</span></span>
                <span class="tico-pricing-period" data-price-period>${cycleInfo.period}</span>
              </div>
              <span class="tico-pricing-price-subtext" data-price-subtext>
                ${showPurchase ? cycleInfo.subtext : (isPassUser ? `✨ PRO ativo até ${validUntil}` : `✨ Assinatura ativa${user?.planPrice ? ` · ${escapeHtml(user.planPrice)}` : ''}`)}
              </span>
            </div>
            <div class="tico-pricing-card-body">
              ${!showPurchase
                ? `<div class="tico-pricing-active-stamp">${isPassUser ? '👑 PRO Ativo' : '👑 Assinatura Ativa'}</div>`
                : `<button type="button" class="tico-plan-cta-button tico-pricing-cta-full pulse" id="tico-confirm-pro-btn">
                    <span>${ctaLabel}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>`}
              <ul class="tico-pricing-feature-list pro">
                ${renderFeatureList(PLAN_CONFIG.proFeatures, 'pro')}
              </ul>
            </div>
          </div>
        </div>
        <p id="tico-plan-checkout-error" class="tico-plan-checkout-error" hidden></p>

        <!-- Rodapé: nota de segurança (não-PRO) ou confirmação (PRO) -->
        <div class="tico-plan-footer-section">
          ${isPro
            ? `<p class="tico-plan-success-notice">✅ ${isPassUser ? `Seu PRO vale até ${validUntil}.` : 'Sua assinatura PRO está ativa nesta conta.'}</p>`
            : `<p class="tico-plan-security-note">
                🔒 Pagamento seguro via Mercado Pago (${passMode ? 'PIX ou cartão' : 'cartão de crédito'}) · Garantia de 7 dias ou seu dinheiro de volta
              </p>`}
        </div>
      `;

      inner.querySelectorAll('.tico-cycle-toggle button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const next = btn.dataset.cycle;
          if (!cycles[next]) return;
          TicoPlan.selectedCycle = next;
          const info = cycles[next];
          inner.querySelectorAll('.tico-cycle-toggle button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
          inner.querySelector('[data-price-whole]').textContent = info.whole;
          inner.querySelector('[data-price-cents]').textContent = info.cents;
          inner.querySelector('[data-price-subtext]').textContent = info.subtext;
          inner.querySelector('[data-price-period]').textContent = info.period;
        });
      });

      // Botão Ativar PRO — redireciona para o checkout real do Mercado Pago.
      const confirmBtn = inner.querySelector('#tico-confirm-pro-btn');
      const checkoutError = inner.querySelector('#tico-plan-checkout-error');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          if (checkoutError) checkoutError.hidden = true;
          const originalContent = confirmBtn.innerHTML;
          confirmBtn.innerHTML = '<span>Abrindo pagamento seguro...</span>';
          try {
            await TicoPlan.setPlan('pro', TicoPlan.selectedCycle); // navega para o Mercado Pago (não retorna se der certo)
          } catch (err) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = originalContent;
            if (checkoutError) {
              checkoutError.textContent = err.message || 'Não foi possível abrir o pagamento. Tente novamente.';
              checkoutError.hidden = false;
            }
          }
        });
      }

      // Botão Cancelar Assinatura — pede confirmação e cancela de verdade no
      // Mercado Pago (ver api/auth.js downgrade-to-free). O período já pago
      // continua valendo até a data da próxima cobrança.
      const toggleFreeBtn = inner.querySelector('#tico-toggle-free-btn');
      if (toggleFreeBtn) {
        toggleFreeBtn.addEventListener('click', async () => {
          if (!confirm('Cancelar a assinatura PRO? Você não será mais cobrado, e o PRO continua até o fim do período já pago.')) return;
          toggleFreeBtn.disabled = true;
          const originalLabel = toggleFreeBtn.innerHTML;
          toggleFreeBtn.innerHTML = 'Cancelando assinatura...';
          try {
            const result = await TicoPlan.setPlan('free');
            TicoPlan.renderModalContent(modal, 'details', result?.message ? escapeHtml(result.message) : '');
          } catch (err) {
            toggleFreeBtn.disabled = false;
            toggleFreeBtn.innerHTML = originalLabel;
            if (checkoutError) {
              checkoutError.textContent = err.message || 'Não foi possível cancelar sua assinatura agora. Tente novamente.';
              checkoutError.hidden = false;
            }
          }
        });
      }
    },

    // Injeção de controles na barra de navegação superior / header
    updateUI() {
      const isPro = this.isPro();

      // 1. Botão de conta do usuário no header (login/perfil)
      this.injectHeaderTrigger(isPro);

      // 1b. Aba "Planos" na navegação principal
      this.injectSidebarPlanosTab(isPro);

      // 2. Indicador de corações/vidas no jogo
      this.updateHeartsDisplay(isPro);

      // 3. Indicadores na trilha de fases
      this.updateLearningPathNotice(isPro);

      // 4. Bloqueio / tags nos capítulos avançados (Capítulos 6 a 37)
      this.decorateChapterCards(isPro);

      // 5. Banner na oficina de redação
      this.updateRedacaoNotice(isPro);
    },

    injectHeaderTrigger(isPro) {
      // Nas próprias páginas de cadastro/entrar, um botão flutuante
      // "Cadastrar / Entrar" não faz sentido (o usuário já está lá).
      if (/^\/(cadastro|entrar)(\/|$)/.test(window.location.pathname)) {
        document.getElementById('tico-user-account-btn')?.remove();
        return;
      }

      const targetSelectors = [
        '.vlp-header-actions',
        '.account-header',
        'header.lp-wrap',
        'nav.topbar',
        '.vlp-header-top'
      ];

      let container = null;
      for (const sel of targetSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          container = el;
          break;
        }
      }

      const user = this.getUser();

      // Injetar Botão de Conta do Usuário
      let userBtn = document.getElementById('tico-user-account-btn');
      if (!userBtn) {
        userBtn = document.createElement('button');
        userBtn.id = 'tico-user-account-btn';
        userBtn.type = 'button';
        userBtn.className = 'tico-user-header-btn';

        if (container) {
          container.appendChild(userBtn);
        } else {
          document.body.appendChild(userBtn);
          userBtn.classList.add('floating-top-right-user');
        }
      }

      if (user) {
        const firstName = user.name ? user.name.split(' ')[0] : 'Concurseiro';
        userBtn.className = 'tico-user-header-btn is-logged';
        userBtn.innerHTML = `
          <span class="user-avatar-icon">👤</span>
          <span class="user-name-label">${escapeHtml(firstName)}</span>
          <span class="user-status-dot"></span>
        `;
        userBtn.title = `Conectado como ${user.name || user.email} · Clique para gerenciar seu perfil`;
        userBtn.onclick = () => this.openProfileModal();
      } else {
        userBtn.className = 'tico-user-header-btn is-guest';
        userBtn.innerHTML = `
          <span class="user-avatar-icon">👤</span>
          <span class="user-name-label">Cadastrar / Entrar</span>
        `;
        userBtn.title = 'Criar conta gratuita ou entrar para salvar progresso';
        userBtn.onclick = () => { window.location.href = '/cadastro'; };
      }

      // O antigo botão "MODO PRO" flutuante foi removido — a entrada para
      // conhecer/ativar o PRO agora é a aba "Planos" da barra de navegação
      // principal (ver injectSidebarPlanosTab), que não fica solta por cima
      // do conteúdo.
    },

    // Aba "Planos" na navegação principal (sidebar no desktop, barra
    // inferior no mobile — é o mesmo <nav>, o layout responsivo é só CSS).
    // Reinjetada a cada updateUI() porque o React pode recriar esse <nav>.
    injectSidebarPlanosTab(isPro) {
      const nav = document.querySelector('nav[aria-label="Navegação principal"]');
      if (!nav) return;

      let item = document.getElementById('tico-nav-planos-item');
      if (!item) {
        item = document.createElement('button');
        item.id = 'tico-nav-planos-item';
        item.type = 'button';
        item.addEventListener('click', () => this.openModal());
        nav.appendChild(item);
      } else if (item.parentElement !== nav) {
        nav.appendChild(item);
      }

      item.className = `nav-item tico-nav-planos-item${isPro ? ' is-pro' : ''}`;
      item.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 4l3 12h14l3-12-6.5 6.5L12 4l-3.5 6.5z"></path>
          <path d="M4 20h16"></path>
        </svg>
        Planos
        ${isPro ? '<span class="tico-nav-pro-dot" title="Plano PRO ativo"></span>' : ''}
      `;
    },

    updateHeartsDisplay(isPro) {
      if (isPro) {
        const heartEls = document.querySelectorAll('.vlp-stat-val, .stat-big-val');
        heartEls.forEach(el => {
          const parentText = el.parentElement?.textContent || '';
          if (parentText.includes('Corações') || parentText.includes('Vidas') || el.textContent.includes('❤️')) {
            if (!el.dataset.proInfinity) {
              el.dataset.proInfinity = 'true';
              el.innerHTML = '<span class="pro-infinity-hearts">💖 ∞ PRO</span>';
            }
          }
        });
      }
    },

    updateLearningPathNotice(isPro) {
      const headerCard = document.querySelector('.vlp-header-card');
      if (!headerCard) return;

      let banner = document.getElementById('tico-curriculum-pro-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'tico-curriculum-pro-banner';
        banner.className = 'tico-curriculum-plan-banner';
        headerCard.after(banner);
      }

      if (isPro) {
        banner.className = 'tico-curriculum-plan-banner is-pro';
        banner.innerHTML = `
          <div class="plan-banner-icon">👑</div>
          <div class="plan-banner-info">
            <strong>Plano PRO Ativo (Acesso Total)</strong>
            <span>Todos os 37 capítulos e 111 fases do edital estão 100% liberados com vidas infinitas.</span>
          </div>
          <button type="button" class="plan-banner-btn pro" onclick="window.TicoPlan.openModal()">Ver Benefícios</button>
        `;
      } else {
        banner.className = 'tico-curriculum-plan-banner is-free';
        banner.innerHTML = `
          <div class="plan-banner-icon">🚀</div>
          <div class="plan-banner-info">
            <strong>Modo Gratuito: Capítulos 1 a 5 Liberados</strong>
            <span>Gostou do treino? Desbloqueie todo o edital (37 capítulos e 111 fases) + Vidas Infinitas por apenas <strong>R$ 29,90/mês</strong>.</span>
          </div>
          <button type="button" class="plan-banner-btn upgrade pulse" onclick="window.TicoPlan.openModal()">Desbloquear Tudo (R$ 29,90/mês)</button>
        `;
      }
    },

    // A trilha mostra UM capítulo por vez (.chapter-banner + 3 .level-node);
    // o índice vem do <select class="chapter-quick-select">. O bloqueio de
    // verdade está em allowsChapter (chamado pelo bundle); aqui é só a
    // sinalização visual. Toda escrita só acontece se algo mudou — este
    // método roda a cada mutação do DOM.
    decorateChapterCards(isPro) {
      const limit = PLAN_CONFIG.freeChapterLimit;
      const setClass = (el, cls, on) => { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); };

      document.querySelectorAll('.chapter-picker button').forEach((btn, idx) => {
        setClass(btn, 'tico-chapter-pro', idx >= limit && !isPro);
      });

      const banner = document.querySelector('.chapter-banner');
      const select = document.querySelector('.chapter-quick-select');
      if (!banner || !select) return;
      const chapterIndex = Number(select.value);
      if (!Number.isInteger(chapterIndex)) return;

      const locked = chapterIndex >= limit && !isPro;
      const tier = chapterIndex < limit ? 'free' : isPro ? 'pro' : 'locked';
      const labels = {
        free: '🆓 Modo Gratuito',
        pro: '✨ Desbloqueado com Plano PRO',
        locked: '👑 Exclusivo Plano PRO (R$ 29,90/mês)',
      };

      let badge = banner.querySelector('.tico-chapter-tier-badge');
      if (!badge) {
        badge = document.createElement('div');
        banner.querySelector('.chapter-body')?.appendChild(badge);
      }
      if (badge.dataset.tier !== tier) {
        badge.dataset.tier = tier;
        badge.className = `tico-chapter-tier-badge is-${tier}`;
        badge.textContent = labels[tier];
      }

      document.querySelectorAll('.map-stop .level-node').forEach((btn) => {
        setClass(btn, 'tico-phase-locked-by-plan', locked);
      });
    },

    updateRedacaoNotice(isPro) {
      const redacaoHeader = document.querySelector('.tico-banca-hero-card') || document.querySelector('.essay-header');
      if (!redacaoHeader) return;

      let badge = document.getElementById('tico-redacao-plan-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'tico-redacao-plan-badge';
        badge.className = 'tico-redacao-plan-tag';
        redacaoHeader.appendChild(badge);
      }

      if (isPro) {
        badge.className = 'tico-redacao-plan-tag is-pro';
        badge.innerHTML = `
          <span>👑 PLANO PRO ATIVO</span>
          <small>Correções e análises discursivas com IA ilimitadas</small>
        `;
      } else {
        badge.className = 'tico-redacao-plan-tag is-free';
        badge.innerHTML = `
          <span>🆓 MODO DEGUSTAÇÃO: 1 CORREÇÃO SEMANAL</span>
          <button type="button" onclick="window.TicoPlan.openModal()">Quero Ilimitadas por R$ 29,90/mês</button>
        `;
      }
    },

    // O cache local do plano pode estar velho (assinatura cancelada pelo
    // webhook em outro momento, outro aparelho...). Revalida no servidor a
    // cada carregamento para quem está logado de verdade.
    async refreshPlanOnLoad() {
      const user = this.getUser();
      if (!user || user.isGuest) return;
      for (let i = 0; i < 25 && !window.MissaoFirebase?.refreshPlanFromServer; i++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!window.MissaoFirebase?.refreshPlanFromServer) return;
      try {
        await window.MissaoFirebase.refreshPlanFromServer();
        this.updateUI();
      } catch (_) {}
    },

    init() {
      window.TicoPlan = this;

      this.billingMode = 'pass';
      fetch('/api/config/billing')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.mode === 'pass' || data?.mode === 'subscription') this.billingMode = data.mode;
        })
        .catch(() => {});

      this.updateUI();
      const returningFromCheckout = new URLSearchParams(window.location.search).has('payment');
      this.checkPaymentReturn();
      if (!returningFromCheckout) this.refreshPlanOnLoad();

      window.addEventListener('auth_state_changed', () => {
        setTimeout(() => this.updateUI(), 200);
      });
      window.addEventListener('plan_state_changed', () => {
        this.updateUI();
      });

      // Observador de mutações com debounce para re-injetar quando React alterar páginas
      let updateScheduled = false;
      const observer = new MutationObserver(() => {
        if (updateScheduled) return;
        updateScheduled = true;
        requestAnimationFrame(() => {
          this.updateUI();
          updateScheduled = false;
        });
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  // Inicializar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TicoPlan.init());
  } else {
    TicoPlan.init();
  }

})();
