/**
 * tico-plans.js - Sistema de Planos (Modo Grátis vs Modo PRO R$ 29,90)
 * Missão Aprovação: Plataforma Gamificada para Concursos Públicos
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
    periodLabel: 'Acesso Completo · Pagamento Único de Lançamento',
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

  // Dados do comparativo Grátis vs PRO (renderizados como cards no modal)
  const PLAN_COMPARISON = [
    {
      icon: '💖',
      title: 'Vidas / Corações',
      subtitle: 'Margem para errar e aprender',
      free: '5 Vidas',
      freeNote: 'Espera recarregar ao zerar',
      pro: 'Vidas Infinitas (∞)',
      proNote: 'Estude sem parar nem travar',
    },
    {
      icon: '🗺️',
      title: 'Trilha do Edital',
      subtitle: 'Capítulos e fases mapeadas',
      free: 'Capítulos 1 a 5',
      freeNote: 'Foco nas matérias base',
      pro: '37 Capítulos & 111 Fases',
      proNote: '100% do edital completo',
    },
    {
      icon: '✍️',
      title: 'Oficina de Redação com IA',
      subtitle: 'Correções do Professor Tico',
      free: '1 por semana',
      freeNote: 'Avaliação preliminar',
      pro: 'Submissões Ilimitadas',
      proNote: 'Com espelho oficial e reescrita',
    },
    {
      icon: '🏛️',
      title: 'Bancas Examinadoras',
      subtitle: 'Critérios de correção',
      free: 'Básico',
      freeNote: 'Cebraspe simplificado',
      pro: 'Cebraspe, FGV, FCC, Vunesp',
      proNote: 'Modelos e esqueletos oficiais',
    },
    {
      icon: '📊',
      title: 'Raio-X de Fraquezas',
      subtitle: 'Diagnóstico pedagógico',
      free: '✕ Não incluso',
      pro: '✓ Raio-X Detalhado',
      proNote: 'Mapeia onde você mais erra',
    },
    {
      icon: '🏆',
      title: 'Selo VIP no Ranking',
      subtitle: 'Destaque entre concorrentes',
      free: 'Padrão',
      pro: '⭐ Selo Dourado PRO',
    },
  ];

  // Gerenciador central do estado do Plano
  const TicoPlan = {
    config: PLAN_CONFIG,

    getPlan() {
      try {
        const stored = localStorage.getItem('missao_aprovacao_plan');
        if (stored === 'pro') return 'pro';
        const userRaw = localStorage.getItem('missao_aprovacao_auth_user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          if (user && user.plan === 'pro') return 'pro';
        }
      } catch (_) {}
      return 'free';
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
    // webhook confirmado no servidor faz isso, ver api/payments.js).
    // Voltar para grátis: autosserviço direto, sem risco de segurança.
    async setPlan(newPlan) {
      if (newPlan === 'pro') {
        if (!window.MissaoFirebase || typeof window.MissaoFirebase.startProCheckout !== 'function') {
          throw new Error('Pagamento indisponível no momento. Tente novamente em instantes.');
        }
        await window.MissaoFirebase.startProCheckout(); // navega para o Mercado Pago
        return true;
      }

      if (window.MissaoFirebase && typeof window.MissaoFirebase.upgradeUserPlan === 'function') {
        await window.MissaoFirebase.upgradeUserPlan('free');
      }
      localStorage.setItem('missao_aprovacao_plan', 'free');
      window.dispatchEvent(new CustomEvent('plan_state_changed', { detail: { plan: 'free', planPrice: PLAN_CONFIG.price } }));
      this.updateUI();
      return true;
    },

    // Ao voltar do checkout do Mercado Pago (?payment=success|pending|failure),
    // NUNCA confia nesse parâmetro (é controlável pelo usuário) — busca o
    // plano real no servidor e só então reflete na interface.
    async checkPaymentReturn() {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('payment');
      if (!status) return;

      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      history.replaceState({}, '', url.pathname + url.search + url.hash);

      if (status === 'failure') {
        this.openModal('details', 'O pagamento não foi concluído. Você pode tentar novamente quando quiser.');
        return;
      }

      if (!window.MissaoFirebase || typeof window.MissaoFirebase.refreshPlanFromServer !== 'function') return;

      // O webhook pode chegar alguns segundos depois do redirecionamento
      // de volta — tenta algumas vezes antes de desistir.
      for (let attempt = 0; attempt < 6; attempt++) {
        let profile = null;
        try {
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
                <p>Seu <strong>Passaporte Aprovação PRO (R$ 29,90)</strong> foi confirmado e ativado.</p>
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

      if (status === 'pending') {
        this.openModal('details', 'Seu pagamento está em análise. Assim que for aprovado o PRO libera automaticamente — pode continuar estudando enquanto isso.');
      } else {
        this.openModal('details', 'Estamos confirmando seu pagamento com o Mercado Pago. Se a confirmação demorar mais que alguns minutos, atualize a página.');
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
                <span>👑 Ativar Modo PRO (R$ 29,90)</span>
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
              ? 'Seu acesso ilimitado a todos os 37 capítulos, 111 fases e redações com IA está ativo.' 
              : 'Treine sem limites de vidas, desbloqueie todo o edital e tenha correções de redação ilimitadas por apenas <strong>R$ 29,90</strong>.'}
          </p>
        </div>

        <!-- Preço e Chamada de Valor -->
        <div class="tico-plan-pricing-banner ${isPro ? 'is-pro-active' : ''}">
          <div class="tico-plan-price-left">
            <span class="tico-plan-price-label">${isPro ? 'STATUS ATUAL DA CONTA' : 'INVESTIMENTO ÚNICO DE LANÇAMENTO'}</span>
            <div class="tico-plan-price-row">
              <span class="tico-plan-price-currency">R$</span>
              <span class="tico-plan-price-val">29</span>
              <span class="tico-plan-price-cents">,90</span>
              <span class="tico-plan-price-period">/ acesso completo</span>
            </div>
            <span class="tico-plan-price-subtext">
              ${isPro ? '✨ Acesso Vitalício Ativado com Sucesso' : 'Menos de R$ 1,00 por dia · Sem mensalidades recorrentes ocultas'}
            </span>
          </div>
          <div class="tico-plan-price-right">
            ${isPro ? `
              <div class="tico-plan-badge-pro-stamp">
                <span>⭐ CONCURSEIRO VIP</span>
                <small>Plano PRO Ativo</small>
              </div>
            ` : `
              <button type="button" class="tico-plan-cta-button pulse" id="tico-confirm-pro-btn">
                <span>Quero Ser PRO Agora</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            `}
          </div>
        </div>
        <p id="tico-plan-checkout-error" class="tico-plan-checkout-error" hidden></p>

        <!-- Comparativo Grátis vs PRO, em cards (mesma linguagem visual do resto do app) -->
        <div class="tico-plan-compare-box">
          <h3 class="tico-plan-compare-title">Compare o Modo Grátis com o Modo PRO</h3>
          <div class="tico-compare-grid">
            ${PLAN_COMPARISON.map(item => `
              <div class="tico-compare-card">
                <div class="tico-compare-card-head">
                  <span class="tico-compare-icon">${item.icon}</span>
                  <div>
                    <strong>${item.title}</strong>
                    ${item.subtitle ? `<small>${item.subtitle}</small>` : ''}
                  </div>
                </div>
                <div class="tico-compare-row">
                  <div class="tico-compare-col free">
                    <span class="tico-compare-tag">Grátis</span>
                    <strong>${item.free}</strong>
                    ${item.freeNote ? `<small>${item.freeNote}</small>` : ''}
                  </div>
                  <div class="tico-compare-col pro">
                    <span class="tico-compare-tag">PRO</span>
                    <strong>${item.pro}</strong>
                    ${item.proNote ? `<small>${item.proNote}</small>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Rodapé: nota de segurança (não-PRO) ou alternar para grátis (PRO, uso interno) -->
        <div class="tico-plan-footer-section">
          ${isPro ? `
            <p class="tico-plan-success-notice">✅ Seu Plano PRO de R$ 29,90 já está 100% ativo nesta conta.</p>
            <button type="button" class="tico-btn-toggle-test" id="tico-toggle-free-btn">
              Alternar para Modo Grátis (Para Testes)
            </button>
          ` : `
            <p class="tico-plan-security-note">
              🔒 Pagamento seguro via Mercado Pago (PIX, cartão ou boleto) · Garantia de 7 dias ou seu dinheiro de volta
            </p>
          `}
        </div>
      `;

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
            await TicoPlan.setPlan('pro'); // navega para o Mercado Pago (não retorna se der certo)
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

      // Botão Alternar para Grátis (Para testes do criador do app)
      const toggleFreeBtn = inner.querySelector('#tico-toggle-free-btn');
      if (toggleFreeBtn) {
        toggleFreeBtn.addEventListener('click', async () => {
          await TicoPlan.setPlan('free');
          TicoPlan.renderModalContent(modal);
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
            <span>Gostou do treino? Desbloqueie todo o edital (37 capítulos e 111 fases) + Vidas Infinitas por apenas <strong>R$ 29,90</strong>.</span>
          </div>
          <button type="button" class="plan-banner-btn upgrade pulse" onclick="window.TicoPlan.openModal()">Desbloquear Tudo (R$ 29,90)</button>
        `;
      }
    },

    decorateChapterCards(isPro) {
      // Percorrer os capítulos na trilha
      const chapterCards = document.querySelectorAll('.vlp-chapter-card');
      chapterCards.forEach((card, idx) => {
        // Índices 0 a 4 (Capítulos 1 a 5) são gratuitos
        // Índices >= 5 (Capítulos 6 a 37) fazem parte do Plano PRO
        const isAdvancedChapter = idx >= PLAN_CONFIG.freeChapterLimit;

        let badge = card.querySelector('.tico-chapter-tier-badge');
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'tico-chapter-tier-badge';
          const header = card.querySelector('.vlp-chapter-header') || card.firstElementChild;
          if (header) header.appendChild(badge);
        }

        if (isAdvancedChapter) {
          if (isPro) {
            badge.className = 'tico-chapter-tier-badge is-pro';
            badge.innerHTML = '<span>✨ Desbloqueado com Plano PRO</span>';
            card.classList.remove('tico-chapter-locked-by-plan');
          } else {
            badge.className = 'tico-chapter-tier-badge is-pro-exclusive';
            badge.innerHTML = '<span>👑 Exclusivo Plano PRO (R$ 29,90)</span>';
            card.classList.add('tico-chapter-locked-by-plan');

            // Interceptar cliques nas fases deste capítulo avançado se for gratuito
            const phaseBtns = card.querySelectorAll('.vlp-phase-btn');
            phaseBtns.forEach(btn => {
              if (!btn.dataset.proIntercepted) {
                btn.dataset.proIntercepted = 'true';
                btn.addEventListener('click', (e) => {
                  if (!TicoPlan.isPro()) {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    TicoPlan.openModal('details', `🦉 O Capítulo ${idx + 1} é exclusivo do <strong>Plano PRO</strong>! Desbloqueie todos os 37 capítulos e 111 fases por apenas R$ 29,90.`);
                  }
                }, true);
              }
            });
          }
        } else {
          // Capítulos 1 a 5
          badge.className = 'tico-chapter-tier-badge is-free-unlocked';
          badge.innerHTML = '<span>🆓 Modo Gratuito</span>';
          card.classList.remove('tico-chapter-locked-by-plan');
        }
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
          <button type="button" onclick="window.TicoPlan.openModal()">Quero Ilimitadas por R$ 29,90</button>
        `;
      }
    },

    init() {
      window.TicoPlan = this;

      this.updateUI();
      this.checkPaymentReturn();

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
