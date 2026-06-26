// Nomos renderer

const CELL = 10;

const COLOR = {
  bgDark:  '#0d0d12',
  bord:    '#22222e',
  poor:    '#4a70b0',
  mid:     '#4aaf80',
  rich:    '#c9a84c',
  dead:    '#c94c4c',
  line:    '#c9a84c',
  gridFg:  '#1a1a24',
};

// Wealth → agent dot color
function agentColor(wealth) {
  if (wealth < 0)  return COLOR.dead;
  if (wealth < 25) return COLOR.poor;
  if (wealth < 80) return COLOR.mid;
  return COLOR.rich;
}

// Ownership tint for cells
function cellFill(cell) {
  if (cell.ownerId === null) {
    const f = cell.fertility;
    const v = Math.round(15 + f * 22);
    return `rgb(${v},${v},${v + 8})`;
  }
  const owner = state.agentById[cell.ownerId];
  if (!owner || !owner.alive) {
    return '#181820';
  }
  const w = owner.wealth;
  if (w < 0)  return '#2a1418';
  if (w < 25) return '#131824';
  if (w < 80) return '#121e18';
  return '#201a08';
}

function drawSim() {
  const canvas = document.getElementById('sim-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cw = canvas.width, ch = canvas.height;

  // Draw cells
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cell = state.cells[cellIdx(x, y)];
      ctx.fillStyle = cellFill(cell);
      ctx.fillRect(x * CELL, y * CELL, CELL, CELL);

      if (cell.ownerId !== null) {
        const owner = state.agentById[cell.ownerId];
        if (owner && owner.alive) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }
  }

  // Batch agents by color for perf
  const byColor = {};
  for (const a of state.agents) {
    if (!a.alive) continue;
    const col = agentColor(a.wealth);
    if (!byColor[col]) byColor[col] = [];
    byColor[col].push(a);
  }

  const R = 3;
  for (const [col, agents] of Object.entries(byColor)) {
    ctx.fillStyle = col;
    for (const a of agents) {
      const cx = a.x * CELL + CELL / 2;
      const cy = a.y * CELL + CELL / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawLineChart(canvasId, data, color, minVal, maxVal) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, w, h);

  if (data.length < 2) return;

  const lo = minVal ?? Math.min(...data);
  const hi = maxVal ?? Math.max(...data);
  const range = hi - lo || 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((data[i] - lo) / range) * (h - 4) - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Last value label
  const last = data[data.length - 1];
  ctx.fillStyle = color;
  ctx.font = '9px SF Mono, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(
    Number.isInteger(last) ? last : last.toFixed(2),
    w - 3, 11
  );
}

function drawDistChart() {
  const canvas = document.getElementById('ch-dist');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, w, h);

  const alive = state.agents.filter(a => a.alive);
  if (alive.length === 0) return;

  const sorted = alive.map(a => a.wealth).sort((a, b) => a - b);
  const n = sorted.length;
  const buckets = 10;
  const bucketSize = Math.ceil(n / buckets);
  const barW = Math.floor(w / buckets);
  const gap = 2;

  const bucketMeans = [];
  for (let b = 0; b < buckets; b++) {
    const slice = sorted.slice(b * bucketSize, (b + 1) * bucketSize);
    const mean = slice.length > 0 ? slice.reduce((s, v) => s + v, 0) / slice.length : 0;
    bucketMeans.push(Math.max(0, mean));
  }

  const maxM = Math.max(...bucketMeans, 1);

  for (let b = 0; b < buckets; b++) {
    const barH = Math.max(2, (bucketMeans[b] / maxM) * (h - 14));
    const x = b * barW + gap;
    const bw = barW - gap * 2;

    // color by decile
    const t = b / (buckets - 1);
    if (t < 0.33) ctx.fillStyle = COLOR.poor;
    else if (t < 0.67) ctx.fillStyle = COLOR.mid;
    else ctx.fillStyle = COLOR.rich;

    ctx.fillRect(x, h - barH - 12, bw, barH);

    ctx.fillStyle = '#5a5a78';
    ctx.font = '8px SF Mono, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText((b + 1) * 10 + '%', x + bw / 2, h - 2);
  }
}

function drawAll() {
  drawSim();
  drawLineChart('ch-pop',    state.history.pop,    '#4aaf80', 0, MAX_AGENTS);
  drawLineChart('ch-gini',   state.history.gini,   '#c94c4c', 0, 1);
  drawLineChart('ch-wealth', state.history.wealth, '#c9a84c', 0, null);
  drawDistChart();
}
