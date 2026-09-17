/**
 * tico-plans.js - Sistema de Planos (Modo Grátis vs Modo PRO R$ 29,90)
 * Missão Aprovação: Plataforma Gamificada para Concursos Públicos
 */

(function() {
  'use strict';

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

    async setPlan(newPlan, paymentMethod = 'pix_instantaneo') {
      const safePlan = newPlan === 'pro' ? 'pro' : 'free';
      localStorage.setItem('missao_aprovacao_plan', safePlan);

      // Atualizar objeto do usuário no localStorage
      try {
        const userRaw = localStorage.getItem('missao_aprovacao_auth_user');
        if (userRaw) {
          const user = JSON.parse(userRaw);
          user.plan = safePlan;
          user.planPrice = PLAN_CONFIG.price;
          if (safePlan === 'pro') {
            user.proActivatedAt = new Date().toISOString();
          }
          localStorage.setItem('missao_aprovacao_auth_user', JSON.stringify(user));
          localStorage.setItem('missao_aprovacao_user_profile', JSON.stringify(user));
        }
      } catch (_) {}

      // Sincronizar com Firebase se disponível
      if (window.MissaoFirebase && typeof window.MissaoFirebase.upgradeUserPlan === 'function') {
        try {
          await window.MissaoFirebase.upgradeUserPlan(safePlan, paymentMethod);
        } catch (e) {
          console.warn('[TicoPlan] Erro ao sincronizar com Firebase:', e);
        }
      }

      // Notificar a aplicação
      window.dispatchEvent(new CustomEvent('plan_state_changed', {
        detail: { plan: safePlan, planPrice: PLAN_CONFIG.price, paymentMethod }
      }));

      // Atualizar interface imediatamente
      this.updateUI();
      return true;
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
            <h2 id="tico-profile-modal-title" class="tico-plan-title">${user.name || 'Concurseiro'}</h2>
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
              <button type="button" class="tico-plan-cta-button pulse" id="tico-open-checkout-btn">
                <span>Quero Ser PRO Agora</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            `}
          </div>
        </div>

        <!-- Tabela Comparativa de Planos: Grátis vs PRO -->
        <div class="tico-plan-compare-box">
          <h3 class="tico-plan-compare-title">Compare o Modo Grátis com o Modo PRO</h3>
          <div class="tico-plan-table-wrap">
            <table class="tico-plan-table">
              <thead>
                <tr>
                  <th class="col-feature">Recurso do Jogo</th>
                  <th class="col-free">Modo Grátis</th>
                  <th class="col-pro">Modo PRO (R$ 29,90) 👑</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="col-feature">
                    <strong>💖 Vidas / Corações</strong>
                    <small>Margem para errar e aprender</small>
                  </td>
                  <td class="col-free">
                    <span class="badge-free">5 Vidas</span>
                    <small>Espera recarregar ao zerar</small>
                  </td>
                  <td class="col-pro">
                    <span class="badge-pro">Vidas Infinitas (∞)</span>
                    <small>Estude sem parar nem travar</small>
                  </td>
                </tr>
                <tr>
                  <td class="col-feature">
                    <strong>🗺️ Trilha do Edital</strong>
                    <small>Capítulos e fases mapeadas</small>
                  </td>
                  <td class="col-free">
                    <span class="badge-free">Capítulos 1 a 5</span>
                    <small>Foco nas matérias base</small>
                  </td>
                  <td class="col-pro">
                    <span class="badge-pro">37 Capítulos & 111 Fases</span>
                    <small>100% do edital completo</small>
                  </td>
                </tr>
                <tr>
                  <td class="col-feature">
                    <strong>✍️ Oficina de Redação com IA</strong>
                    <small>Correções do Professor Tico</small>
                  </td>
                  <td class="col-free">
                    <span class="badge-free">1 por semana</span>
                    <small>Avaliação preliminar</small>
                  </td>
                  <td class="col-pro">
                    <span class="badge-pro">Submissões Ilimitadas</span>
                    <small>Com espelho oficial e reescrita</small>
                  </td>
                </tr>
                <tr>
                  <td class="col-feature">
                    <strong>🏛️ Bancas Examinadoras</strong>
                    <small>Critérios de correção</small>
                  </td>
                  <td class="col-free">
                    <span class="badge-free">Básico</span>
                    <small>Cebraspe simplificado</small>
                  </td>
                  <td class="col-pro">
                    <span class="badge-pro">Cebraspe, FGV, FCC, Vunesp</span>
                    <small>Modelos e esqueletos oficiais</small>
                  </td>
                </tr>
                <tr>
                  <td class="col-feature">
                    <strong>📊 Raio-X de Fraquezas</strong>
                    <small>Diagnóstico pedagógico</small>
                  </td>
                  <td class="col-free">
                    <span class="badge-free-cross">✕ Não incluso</span>
                  </td>
                  <td class="col-pro">
                    <span class="badge-pro">✓ Raio-X Detalhado</span>
                    <small>Mapeia onde você mais erra</small>
                  </td>
                </tr>
                <tr>
                  <td class="col-feature">
                    <strong>🏆 Selo VIP no Ranking</strong>
                    <small>Destaque entre concorrentes</small>
                  </td>
                  <td class="col-free">
                    <span class="badge-free">Padrão</span>
                  </td>
                  <td class="col-pro">
                    <span class="badge-pro">⭐ Selo Dourado PRO</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Área de Checkout e Simulação de Pagamento -->
        <div class="tico-plan-checkout-section" id="tico-plan-checkout-area">
          <h4 class="tico-plan-checkout-title">Forma de Pagamento (Ativação Instantânea)</h4>
          
          <div class="tico-checkout-tabs">
            <button type="button" class="tico-checkout-tab active" data-method="pix">
              <span>⚡ PIX (Liberação Imediata)</span>
            </button>
            <button type="button" class="tico-checkout-tab" data-method="cartao">
              <span>💳 Cartão de Crédito</span>
            </button>
          </div>

          <div class="tico-checkout-method-body" id="tico-method-pix">
            <div class="tico-pix-box">
              <div class="tico-pix-qr-sim">
                <div class="tico-qr-placeholder">
                  <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#1a4d6f" stroke-width="1.8">
                    <rect x="3" y="3" width="7" height="7"></rect>
                    <rect x="14" y="14" width="7" height="7"></rect>
                    <rect x="14" y="3" width="7" height="7"></rect>
                    <rect x="3" y="14" width="7" height="7"></rect>
                    <line x1="7" y1="7" x2="7.01" y2="7"></line>
                    <line x1="17" y1="7" x2="17.01" y2="7"></line>
                    <line x1="7" y1="17" x2="7.01" y2="17"></line>
                    <line x1="17" y1="17" x2="17.01" y2="17"></line>
                  </svg>
                  <span>QR Code PIX</span>
                </div>
              </div>
              <div class="tico-pix-info">
                <p class="tico-pix-val">Valor único com desconto: <strong>R$ 29,90</strong></p>
                <div class="tico-pix-code-field">
                  <input type="text" readonly value="00020126580014br.gov.bcb.pix0136missao-aprovacao-pro-2990-chave-pix520400005303986540529.905802BR" id="tico-pix-copy-input">
                  <button type="button" class="tico-copy-btn" id="tico-copy-pix-btn">Copiar Código</button>
                </div>
                <small class="tico-pix-tip">A liberação do Plano PRO é automática e imediata após o pagamento.</small>
              </div>
            </div>
          </div>

          <div class="tico-checkout-method-body hidden" id="tico-method-cartao">
            <div class="tico-card-sim-form">
              <div class="tico-card-field-row">
                <input type="text" placeholder="Número do Cartão (0000 0000 0000 0000)" maxlength="19" class="tico-card-input">
              </div>
              <div class="tico-card-field-grid">
                <input type="text" placeholder="Nome Impresso" class="tico-card-input">
                <input type="text" placeholder="MM/AA" maxlength="5" class="tico-card-input">
                <input type="text" placeholder="CVV" maxlength="4" class="tico-card-input">
              </div>
              <div class="tico-card-installments">
                <label>Parcelamento: <strong>1x de R$ 29,90 sem juros</strong></label>
              </div>
            </div>
          </div>

          <!-- Botões de Ação do Checkout -->
          <div class="tico-plan-actions-bar">
            ${isPro ? `
              <div class="tico-plan-active-actions">
                <p class="tico-plan-success-notice">✅ Seu Plano PRO de R$ 29,90 já está 100% ativo nesta conta.</p>
                <button type="button" class="tico-btn-toggle-test" id="tico-toggle-free-btn">
                  Alternar para Modo Grátis (Para Testes)
                </button>
              </div>
            ` : `
              <button type="button" class="tico-plan-confirm-btn pulse" id="tico-confirm-pro-btn">
                <span>⚡ Ativar Modo PRO (R$ 29,90) Agora</span>
              </button>
              <p class="tico-plan-security-note">
                🔒 Garantia de 7 dias ou seu dinheiro de volta · Pagamento seguro e blindado
              </p>
            `}
          </div>
        </div>
      `;

      // Eventos dos botões de tabs de pagamento
      const tabBtns = inner.querySelectorAll('.tico-checkout-tab');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const method = btn.dataset.method;
          const pixBody = inner.querySelector('#tico-method-pix');
          const cartaoBody = inner.querySelector('#tico-method-cartao');
          if (method === 'pix') {
            pixBody.classList.remove('hidden');
            cartaoBody.classList.add('hidden');
          } else {
            pixBody.classList.add('hidden');
            cartaoBody.classList.remove('hidden');
          }
        });
      });

      // Botão Copiar PIX
      const copyBtn = inner.querySelector('#tico-copy-pix-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const input = inner.querySelector('#tico-pix-copy-input');
          if (input) {
            input.select();
            navigator.clipboard?.writeText(input.value).then(() => {
              copyBtn.textContent = 'Copiado! ✓';
              setTimeout(() => { copyBtn.textContent = 'Copiar Código'; }, 2000);
            }).catch(() => {
              copyBtn.textContent = 'Copiado!';
            });
          }
        });
      }

      // Botão Scroll para Checkout
      const openCheckoutBtn = inner.querySelector('#tico-open-checkout-btn');
      if (openCheckoutBtn) {
        openCheckoutBtn.addEventListener('click', () => {
          const checkoutArea = inner.querySelector('#tico-plan-checkout-area');
          if (checkoutArea) {
            checkoutArea.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }

      // Botão Ativar PRO (Instantâneo para demonstração/teste e persistência real)
      const confirmBtn = inner.querySelector('#tico-confirm-pro-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '<span>Processando ativação...</span>';

          await TicoPlan.setPlan('pro', 'pix_instantaneo');

          // Feedback de sucesso com animação
          inner.innerHTML = `
            <div class="tico-plan-success-splash">
              <div class="tico-success-icon">🎉👑</div>
              <h2>Parabéns, Concurseiro PRO!</h2>
              <p>Seu <strong>Passaporte Aprovação PRO (R$ 29,90)</strong> foi ativado com sucesso.</p>
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

          inner.querySelector('#tico-close-and-enjoy-btn')?.addEventListener('click', () => {
            TicoPlan.closeModal();
          });
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

      // 1. Botão de Plano no Topo / Header
      this.injectHeaderTrigger(isPro);

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
          <span class="user-name-label">${firstName}</span>
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

      // Injetar Botão de Plano PRO
      let badgeBtn = document.getElementById('tico-pro-plan-header-badge');
      if (!badgeBtn) {
        badgeBtn = document.createElement('button');
        badgeBtn.id = 'tico-pro-plan-header-badge';
        badgeBtn.type = 'button';
        badgeBtn.className = 'tico-pro-header-btn';
        badgeBtn.addEventListener('click', () => this.openModal());

        if (container) {
          container.appendChild(badgeBtn);
        } else {
          document.body.appendChild(badgeBtn);
          badgeBtn.classList.add('floating-top-right');
        }
      }

      if (isPro) {
        badgeBtn.className = 'tico-pro-header-btn is-pro';
        badgeBtn.innerHTML = `
          <span class="pro-crown">👑</span>
          <span class="pro-text">PRO ATIVO</span>
        `;
        badgeBtn.title = 'Plano PRO Ativo (Acesso Ilimitado R$ 29,90) - Clique para ver detalhes';
      } else {
        badgeBtn.className = 'tico-pro-header-btn is-free pulse';
        badgeBtn.innerHTML = `
          <span class="pro-crown">👑</span>
          <span class="pro-text">MODO PRO · R$ 29,90</span>
          <span class="pro-highlight">Vidas ∞</span>
        `;
        badgeBtn.title = 'Desbloqueie todo o edital, vidas infinitas e redações com IA por R$ 29,90';
      }
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
