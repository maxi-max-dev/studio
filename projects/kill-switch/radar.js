function drawRadar(canvasId, scores, labels) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const size = Math.min(canvas.parentElement.offsetWidth, 360);
  canvas.style.width = size + 'px';
  canvas.style.height = size + 'px';
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const cx = size / 2, cy = size / 2;
  const r = size * 0.36;
  const n = scores.length;
  const step = (Math.PI * 2) / n;
  const offset = -Math.PI / 2;

  ctx.clearRect(0, 0, size, size);

  // Grid rings
  [0.25, 0.5, 0.75, 1].forEach(frac => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = offset + i * step;
      const x = cx + Math.cos(a) * r * frac;
      const y = cy + Math.sin(a) * r * frac;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = frac === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Axes
  for (let i = 0; i < n; i++) {
    const a = offset + i * step;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Data fill
  ctx.beginPath();
  scores.forEach((s, i) => {
    const a = offset + i * step;
    const frac = s / 100;
    const x = cx + Math.cos(a) * r * frac;
    const y = cy + Math.sin(a) * r * frac;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = 'rgba(230, 57, 70, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#e63946';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Data points
  scores.forEach((s, i) => {
    const a = offset + i * step;
    const frac = s / 100;
    const x = cx + Math.cos(a) * r * frac;
    const y = cy + Math.sin(a) * r * frac;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#e63946';
    ctx.fill();
  });

  // Labels
  ctx.font = `600 ${Math.round(size * 0.033)}px -apple-system, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  scores.forEach((s, i) => {
    const a = offset + i * step;
    const lx = cx + Math.cos(a) * (r + size * 0.1);
    const ly = cy + Math.sin(a) * (r + size * 0.1);
    ctx.fillStyle = 'rgba(232,232,232,0.6)';
    ctx.fillText(labels[i], lx, ly);
  });
}

window.drawRadar = drawRadar;
