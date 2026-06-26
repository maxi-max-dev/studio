// Nomos UI + main loop

let running = false;
let animId = null;
let frameCount = 0;
let lastYearDisplayed = -1;

function getSpeed() {
  return parseInt(document.getElementById('sl-speed').value, 10);
}

function updateMetrics() {
  const alive = state.agents.filter(a => a.alive);
  const pop = alive.length;
  const avgW = pop > 0 ? alive.reduce((s, a) => s + a.wealth, 0) / pop : 0;
  const gini = state.history.gini.length > 0
    ? state.history.gini[state.history.gini.length - 1]
    : 0;

  document.getElementById('year-val').textContent = state.year;
  document.getElementById('m-pop').textContent = pop;
  document.getElementById('m-gini').textContent = gini.toFixed(2);
  document.getElementById('m-wealth').textContent = avgW.toFixed(0);
  document.getElementById('m-treas').textContent = Math.round(state.treasury);
}

function loop() {
  if (!running) return;
  const speed = getSpeed();
  for (let i = 0; i < speed; i++) {
    tick();
    if (state.agents.filter(a => a.alive).length === 0) {
      running = false;
      document.getElementById('btn-run').textContent = '▶ 开始';
      break;
    }
  }
  drawAll();
  updateMetrics();
  animId = requestAnimationFrame(loop);
}

function startStop() {
  running = !running;
  document.getElementById('btn-run').textContent = running ? '⏸ 暂停' : '▶ 开始';
  if (running) loop();
}

function reset() {
  running = false;
  if (animId) cancelAnimationFrame(animId);
  document.getElementById('btn-run').textContent = '▶ 开始';
  initWorld();
  drawAll();
  updateMetrics();
}

function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;
  Object.assign(constitution, p);

  document.getElementById('sl-tax').value     = Math.round(p.taxRate * 100);
  document.getElementById('v-tax').textContent = Math.round(p.taxRate * 100) + '%';

  document.getElementById('sl-land').value    = p.landCap;
  document.getElementById('v-land').textContent = p.landCap === 0 ? '不限' : p.landCap + '格';

  document.getElementById('sl-inherit').value = Math.round(p.inheritanceTax * 100);
  document.getElementById('v-inherit').textContent = Math.round(p.inheritanceTax * 100) + '%';

  document.getElementById('sl-market').value  = Math.round(p.marketFreedom * 100);
  document.getElementById('v-market').textContent = Math.round(p.marketFreedom * 100) + '%';

  document.querySelectorAll('.rb').forEach(b => {
    b.classList.toggle('active', b.dataset.v === p.redistribution);
  });
  constitution.redistribution = p.redistribution;

  document.querySelectorAll('.preset').forEach(b => {
    b.classList.toggle('active', b.dataset.preset === name);
  });
}

function wireSlider(id, valId, toConstitution, transform, display) {
  const el = document.getElementById(id);
  const vEl = document.getElementById(valId);
  el.addEventListener('input', () => {
    const raw = parseInt(el.value, 10);
    constitution[toConstitution] = transform(raw);
    vEl.textContent = display(raw);
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
  });
}

function init() {
  initWorld();

  // Sliders
  wireSlider('sl-tax',     'v-tax',     'taxRate',      v => v / 100,   v => v + '%');
  wireSlider('sl-inherit', 'v-inherit', 'inheritanceTax', v => v / 100, v => v + '%');
  wireSlider('sl-market',  'v-market',  'marketFreedom', v => v / 100,  v => v + '%');
  wireSlider('sl-land',    'v-land',    'landCap',      v => v,
    v => v === 0 ? '不限' : v + '格');

  // Redistribution radio
  document.getElementById('redist-group').addEventListener('click', e => {
    const btn = e.target.closest('.rb');
    if (!btn) return;
    document.querySelectorAll('.rb').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    constitution.redistribution = btn.dataset.v;
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
  });

  // Presets
  document.getElementById('presets').addEventListener('click', e => {
    const btn = e.target.closest('.preset');
    if (!btn) return;
    applyPreset(btn.dataset.preset);
  });

  // Controls
  document.getElementById('btn-run').addEventListener('click', startStop);
  document.getElementById('btn-reset').addEventListener('click', reset);

  // Initial draw
  drawAll();
  updateMetrics();
}

document.addEventListener('DOMContentLoaded', init);
