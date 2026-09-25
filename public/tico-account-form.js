/**
 * tico-account-form.js - Liga de verdade o formulário de Cadastro/Entrar.
 *
 * O bundle React compilado (public/assets/index-*.js) renderiza esse
 * formulário 100% travado (fieldset disabled, botão type="button" sem
 * onClick, nenhum input controlado) como uma prévia "EM BREVE" — não há
 * como recompilar esse bundle (não existe pipeline de build neste
 * repositório). Este script segue o mesmo padrão já usado em
 * tico-plans.js/tico-banca-redacao.js: manipula o DOM depois que o React
 * renderiza, reagindo com um MutationObserver porque o React pode
 * recriar esse card ao navegar entre /cadastro e /entrar.
 */
(function () {
  'use strict';

  function isSignupMode() {
    return window.location.pathname.startsWith('/cadastro');
  }

  function makeField(label, attrs) {
    const wrapper = document.createElement('label');
    wrapper.className = 'account-field';
    wrapper.appendChild(document.createTextNode(label));
    const span = document.createElement('span');
    const input = document.createElement('input');
    input.autocomplete = 'off';
    Object.entries(attrs).forEach(([k, v]) => input.setAttribute(k, v));
    span.appendChild(input);
    wrapper.appendChild(span);
    return { wrapper, input };
  }

  // Confirma no próprio Supabase que a sessão em cache ainda vale antes de
  // usá-la pra decidir qualquer coisa. Cache local sobrevive a um token
  // expirado/revogado — sem checar de verdade, alguém nessa situação era
  // mandado direto pra /jogar e só descobria que não estava mais logado
  // quando a primeira chamada autenticada lá dentro desse 401. Chamada
  // direta em window.supabase (nunca de dentro de um onAuthStateChange:
  // supabase-client.js já evita isso na hidratação — ver hydrateSessionUser).
  function cachedSessionStillValid() {
    if (!window.supabase || typeof window.supabase.auth?.getSession !== 'function') {
      return Promise.resolve(false);
    }
    return window.supabase.auth.getSession()
      .then(({ data }) => Boolean(data?.session?.user))
      .catch(() => false);
  }

  function enhance(card) {
    if (card.dataset.ticoAccountReady === 'true' || card.dataset.ticoAccountChecking === 'true') return;

    // Quem já está logado (ex.: acabou de voltar do login por Google, ou
    // simplesmente ainda tem a sessão de antes) não deveria ver o
    // formulário de novo ao cair em /cadastro ou /entrar. Lê o
    // localStorage direto (mesma convenção de tico-plans.js) em vez de
    // depender de window.MissaoFirebase — esse módulo carrega de forma
    // assíncrona e pode ainda não estar pronto neste ponto.
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem('missao_aprovacao_auth_user') || 'null');
    } catch (_) {}
    if (currentUser && !currentUser.isGuest) {
      card.dataset.ticoAccountChecking = 'true';
      cachedSessionStillValid().then((valid) => {
        delete card.dataset.ticoAccountChecking;
        if (valid) {
          window.location.href = '/jogar';
          return;
        }
        // Sessão em cache não é mais válida — não redireciona às cegas.
        // Limpa o cache velho e deixa o formulário de entrar/cadastrar aparecer.
        try {
          localStorage.removeItem('missao_aprovacao_auth_user');
          localStorage.removeItem('missao_aprovacao_user_profile');
        } catch (_) {}
        buildForm(card);
      });
      return;
    }

    buildForm(card);
  }

  // Depois de clicar no link de "Esqueci minha senha" do e-mail, o Supabase
  // traz a pessoa de volta pra /entrar com um token de recuperação no
  // FRAGMENTO da URL (#access_token=...&type=recovery...) — checável na
  // hora, sem depender de nenhum módulo assíncrono ainda estar pronto.
  function isPasswordRecoveryReturn() {
    return window.location.hash.includes('type=recovery');
  }

  function buildRecoveryForm(card, notice, fieldset) {
    notice.textContent = 'Defina sua nova senha para continuar.';
    fieldset.innerHTML = '';

    const { wrapper: pwWrapper, input: newPwInput } = makeField('Nova senha', {
      type: 'password', placeholder: 'Mínimo 6 caracteres', 'aria-label': 'Nova senha',
    });
    const { wrapper: pw2Wrapper, input: confirmPwInput } = makeField('Confirme a nova senha', {
      type: 'password', placeholder: 'Repita a nova senha', 'aria-label': 'Confirmar nova senha',
    });
    fieldset.appendChild(pwWrapper);
    fieldset.appendChild(pw2Wrapper);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'account-submit-btn';
    btn.textContent = 'Salvar nova senha';
    fieldset.appendChild(btn);

    let alertBox = null;
    function showAlert(kind, message) {
      if (!alertBox) {
        alertBox = document.createElement('div');
        btn.insertAdjacentElement('afterend', alertBox);
      }
      alertBox.className = kind === 'error' ? 'account-alert-error' : 'account-alert-success';
      alertBox.textContent = message;
    }

    async function handleSave() {
      if (!window.MissaoFirebase) {
        showAlert('error', 'Ainda carregando. Tente de novo em um instante.');
        return;
      }
      if (newPwInput.value !== confirmPwInput.value) {
        showAlert('error', 'As senhas não coincidem.');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Salvando...';
      try {
        await window.MissaoFirebase.updatePassword(newPwInput.value);
        // Limpa o token da URL pra não tentar de novo se a pessoa recarregar.
        history.replaceState(null, '', window.location.pathname + window.location.search);
        showAlert('success', 'Senha atualizada! Faça login com sua nova senha.');
        btn.remove();
        pwWrapper.remove();
        pw2Wrapper.remove();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Salvar nova senha';
        showAlert('error', err.message || 'Não foi possível atualizar sua senha agora.');
      }
    }
    btn.addEventListener('click', handleSave);
    [newPwInput, confirmPwInput].forEach((input) => {
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } });
    });
  }

  function buildForm(card) {
    if (card.dataset.ticoAccountReady === 'true') return;

    const notice = card.querySelector('#preview-notice');
    const fieldset = card.querySelector('fieldset[disabled]');
    if (!notice || !fieldset) return;
    card.dataset.ticoAccountReady = 'true';

    const soonBadge = card.querySelector('.account-soon');
    if (soonBadge) soonBadge.remove();
    fieldset.disabled = false;

    if (isPasswordRecoveryReturn()) {
      buildRecoveryForm(card, notice, fieldset);
      return;
    }

    const signup = isSignupMode();

    // Captura os inputs originais (Nome[só cadastro]/E-mail/Senha) por
    // posição, ANTES de inserir qualquer coisa nova no fieldset.
    const originalInputs = Array.from(fieldset.querySelectorAll('label.account-field input'));
    const nameInput = signup ? originalInputs[0] : null;
    const emailInput = signup ? originalInputs[1] : originalInputs[0];
    const passwordInput = signup ? originalInputs[2] : originalInputs[1];

    notice.textContent = signup
      ? 'Seus dados ficam seguros — usados só para acompanhar seu progresso e liberar o Plano PRO quando você assinar.'
      : 'Entre com a conta que você já criou.';

    originalInputs.forEach((input) => {
      input.disabled = false;
      const label = input.getAttribute('aria-label') || '';
      input.setAttribute('aria-label', label.replace(/\s*—\s*cadastro em breve/i, ''));
    });
    if (passwordInput) {
      passwordInput.placeholder = signup ? 'Crie uma senha (mínimo 6 caracteres)' : 'Sua senha';
    }

    let whatsappInput = null;
    let cidadeInput = null;
    if (signup) {
      const whatsappField = makeField('Seu WhatsApp (com DDD)', {
        type: 'tel',
        placeholder: '(11) 91234-5678',
        'aria-label': 'WhatsApp',
      });
      const cidadeField = makeField('Sua cidade', {
        type: 'text',
        placeholder: 'Sua cidade',
        'aria-label': 'Cidade',
      });
      whatsappInput = whatsappField.input;
      cidadeInput = cidadeField.input;
      const passwordLabel = passwordInput.closest('label.account-field');
      passwordLabel.insertAdjacentElement('afterend', cidadeField.wrapper);
      passwordLabel.insertAdjacentElement('afterend', whatsappField.wrapper);
    }

    const oldBtn = fieldset.querySelector('button.account-disabled');
    const newBtn = document.createElement('button');
    newBtn.type = 'button';
    newBtn.className = 'account-submit-btn';
    const idleLabel = signup ? 'Criar minha conta' : 'Entrar na minha conta';
    newBtn.textContent = idleLabel;
    oldBtn.replaceWith(newBtn);

    // "Continuar com Google" — a única opção de Google que existia no
    // app ficava na página de Perfil (fazia sentido na época do login
    // opcional/anônimo, mas não é onde alguém entrando ou se cadastrando
    // vai procurar). Mesmo botão pros dois modos: o Supabase decide
    // sozinho se é um cadastro novo ou login numa conta já existente.
    const googleDivider = document.createElement('div');
    googleDivider.className = 'account-google-divider';
    googleDivider.textContent = 'ou';

    const googleBtn = document.createElement('button');
    googleBtn.type = 'button';
    googleBtn.className = 'account-google-btn';
    googleBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.26h2.92c1.71-1.57 2.69-3.88 2.69-6.63z"/>
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
        <path fill="#FBBC05" d="M3.97 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3.01-2.33z"/>
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
      </svg>
      <span>Continuar com Google</span>
    `;
    newBtn.insertAdjacentElement('afterend', googleDivider);
    googleDivider.insertAdjacentElement('afterend', googleBtn);

    async function handleGoogleClick() {
      if (!window.MissaoFirebase) {
        showAlert('error', 'Ainda carregando. Tente de novo em um instante.');
        return;
      }
      googleBtn.disabled = true;
      try {
        await window.MissaoFirebase.loginWithGoogle(); // navega pro Google — não retorna se der certo
      } catch (err) {
        googleBtn.disabled = false;
        showAlert('error', err.message || 'Não foi possível conectar com o Google agora.');
      }
    }
    googleBtn.addEventListener('click', handleGoogleClick);

    let alertBox = null;
    function showAlert(kind, message) {
      if (!alertBox) {
        alertBox = document.createElement('div');
        newBtn.insertAdjacentElement('afterend', alertBox);
      }
      alertBox.className = kind === 'error' ? 'account-alert-error' : 'account-alert-success';
      alertBox.textContent = message;
    }

    async function handleSubmit() {
      if (!window.MissaoFirebase) {
        showAlert('error', 'Ainda carregando. Tente de novo em um instante.');
        return;
      }
      newBtn.disabled = true;
      newBtn.textContent = signup ? 'Criando sua conta...' : 'Entrando...';
      try {
        if (signup) {
          const result = await window.MissaoFirebase.registerUser({
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value,
            whatsapp: whatsappInput.value.trim(),
            cidade: cidadeInput.value.trim(),
          });
          if (result && result.pendingConfirmation) {
            // Isto É sucesso — o cadastro foi criado, só falta confirmar o
            // e-mail. Antes isso vinha como uma exceção e caía no catch
            // abaixo, mostrando a mesma cor de erro de uma falha real.
            newBtn.disabled = false;
            newBtn.textContent = idleLabel;
            showAlert('success', `Cadastro criado! Enviamos um link de confirmação para ${result.email}. Confirme seu e-mail e depois entre com sua senha.`);
            return;
          }
        } else {
          await window.MissaoFirebase.loginWithEmail(emailInput.value.trim(), passwordInput.value);
        }
        showAlert('success', 'Pronto! Redirecionando...');
        window.location.href = '/jogar';
      } catch (err) {
        newBtn.disabled = false;
        newBtn.textContent = idleLabel;
        showAlert('error', err.message || 'Não foi possível concluir. Tente novamente.');
      }
    }

    newBtn.addEventListener('click', handleSubmit);
    originalInputs.concat(whatsappInput || [], cidadeInput || []).forEach((input) => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
      });
    });

    if (!signup) {
      const forgotLink = document.createElement('button');
      forgotLink.type = 'button';
      forgotLink.className = 'account-forgot-link';
      forgotLink.textContent = 'Esqueci minha senha';
      newBtn.insertAdjacentElement('afterend', forgotLink);

      forgotLink.addEventListener('click', async () => {
        const email = emailInput.value.trim();
        if (!email) {
          showAlert('error', 'Informe seu e-mail no campo acima e clique em "Esqueci minha senha" de novo.');
          emailInput.focus();
          return;
        }
        if (!window.MissaoFirebase) {
          showAlert('error', 'Ainda carregando. Tente de novo em um instante.');
          return;
        }
        forgotLink.disabled = true;
        try {
          await window.MissaoFirebase.sendPasswordReset(email);
          showAlert('success', `Enviamos um link de recuperação para ${email}. Verifique sua caixa de entrada (e o spam).`);
        } catch (err) {
          showAlert('error', err.message || 'Não foi possível enviar o e-mail de recuperação agora.');
        } finally {
          forgotLink.disabled = false;
        }
      });
    }
  }

  function tryEnhanceAll() {
    document.querySelectorAll('.account-card').forEach(enhance);
  }

  const observer = new MutationObserver(tryEnhanceAll);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryEnhanceAll);
  } else {
    tryEnhanceAll();
  }
})();
