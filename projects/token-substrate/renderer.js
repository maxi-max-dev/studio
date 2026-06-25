// Token Substrate — Canvas Renderer

function fmtT(n) {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + 'T';
  if (n >= 1e9)  return (n / 1e9).toFixed(1)  + 'B';
  if (n >= 1e6)  return (n / 1e6).toFixed(1)  + 'M';
  if (n >= 1e3)  return (n / 1e3).toFixed(0)  + 'k';
  return Math.round(n).toString();
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.dW = 0;
    this.dH = 0;
    this._scaleCache = null;
    this.resize();
  }

  resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width  = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width  = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dW = w;
    this.dH = h;
    this._scaleCache = null;
  }

  _getScale() {
    if (this._scaleCache) return this._scaleCache;
    const sx = this.dW / WORLD.W;
    const sy = this.dH / WORLD.H;
    const s  = Math.min(sx, sy) * 0.94;
    const ox = (this.dW - WORLD.W * s) / 2;
    const oy = (this.dH - WORLD.H * s) / 2;
    this._scaleCache = { s, ox, oy };
    return this._scaleCache;
  }

  ws(x, y) {
    const { s, ox, oy } = this._getScale();
    return { x: x * s + ox, y: y * s + oy, s };
  }

  draw(sim) {
    const ctx = this.ctx;
    const W = this.dW, H = this.dH;
    const { s: worldScale } = this._getScale();

    // Clear
    ctx.fillStyle = '#0d0d0f';
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = 'rgba(255,255,255,0.022)';
    ctx.lineWidth = 1;
    const gs = 44;
    for (let x = gs / 2; x < W; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = gs / 2; y < H; y += gs) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Commons glow at center
    if (sim.commons > 20) {
      const c = this.ws(WORLD.W / 2, WORLD.H / 2);
      const gR = Math.min(55, 12 + Math.sqrt(sim.commons) * 0.6);
      const alpha = Math.min(0.35, sim.commons / 5000);
      const grd = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, gR * c.s);
      grd.addColorStop(0, `rgba(90,224,160,${alpha})`);
      grd.addColorStop(1, 'rgba(90,224,160,0)');
      ctx.beginPath();
      ctx.arc(c.x, c.y, gR * c.s, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Flows
    this._drawFlows(sim.flows);

    // Dead agents — ghost rings that expand and fade over 200 ticks
    for (const a of sim.agents) {
      if (a.alive) continue;
      const ticksSince = sim.tick - a.diedAt;
      if (ticksSince > 200) continue;
      const progress = ticksSince / 200;
      const alpha = Math.max(0, (1 - progress) * 0.4);
      const ringR  = (3 + progress * 13) * worldScale;
      const p = this.ws(a.x, a.y);
      ctx.beginPath();
      ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // Alive agents — corps last (on top)
    const alive = sim.agents.filter(a => a.alive);
    const nonCorps = alive.filter(a => a.type !== 'corp');
    const corps    = alive.filter(a => a.type === 'corp');

    for (const a of nonCorps) this._drawAgent(a, sim.tick);
    for (const a of corps)    this._drawAgent(a, sim.tick);
  }

  _drawFlows(flows) {
    const ctx = this.ctx;
    for (const f of flows) {
      const p1 = this.ws(f.x1, f.y1);
      const p2 = this.ws(f.x2, f.y2);
      const t  = f.t;

      // Particle dot
      const px = p1.x + (p2.x - p1.x) * t;
      const py = p1.y + (p2.y - p1.y) * t;

      // Fading trail behind particle
      const trailLen = 0.18;
      const t0 = Math.max(0, t - trailLen);
      const tx0 = p1.x + (p2.x - p1.x) * t0;
      const ty0 = p1.y + (p2.y - p1.y) * t0;
      const alpha = Math.sin(t * Math.PI) * 0.7;

      ctx.beginPath();
      ctx.moveTo(tx0, ty0);
      ctx.lineTo(px, py);
      ctx.strokeStyle = f.color + Math.round(alpha * 200).toString(16).padStart(2, '0');
      ctx.lineWidth = f.magnitude > 80 ? 2 : 1.2;
      ctx.stroke();

      // Particle head
      ctx.beginPath();
      ctx.arc(px, py, f.magnitude > 80 ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fillStyle = f.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  _drawAgent(a, tick) {
    const ctx = this.ctx;
    const p = this.ws(a.x, a.y);
    const r = a.radius * p.s;

    if (a.type === 'corp') {
      // Outer glow — pulses for 40 ticks after an acquisition event
      const ticksSinceAcq = tick - a.lastAcquisition;
      const pulsing = ticksSinceAcq >= 0 && ticksSinceAcq < 40;
      const pulseBoost = pulsing
        ? 1 + Math.sin((ticksSinceAcq / 40) * Math.PI) * 2.0
        : 1;
      const glowR    = r * 2.2 * pulseBoost;
      const glowAlpha = Math.min(0.55, 0.18 * pulseBoost);
      const grd = ctx.createRadialGradient(p.x, p.y, r * 0.5, p.x, p.y, glowR);
      grd.addColorStop(0, `rgba(224,90,90,${glowAlpha.toFixed(3)})`);
      grd.addColorStop(1, 'rgba(224,90,90,0)');
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#9a1a1a';
      ctx.fill();
      ctx.strokeStyle = '#e05a5a';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      const fontSize = Math.max(8, Math.min(15, r * 0.55));
      ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(a.labelShort, p.x, p.y);

      // Token count below (if large enough)
      if (r > 22) {
        ctx.font = `${Math.max(7, fontSize * 0.7)}px 'JetBrains Mono', monospace`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(fmtT(a.tokens), p.x, p.y + r * 0.62);
      }

    } else if (a.type === 'open') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#1a4a35';
      ctx.fill();
      ctx.strokeStyle = '#5ae0a0';
      ctx.lineWidth = 1;
      ctx.stroke();

    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#162038';
      ctx.fill();
      ctx.strokeStyle = '#5aaae0';
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }
}
