// ui.js — rendering and controls for 2027 Newsroom

const TOPIC_COLORS = {
  tech:          '#58a6ff',
  culture:       '#d2a8ff',
  business:      '#ffa657',
  investigation: '#ff7b72',
};

const TOPIC_LABELS = {
  tech: '科技', culture: '文化', business: '商业', investigation: '深度',
};

// ── Master render ───────────────────────────────────────────
function render() {
  renderClock();
  renderPipeline();
  renderWorkers();
  renderMetrics();
  renderCharts();
  renderEvents();
}

// ── Clock ───────────────────────────────────────────────────
function renderClock() {
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('sim-clock').textContent =
    `DAY ${state.day} · ${pad(state.hour)}:${pad(state.minute)}`;
}

// ── Pipeline ────────────────────────────────────────────────
function renderPipeline() {
  updateStage('pitching',  'stage-pitching');
  updateStage('drafting',  'stage-drafting');
  updateStage('editing',   'stage-editing');
  updatePublished();
}

function updateStage(stageName, elId) {
  const el       = document.getElementById(elId);
  const articles = state.articles.filter(a => a.stage === stageName);

  // Reconcile: remove cards no longer in this stage
  const existing = el.querySelectorAll('.article-card');
  const artIds   = new Set(articles.map(a => String(a.id)));
  existing.forEach(card => {
    if (!artIds.has(card.dataset.id)) card.remove();
  });

  // Add / update
  for (const art of articles) {
    let card = el.querySelector(`[data-id="${art.id}"]`);
    if (!card) {
      card = buildCard(art);
      el.appendChild(card);
    } else {
      // Update progress bar only
      const fill = card.querySelector('.progress-fill');
      if (fill) fill.style.width = art.progress.toFixed(1) + '%';
      // Update worker name if assigned mid-render
      const workerSpan = card.querySelector('.card-worker');
      if (workerSpan) {
        const w = art.workerId ? state.workers.find(w => w.id === art.workerId) : null;
        workerSpan.textContent = w ? w.name : '';
      }
    }
  }
}

function buildCard(art) {
  const card = document.createElement('div');
  card.className = 'article-card';
  card.dataset.id = art.id;

  const w = art.workerId ? state.workers.find(w => w.id === art.workerId) : null;

  card.innerHTML = `
    <div class="topic-stripe" style="background:${TOPIC_COLORS[art.topic]}"></div>
    <div class="card-title">${art.title}</div>
    <div class="card-footer">
      <span class="tag ${art.isAI ? 'tag-ai' : 'tag-human'}">${art.isAI ? 'AI' : 'HMN'}</span>
      <span class="card-worker">${w ? w.name : ''}</span>
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="background:${TOPIC_COLORS[art.topic]};width:${art.progress.toFixed(1)}%"></div>
    </div>
  `;
  return card;
}

function updatePublished() {
  const el     = document.getElementById('stage-published');
  const recent = state.published.slice(0, 10);

  // Check which newly-published articles need the flash class
  const justPubIds = new Set(recent.filter(a => a._justPub).map(a => String(a.id)));

  // Rebuild only if the id list has changed
  const currentIds = [...el.querySelectorAll('.article-card')].map(c => c.dataset.id);
  const newIds     = recent.map(a => String(a.id));
  if (JSON.stringify(currentIds) === JSON.stringify(newIds)) {
    // Clear _justPub flags even if no rebuild
    recent.forEach(a => { a._justPub = false; });
    return;
  }

  el.innerHTML = '';
  for (const art of recent) {
    const card = document.createElement('div');
    card.className = 'article-card' + (justPubIds.has(String(art.id)) ? ' just-pub' : '');
    card.dataset.id = art.id;

    const qColor = art.quality >= 80 ? '#56d364'
                 : art.quality >= 60 ? '#ffa657'
                 : '#8b949e';

    card.innerHTML = `
      <div class="topic-stripe" style="background:${TOPIC_COLORS[art.topic]}"></div>
      <div class="card-title">${art.title}</div>
      <div class="card-footer">
        <span class="tag ${art.isAI ? 'tag-ai' : 'tag-human'}">${art.isAI ? 'AI' : 'HMN'}</span>
        <span class="card-quality" style="color:${qColor}">Q:${art.quality}</span>
      </div>
    `;
    el.appendChild(card);
    art._justPub = false;
  }
}

// ── Workers ─────────────────────────────────────────────────
function renderWorkers() {
  const row = document.getElementById('workers-row');

  const currentIds = new Set([...row.querySelectorAll('.worker-chip')].map(c => c.dataset.wid));
  const liveIds    = new Set(state.workers.map(w => String(w.id)));

  // Remove gone workers
  row.querySelectorAll('.worker-chip').forEach(chip => {
    if (!liveIds.has(chip.dataset.wid)) chip.remove();
  });

  for (const w of state.workers) {
    let chip = row.querySelector(`[data-wid="${w.id}"]`);

    const art    = w.currentArticleId ? state.articles.find(a => a.id === w.currentArticleId) : null;
    const status = w.state === 'tired' ? 'resting'
                 : art ? art.stage
                 : 'idle';
    const cls    = `worker-chip ${w.state}`;
    const icon   = w.type === 'ai' ? '🤖' : '👤';

    if (!chip) {
      chip = document.createElement('div');
      chip.dataset.wid = w.id;
      row.appendChild(chip);
    }

    if (chip.className !== cls) chip.className = cls;

    chip.innerHTML = `
      <span class="worker-icon">${icon}</span>
      <span class="worker-name">${w.name}</span>
      <span class="worker-status">${status}</span>
    `;
  }
}

// ── Metrics ─────────────────────────────────────────────────
function renderMetrics() {
  const { audienceK, totalPublished, avgQuality, aiBylinesPercent, topicCounts } = state.metrics;

  document.getElementById('m-published').textContent = totalPublished;
  document.getElementById('m-quality').textContent   = avgQuality || '—';
  document.getElementById('m-ai-pct').textContent    = aiBylinesPercent + '%';

  if (audienceK >= 1000) {
    document.getElementById('m-audience').textContent = (audienceK / 1000).toFixed(1) + 'M';
  } else {
    document.getElementById('m-audience').textContent = Math.round(audienceK) + 'K';
  }

  const total  = Math.max(1, Object.values(topicCounts).reduce((a, b) => a + b, 0));
  const mixEl  = document.getElementById('content-mix');
  mixEl.innerHTML = Object.entries(topicCounts).map(([topic, count]) => `
    <div class="mix-row">
      <span class="mix-label">${TOPIC_LABELS[topic]}</span>
      <div class="mix-track">
        <div class="mix-fill" style="width:${((count / total) * 100).toFixed(0)}%;background:${TOPIC_COLORS[topic]}"></div>
      </div>
      <span class="mix-count">${count}</span>
    </div>
  `).join('');
}

// ── Charts ──────────────────────────────────────────────────
function drawLine(canvasId, data, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  ctx.clearRect(0, 0, W, H);

  const pts = data.length >= 2 ? data : [0, 0];
  const max = Math.max(...pts, 1);

  const px = (i) => (i / (pts.length - 1)) * (W - 12) + 6;
  const py = (v) => H - 6 - (v / max) * (H - 12);

  // Fill
  ctx.beginPath();
  ctx.moveTo(px(0), py(pts[0]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(px(i), py(pts[i]));
  ctx.lineTo(px(pts.length - 1), H - 6);
  ctx.lineTo(px(0), H - 6);
  ctx.closePath();
  ctx.fillStyle = color + '20';
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(px(0), py(pts[0]));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(px(i), py(pts[i]));
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // Last value label
  const last = pts[pts.length - 1];
  ctx.fillStyle = color;
  ctx.font = '9px Courier New, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(last, W - 4, 11);
  ctx.textAlign = 'left';
}

function renderCharts() {
  drawLine('chart-output',   state.history.outputPerHour, '#58a6ff');
  drawLine('chart-quality',  state.history.qualityScore,  '#56d364');
  drawLine('chart-audience', state.history.audienceK,     '#d2a8ff');
}

// ── Event log ───────────────────────────────────────────────
function renderEvents() {
  const el = document.getElementById('event-log');

  // Only rebuild when a new event arrives
  const firstTick = state.events.length ? String(state.events[0].tick) : '0';
  if (el.dataset.lastFirst === firstTick) return;
  el.dataset.lastFirst = firstTick;

  const frag = document.createDocumentFragment();
  for (const ev of state.events.slice(0, 9)) {
    const div = document.createElement('div');
    div.className = `event-item ${ev.type || ''}`;
    div.textContent = ev.text;
    frag.appendChild(div);
  }
  el.replaceChildren(frag);
}

// ── Controls ────────────────────────────────────────────────
function setupControls() {
  const SPEED_LABELS = { 1: 'SLOW', 2: 'NORMAL', 3: 'FAST' };
  const DEPTH_LABELS = { 1: 'QUICK', 2: 'BALANCED', 3: 'DEEP'  };

  function sync() {
    const aiRatio  = Number(document.getElementById('ai-ratio').value);
    const teamSize = Number(document.getElementById('team-size').value);
    const pubSpeed = Number(document.getElementById('pub-speed').value);
    const depth    = Number(document.getElementById('depth').value);

    state.config.aiRatio      = aiRatio / 100;
    state.config.teamSize     = teamSize;
    state.config.pubSpeed     = pubSpeed;
    state.config.contentDepth = depth;

    document.getElementById('ai-ratio-val').textContent  = aiRatio + '%';
    document.getElementById('team-size-val').textContent = teamSize;
    document.getElementById('pub-speed-val').textContent = SPEED_LABELS[pubSpeed];
    document.getElementById('depth-val').textContent     = DEPTH_LABELS[depth];

    rebuildWorkers();
    assignWorkers();
  }

  document.getElementById('ai-ratio').addEventListener('input',  sync);
  document.getElementById('team-size').addEventListener('input', sync);
  document.getElementById('pub-speed').addEventListener('input', sync);
  document.getElementById('depth').addEventListener('input',     sync);

  document.getElementById('btn-pause').addEventListener('click', () => {
    state.paused = !state.paused;
    const pill = document.getElementById('status-pill');
    const btn  = document.getElementById('btn-pause');
    if (state.paused) {
      pill.textContent = 'PAUSED';
      pill.classList.add('paused');
      btn.textContent = '▶';
    } else {
      pill.textContent = 'LIVE';
      pill.classList.remove('paused');
      btn.textContent = '⏸';
    }
  });
}

// ── Bootstrap ───────────────────────────────────────────────
function setupCanvases() {
  const dpr = window.devicePixelRatio || 1;
  ['chart-output', 'chart-quality', 'chart-audience'].forEach(id => {
    const c = document.getElementById(id);
    const lw = c.width, lh = c.height;
    c.width  = lw * dpr;
    c.height = lh * dpr;
    c.style.width  = lw + 'px';
    c.style.height = lh + 'px';
    c.getContext('2d').scale(dpr, dpr);
  });
}

(function start() {
  init();
  setupCanvases();
  setupControls();
  setInterval(() => { tick(); render(); }, 500);
})();
