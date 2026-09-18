/**
 * tico-mascot-animations.js - Micro-interação: tocar no Tico faz ele
 * reagir com uma pulinho animado e uma das poses alegres do próprio
 * sprite (mascot.png tem 6 poses numa grade 3x2, mas até agora só a
 * pose padrão — canto superior esquerdo — era exibida). Nenhum asset
 * novo é necessário.
 *
 * Segue o mesmo padrão do resto do projeto: manipulação de DOM
 * pós-render via MutationObserver, já que o React recria os elementos
 * `.mascot` ao trocar de tela.
 */
(function () {
  'use strict';

  var CHEER_FRAMES = ['tico-frame-cheer1', 'tico-frame-cheer2', 'tico-frame-cheer3', 'tico-frame-cheer4'];
  var REACTION_DURATION_MS = 650;

  function wire(el) {
    if (el.dataset.ticoAnimWired === 'true') return;
    el.dataset.ticoAnimWired = 'true';
    el.style.cursor = 'pointer';

    el.addEventListener('click', function () {
      if (el.dataset.ticoReacting === 'true') return;
      el.dataset.ticoReacting = 'true';

      var frameClass = CHEER_FRAMES[Math.floor(Math.random() * CHEER_FRAMES.length)];
      el.classList.add('tico-reacting', frameClass);

      setTimeout(function () {
        el.classList.remove('tico-reacting', frameClass);
        el.dataset.ticoReacting = 'false';
      }, REACTION_DURATION_MS);
    });
  }

  function tryWireAll() {
    document.querySelectorAll('.mascot').forEach(wire);
  }

  var observer = new MutationObserver(tryWireAll);
  observer.observe(document.body, { childList: true, subtree: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryWireAll);
  } else {
    tryWireAll();
  }
})();
