'use strict';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('universe');
  const universe = new Universe(window.innerWidth, window.innerHeight);
  const renderer = new Renderer(canvas);
  renderer.resize(window.innerWidth, window.innerHeight);

  const commentary = new Commentary(document.getElementById('commentary-text'));
  setTimeout(() => commentary.show('birth'), 1400);

  // ── Resize ──────────────────────────────────────
  window.addEventListener('resize', () => {
    const W = window.innerWidth, H = window.innerHeight;
    renderer.resize(W, H);
    universe.width = W;
    universe.height = H;
  });

  // ── Click to nucleate ────────────────────────────
  canvas.addEventListener('click', e => {
    if (e.target !== canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = (canvas.width / (window.devicePixelRatio || 1)) / rect.width;
    const sy = (canvas.height / (window.devicePixelRatio || 1)) / rect.height;
    universe.nucleateBubble(
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top) * sy
    );
    commentary.show('nucleation');
  });

  // ── Controls ─────────────────────────────────────
  let paused = false;
  let speed = 1;
  let rebirthPending = false;
  let rebirthTimer = null;

  const btnPause = document.getElementById('btn-pause');
  const btnSpeed = document.getElementById('btn-speed');
  const btnReset = document.getElementById('btn-reset');

  btnPause.addEventListener('click', () => {
    paused = !paused;
    btnPause.textContent = paused ? '继续' : '暂停';
  });

  btnSpeed.addEventListener('click', () => {
    speed = speed < 3 ? 3 : (speed < 5 ? 5 : 1);
    btnSpeed.textContent = speed + '× 速';
  });

  btnReset.addEventListener('click', () => {
    // Cancel any pending auto-rebirth to avoid a double-reset
    if (rebirthTimer) { clearTimeout(rebirthTimer); rebirthTimer = null; }
    rebirthPending = false;
    universe.reset();
    commentary.show('birth');
  });

  // ── Stats DOM refs ────────────────────────────────
  const statAge     = document.getElementById('stat-age');
  const statGen     = document.getElementById('stat-gen');
  const statFvf     = document.getElementById('stat-fvf');
  const statBubbles = document.getElementById('stat-bubbles');
  const statStatus  = document.getElementById('stat-status');

  // ── Main loop ─────────────────────────────────────
  function loop() {
    if (!paused) {
      for (let s = 0; s < speed; s++) {
        const events = universe.step();
        for (const ev of events) {
          commentary.trigger(ev.type, universe.age);

          if (ev.type === 'rebirth' && !rebirthPending) {
            rebirthPending = true;
            rebirthTimer = setTimeout(() => {
              universe.reset();
              commentary.show('birth');
              rebirthPending = false;
              rebirthTimer = null;
            }, 3200);
          }
        }
      }
      commentary.trigger('tick', universe.age);
    }

    // Update HUD
    const st = universe.getStats();
    statAge.textContent     = st.age.toLocaleString();
    statGen.textContent     = st.generation;
    statFvf.textContent     = (st.falseVacFrac * 100).toFixed(1) + '%';
    statBubbles.textContent = st.bubbleCount;

    if (st.dying) {
      statStatus.textContent = '相变中';
      statStatus.className   = 'state-dying';
    } else if (st.bubbleCount) {
      statStatus.textContent = '核化';
      statStatus.className   = 'state-nucleation';
    } else {
      statStatus.textContent = '亚稳态';
      statStatus.className   = '';
    }

    renderer.draw(universe);
    requestAnimationFrame(loop);
  }

  loop();
});
