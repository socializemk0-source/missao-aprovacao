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

  function enhance(card) {
    if (card.dataset.ticoAccountReady === 'true') return;
    const notice = card.querySelector('#preview-notice');
    const fieldset = card.querySelector('fieldset[disabled]');
    if (!notice || !fieldset) return;
    card.dataset.ticoAccountReady = 'true';

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

    const soonBadge = card.querySelector('.account-soon');
    if (soonBadge) soonBadge.remove();

    fieldset.disabled = false;
    originalInputs.forEach((input) => {
      input.disabled = false;
      const label = input.getAttribute('aria-label') || '';
      input.setAttribute('aria-label', label.replace(/\s*—\s*cadastro em breve/i, ''));
    });
    if (passwordInput) passwordInput.placeholder = 'Crie uma senha (mínimo 6 caracteres)';

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
          await window.MissaoFirebase.registerUser({
            name: nameInput.value.trim(),
            email: emailInput.value.trim(),
            password: passwordInput.value,
            whatsapp: whatsappInput.value.trim(),
            cidade: cidadeInput.value.trim(),
          });
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
