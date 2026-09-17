/**
 * tico-hero-video.js - Troca a imagem estática do herói da landing page
 * por um vídeo curto (Tico acenando), sem tocar no bundle React
 * compilado — mesmo padrão de manipulação de DOM pós-render usado em
 * tico-plans.js/tico-account-form.js.
 *
 * Respeita prefers-reduced-motion (mantém a imagem estática) e volta pra
 * imagem original se o vídeo falhar ao carregar por qualquer motivo.
 */
(function () {
  'use strict';

  var VIDEO_SOURCES = [
    { src: '/hero-tico-wave.webm', type: 'video/webm' },
    { src: '/hero-tico-wave.mp4', type: 'video/mp4' },
  ];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function enhance(img) {
    if (prefersReducedMotion()) return;

    var video = document.createElement('video');
    video.className = img.className;
    video.setAttribute('role', 'img');
    video.setAttribute('aria-label', img.getAttribute('alt') || '');
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.poster = img.getAttribute('src') || '/landing-hero.png';

    VIDEO_SOURCES.forEach(function (s) {
      var source = document.createElement('source');
      source.src = s.src;
      source.type = s.type;
      video.appendChild(source);
    });

    // Se o vídeo falhar (rede, formato não suportado etc.), volta pra
    // imagem estática original em vez de deixar um espaço vazio.
    video.addEventListener('error', function () {
      if (video.isConnected) video.replaceWith(img);
    }, { once: true });

    img.replaceWith(video);
  }

  function tryEnhanceAll() {
    document.querySelectorAll('img.lp-hero-image[fetchpriority="high"]').forEach(enhance);
  }

  // O React pode recriar a landing page ao navegar de volta pra "/".
  var observer = new MutationObserver(tryEnhanceAll);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryEnhanceAll);
  } else {
    tryEnhanceAll();
  }
})();
