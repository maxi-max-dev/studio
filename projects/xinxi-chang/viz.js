/**
 * 信息场 · Canvas 渲染层
 */

class Visualizer {
  constructor(sim) {
    this.sim = sim;
    this.ctx = sim.ctx;
    this._raf = null;
    this._running = false;
  }

  start() {
    if (this._running) return;
    this._running = true;
    const loop = () => {
      if (!this._running) return;
      this._draw();
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  _draw() {
    const ctx = this.ctx;
    const W = this.sim.W, H = this.sim.H;
    if (!W || !H) return;

    // Apply DPR scaling so all coords are in CSS pixels
    const dpr = this.sim.dpr || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Clear
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, W, H);

    this._drawFields();
    this._drawAudience();
    this._drawParticles();
    this._drawWells();
    this._drawCaptures();
  }

  _drawFields() {
    const ctx = this.ctx;
    const W = this.sim.W, H = this.sim.H;

    this.sim.wells.forEach(wl => {
      if (wl.strength < 0.05) return;
      const r = 80 + wl.strength * 60;
      const grd = ctx.createRadialGradient(wl.x, wl.y, 0, wl.x, wl.y, r);
      const alpha = Math.min(0.22, 0.05 + wl.strength * 0.04);
      grd.addColorStop(0,   hexAlpha(wl.color, alpha * 2.2));
      grd.addColorStop(0.5, hexAlpha(wl.color, alpha));
      grd.addColorStop(1,   hexAlpha(wl.color, 0));
      ctx.beginPath();
      ctx.arc(wl.x, wl.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    });
  }

  _drawWells() {
    const ctx = this.ctx;
    this.sim.wells.forEach(wl => {
      const s = wl.strength;
      const baseR = 14 + s * 6;

      // Outer ring pulse
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 + wl.x);
      ctx.beginPath();
      ctx.arc(wl.x, wl.y, baseR + 6 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(wl.color, 0.12 + pulse * 0.08);
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Core circle
      ctx.beginPath();
      ctx.arc(wl.x, wl.y, baseR, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(wl.x, wl.y, 0, wl.x, wl.y, baseR);
      grd.addColorStop(0, hexAlpha(wl.color, 0.9));
      grd.addColorStop(1, hexAlpha(wl.color, 0.25));
      ctx.fillStyle = grd;
      ctx.fill();

      // Label
      ctx.font = '11px "Helvetica Neue", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.85;
      ctx.fillText(wl.name, wl.x, wl.y);
      ctx.globalAlpha = 1;

      // Strength bar (arc underneath)
      if (s > 0.1) {
        const barR = baseR + 14;
        const barLen = Math.PI * 2 * (s / 6);
        ctx.beginPath();
        ctx.arc(wl.x, wl.y, barR, -Math.PI / 2, -Math.PI / 2 + barLen);
        ctx.strokeStyle = hexAlpha(wl.color, 0.55);
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    });
  }

  _drawParticles() {
    const ctx = this.ctx;
    this.sim.particles.forEach(p => {
      const lifeRatio = Math.min(1, p.life / 7);

      // Trail
      if (p.trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.strokeStyle = hexAlpha(p.color, 0.18 * lifeRatio);
        ctx.lineWidth = p.r * 0.6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Particle dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.5);
      grd.addColorStop(0, hexAlpha(p.color, 0.95 * lifeRatio));
      grd.addColorStop(1, hexAlpha(p.color, 0));
      ctx.fillStyle = grd;
      ctx.fill();
    });
  }

  _drawAudience() {
    const ctx = this.ctx;
    this.sim.audience.forEach(a => {
      const topic = TOPICS.find(t => t.id === a.affinity);
      const col = topic ? topic.color : '#888';
      const lit = a.lit;

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(col, 0.12 + lit * 0.55);
      ctx.fill();

      if (lit > 0.05) {
        ctx.beginPath();
        ctx.arc(a.x, a.y, a.r + 4 + lit * 6, 0, Math.PI * 2);
        ctx.fillStyle = hexAlpha(col, lit * 0.18);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(col, 0.35 + lit * 0.5);
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Bounce ring on capture
      if (a.captureFlash > 0) {
        const ringR = a.r + (1 - a.captureFlash) * 16;
        ctx.beginPath();
        ctx.arc(a.x, a.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = hexAlpha(col, a.captureFlash * 0.8);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });
  }

  _drawCaptures() {
    const ctx = this.ctx;
    this.sim.captured.forEach(c => {
      const t = 1 - c.life;
      const r = 12 + t * 60;
      const alpha = c.life * 0.7;
      ctx.beginPath();
      ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = hexAlpha(c.color, alpha);
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(c.x, c.y, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = hexAlpha(c.color, alpha * 0.6);
      ctx.fill();
    });
  }
}

function hexAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
}

window.Visualizer = Visualizer;
window.hexAlpha   = hexAlpha;
