/**
 * Tico Interactive Engine — Estilo Duolingo
 * Adiciona interatividade tátil, sombras de contato, partículas e falas motivacionais
 */
(function () {
  'use strict';

  const CONCURSO_QUOTES = [
    'Bora gabaritar essa banca! 🎯',
    'Uma questão de cada vez, futuro(a) concursado(a)! 🚀',
    'Constância é o que vence qualquer edital! 📚',
    'O Tico aprova o seu foco hoje! ⭐',
    'Respira fundo: o Diário Oficial te espera! 📜',
    'Errar no treino é acertar no dia da prova! 💡',
    'Lei seca + questões diárias = fórmula da posse! ⚖️',
    'Mantenha a sequência: cada dia conta! 🔥',
    'Você está mais perto da sua vaga do que ontem! 🏆',
    'Foco no processo, a nomeação é consequência! ✨',
    'Parabéns pela dedicação! Não desiste agora! 🐾'
  ];

  let audioCtx = null;
  function playDuolingoPop() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(740, now + 0.12);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch {
      // Audio autoplay policy
    }
  }

  function spawnSparkles(container) {
    const count = 6;
    for (let i = 0; i < count; i++) {
      const sparkle = document.createElement('div');
      sparkle.className = 'tico-sparkle';

      const angle = (i / count) * 2 * Math.PI;
      const dist = 30 + Math.random() * 25;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 15;

      sparkle.style.setProperty('--dx', `${dx}px`);
      sparkle.style.setProperty('--dy', `${dy}px`);
      sparkle.style.left = '50%';
      sparkle.style.top = '50%';
      sparkle.style.background = i % 2 === 0 ? '#58cc02' : '#fbbf24';

      container.appendChild(sparkle);
      setTimeout(() => sparkle.remove(), 850);
    }
  }

  function showQuoteBubble(mascotEl) {
    let bubble = mascotEl.parentElement?.querySelector('.tico-speech-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'tico-speech-bubble';
      mascotEl.parentElement?.appendChild(bubble);
    }

    const randomQuote = CONCURSO_QUOTES[Math.floor(Math.random() * CONCURSO_QUOTES.length)];
    bubble.textContent = randomQuote;
    bubble.classList.remove('active');

    void bubble.offsetWidth;
    bubble.classList.add('active');

    if (mascotEl._bubbleTimeout) {
      clearTimeout(mascotEl._bubbleTimeout);
    }
    mascotEl._bubbleTimeout = setTimeout(() => {
      bubble.classList.remove('active');
    }, 2800);
  }

  function handleTicoClick(e) {
    const mascot = e.currentTarget;
    playDuolingoPop();

    mascot.classList.remove('tico-poked');
    void mascot.offsetWidth;
    mascot.classList.add('tico-poked');

    if (mascot.parentElement) {
      spawnSparkles(mascot.parentElement);
      showQuoteBubble(mascot);
    }

    setTimeout(() => {
      mascot.classList.remove('tico-poked');
    }, 750);
  }

  function enhanceMascotElement(mascot) {
    if (mascot.dataset.duoEnhanced === 'true') return;
    mascot.dataset.duoEnhanced = 'true';

    if (!mascot.getAttribute('data-pose')) {
      const bgPos = mascot.style.backgroundPosition || '';
      if (bgPos.includes('100%')) {
        if (bgPos.includes('0%')) mascot.setAttribute('data-pose', '3');
        else if (bgPos.includes('50%')) mascot.setAttribute('data-pose', '4');
        else mascot.setAttribute('data-pose', '5');
      } else {
        if (bgPos.includes('50%')) mascot.setAttribute('data-pose', '1');
        else if (bgPos.includes('100%')) mascot.setAttribute('data-pose', '2');
        else mascot.setAttribute('data-pose', '0');
      }
    }

    const parent = mascot.parentElement;
    if (parent && !parent.querySelector('.tico-ground-shadow') && !parent.classList.contains('no-shadow')) {
      const shadow = document.createElement('div');
      shadow.className = 'tico-ground-shadow';
      const mascotSize = mascot.style.getPropertyValue('--mascot-size') || '180px';
      shadow.style.width = `calc(${mascotSize} * 0.62)`;
      parent.style.position = parent.style.position || 'relative';
      parent.appendChild(shadow);
    }

    mascot.setAttribute('tabindex', '0');
    mascot.setAttribute('title', 'Clique no Tico para receber uma dica de aprovação!');
    mascot.addEventListener('click', handleTicoClick);
    mascot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleTicoClick(e);
      }
    });
  }

  function scanAndEnhance() {
    const mascots = document.querySelectorAll('.mascot');
    mascots.forEach(enhanceMascotElement);
  }

  // Throttled scan usando requestAnimationFrame para economizar CPU e bateria em dispositivos móveis
  let scanScheduled = false;
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanAndEnhance();
      scanScheduled = false;
    });
  }

  const observer = new MutationObserver((mutations) => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      scheduleScan();
    }
  });

  // Economia de energia móvel: suspende Web Audio quando tela do celular bloqueia ou aba fica em background
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend().catch(() => {});
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      scanAndEnhance();
      observer.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    scanAndEnhance();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
