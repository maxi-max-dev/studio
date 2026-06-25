// Token Substrate — UI, Controls, Game Loop

const PRESETS = {
  'free-market': {
    label: '🏛 Free Market',
    config: { initialInequality: 65, corpAdvantage: 78, openSourceRate: 8, regulationStrength: 10 },
  },
  'regulated': {
    label: '⚖️ Regulated',
    config: { initialInequality: 38, corpAdvantage: 48, openSourceRate: 42, regulationStrength: 68 },
  },
  'open-wave': {
    label: '🌊 Open Source Wave',
    config: { initialInequality: 30, corpAdvantage: 35, openSourceRate: 85, regulationStrength: 38 },
  },
  'monopoly': {
    label: '🏰 Monopoly Endgame',
    config: { initialInequality: 92, corpAdvantage: 96, openSourceRate: 3, regulationStrength: 2 },
  },
};

const SLIDER_DEFS = [
  { id: 'sl-ineq', key: 'initialInequality', label: 'Starting Inequality' },
  { id: 'sl-corp', key: 'corpAdvantage',      label: 'Corp Advantage'      },
  { id: 'sl-open', key: 'openSourceRate',     label: 'Open Source Rate'    },
  { id: 'sl-reg',  key: 'regulationStrength', label: 'Regulation'          },
];

function fmtTokens(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(1)  + 'k';
  return Math.round(n).toString();
}

let sim, renderer, animId;
let ticksPerFrame = 1;
let activePreset  = null;

function init() {
  sim      = new Simulation();
  renderer = new Renderer(document.getElementById('sim-canvas'));

  window.addEventListener('resize', () => {
    renderer.resize();
    renderer.draw(sim);
  });

  buildPresets();
  buildSliders();
  buildPlayback();
  buildLegend();
  buildChart();

  sim.running = true;
  loop();
}

function loop() {
  for (let i = 0; i < ticksPerFrame; i++) {
    sim.step();
    sim.updatePhysics();
  }
  renderer.draw(sim);
  updateStats();
  updateChart();

  document.getElementById('tick-display').textContent = `T+${sim.tick}`;

  if (sim.running) animId = requestAnimationFrame(loop);
}

// ─── Presets ───────────────────────────────────────────────

function buildPresets() {
  const container = document.getElementById('preset-buttons');
  container.innerHTML = '';
  for (const [key, preset] of Object.entries(PRESETS)) {
    const btn = document.createElement('button');
    btn.className = 'preset-btn';
    btn.dataset.key = key;
    btn.textContent = preset.label;
    btn.addEventListener('click', () => applyPreset(key, btn));
    container.appendChild(btn);
  }
}

function applyPreset(key, btn) {
  const preset = PRESETS[key];
  if (!preset) return;
  Object.assign(sim.config, preset.config);
  sim.init();
  syncSliders();
  document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activePreset = key;

  // Resume if paused
  if (!sim.running) {
    sim.running = true;
    cancelAnimationFrame(animId);
    loop();
    document.getElementById('btn-play').textContent = 'Pause';
  }
}

// ─── Sliders ───────────────────────────────────────────────

function buildSliders() {
  const container = document.getElementById('slider-controls');
  container.innerHTML = '';
  for (const def of SLIDER_DEFS) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    row.innerHTML = `
      <label for="${def.id}">
        <span class="sl-label">${def.label}</span>
        <span class="sl-val" id="${def.id}-val">${sim.config[def.key]}</span>
      </label>
      <input type="range" id="${def.id}" min="0" max="100"
             value="${sim.config[def.key]}" step="1">
    `;
    row.querySelector('input').addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      sim.config[def.key] = val;
      document.getElementById(`${def.id}-val`).textContent = val;
      document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
      activePreset = null;
    });
    container.appendChild(row);
  }
}

function syncSliders() {
  for (const def of SLIDER_DEFS) {
    const input = document.getElementById(def.id);
    const val   = document.getElementById(`${def.id}-val`);
    if (input) input.value = sim.config[def.key];
    if (val)   val.textContent = sim.config[def.key];
  }
}

// ─── Playback ──────────────────────────────────────────────

function buildPlayback() {
  document.getElementById('btn-play').addEventListener('click', () => {
    sim.running = !sim.running;
    document.getElementById('btn-play').textContent = sim.running ? 'Pause' : 'Play';
    if (sim.running) { cancelAnimationFrame(animId); loop(); }
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    cancelAnimationFrame(animId);
    sim.init();
    sim.running = true;
    loop();
    document.getElementById('btn-play').textContent = 'Pause';
  });

  document.getElementById('btn-speed').addEventListener('click', () => {
    ticksPerFrame = ticksPerFrame < 4 ? ticksPerFrame * 2 : 1;
    const labels = { 1: '1×', 2: '2×', 4: '4×' };
    document.getElementById('btn-speed').textContent = (labels[ticksPerFrame] || '1×') + ' Speed';
  });
}

// ─── Legend ────────────────────────────────────────────────

function buildLegend() {
  const container = document.getElementById('legend-items');
  container.innerHTML = `
    <div class="legend-item"><div class="legend-dot dot-corp"></div>Corp · monopolizes compute</div>
    <div class="legend-item"><div class="legend-dot dot-open"></div>Open-source · shares gains</div>
    <div class="legend-item"><div class="legend-dot dot-ind"></div>Individual · fights to survive</div>
  `;
}

// ─── Stats bar ─────────────────────────────────────────────

function updateStats() {
  const s = sim.getStats();

  const giniPct = Math.round(s.gini * 100);
  const corpPct = Math.round(s.corpShare * 100);
  const survPct = Math.round(s.survival * 100);

  setText('stat-gini',     giniPct + '%');
  setText('stat-corp',     corpPct + '%');
  setText('stat-survival', survPct + '%');
  setText('stat-commons',    fmtTokens(s.commons));
  setText('stat-innovators', s.innovators != null ? String(s.innovators) : '—');

  // Gini bar: green→yellow→red
  setBar('gini-fill', giniPct,
    giniPct < 40 ? '#5ae0a0' : giniPct < 65 ? '#e0c05a' : '#e05a5a');

  // Survival bar: red→yellow→green
  setBar('surv-fill', survPct,
    survPct > 65 ? '#5ae0a0' : survPct > 35 ? '#e0c05a' : '#e05a5a');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setBar(id, pct, color) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = pct + '%';
  el.style.backgroundColor = color;
}

// ─── Timeline chart ────────────────────────────────────────

let svgLines = {};

function buildChart() {
  const svg = document.getElementById('timeline-svg');
  const ns  = 'http://www.w3.org/2000/svg';

  // Gridlines matched to chart scale (TOP_PAD=5%, USE_H=90% of VB_H)
  const VB_H = 42;
  const TOP_PAD_G = VB_H * 0.05;
  const USE_H_G   = VB_H * 0.9;
  for (const [v, label] of [[1.0, '100%'], [0.5, '50%'], [0.0, '0%']]) {
    const y = TOP_PAD_G + USE_H_G * (1 - v);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', '0'); line.setAttribute('x2', '280');
    line.setAttribute('y1', y.toFixed(1)); line.setAttribute('y2', y.toFixed(1));
    line.setAttribute('stroke', 'rgba(255,255,255,0.07)');
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '2');
    text.setAttribute('y', (y - 1.2).toFixed(1));
    text.setAttribute('fill', 'rgba(255,255,255,0.25)');
    text.setAttribute('font-size', '4');
    text.setAttribute('font-family', 'monospace');
    text.textContent = label;
    svg.appendChild(text);
  }

  const lineDefs = [
    { id: 'ln-gini',     color: '#e05a5a' },
    { id: 'ln-surv',     color: '#5aaae0' },
    { id: 'ln-noncorp',  color: '#5ae0a0' },
  ];
  for (const def of lineDefs) {
    const el = document.createElementNS(ns, 'polyline');
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', def.color);
    el.setAttribute('stroke-width', '1.5');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('stroke-linecap', 'round');
    el.id = def.id;
    svg.appendChild(el);
    svgLines[def.id] = el;
  }
}

function updateChart() {
  const h = sim.history;
  if (h.length < 2) return;

  const recent = h.slice(-100);
  const VB_W = 280, VB_H = 42;
  const TOP_PAD = VB_H * 0.05;
  const USE_H   = VB_H * 0.9;

  // All three metrics are in [0,1] — use absolute scale so gridlines are accurate
  const toPoints = (getter) =>
    recent.map((r, i) => {
      const x = (i / (recent.length - 1)) * VB_W;
      const v = Math.max(0, Math.min(1, getter(r)));
      const y = TOP_PAD + USE_H * (1 - v);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

  svgLines['ln-gini'].setAttribute('points',    toPoints(r => r.gini));
  svgLines['ln-surv'].setAttribute('points',    toPoints(r => r.survival));
  svgLines['ln-noncorp'].setAttribute('points', toPoints(r => 1 - r.corpShare));
}

window.addEventListener('load', init);
