'use strict';

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._frameCount = 0;
    this._starCanvas = document.createElement('canvas');
    this._starCtx = this._starCanvas.getContext('2d');
    this._W = 0;
    this._H = 0;
  }

  resize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._dpr = dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._W = w;
    this._H = h;
    this._buildStarfield(w, h);
  }

  _buildStarfield(w, h) {
    const sc = this._starCanvas;
    const sctx = this._starCtx;
    sc.width = w;
    sc.height = h;
    sctx.clearRect(0, 0, w, h);
    const count = Math.floor(w * h / 2400);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const bright = Math.random() < 0.04;
      const r = bright ? 0.88 : 0.42;
      const a = bright
        ? (0.22 + Math.random() * 0.22).toFixed(3)
        : (0.05 + Math.random() * 0.11).toFixed(3);
      sctx.beginPath();
      sctx.arc(x, y, r, 0, Math.PI * 2);
      sctx.fillStyle = `rgba(210,225,248,${a})`;
      sctx.fill();
    }
  }

  draw(universe) {
    const ctx = this.ctx;
    const W = this._W;
    const H = this._H;
    this._frameCount++;

    // Background tint shifts to warm dark when universe is dying
    ctx.fillStyle = universe.dying ? '#080202' : '#00000a';
    ctx.fillRect(0, 0, W, H);

    // Starfield dims during phase transition
    if (universe.dying) {
      ctx.globalAlpha = 0.35;
      ctx.drawImage(this._starCanvas, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(this._starCanvas, 0, 0);
    }

    this._drawBubbles(ctx, universe, W, H);
    this._drawParticles(ctx, universe);
  }

  _drawBubbles(ctx, universe, W, H) {
    for (const b of universe.bubbles) {
      if (b.radius < 3) continue;
      const r = b.radius;
      // Draw at 9 periodic positions so bubbles wrap correctly at screen edges
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bx = b.x + ox * W;
          const by = b.y + oy * H;
          if (bx + r < 0 || bx - r > W || by + r < 0 || by - r > H) continue;
          this._drawOneBubble(ctx, bx, by, r, b.age);
        }
      }
    }
  }

  _drawOneBubble(ctx, bx, by, r, age) {
    const pulse = 0.75 + 0.25 * Math.sin(age * 0.042);

    // Subtle true-vacuum interior tint
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(70, 150, 100, 0.016)';
    ctx.fill();

    // Primary glowing rim — brightness pulses with bubble age
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(178,255,210,${(0.38 + 0.20 * pulse).toFixed(2)})`;
    ctx.lineWidth = 1.2;
    ctx.shadowBlur = Math.round(13 + 11 * pulse);
    ctx.shadowColor = '#a5d6a7';
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Outer halo rings
    for (let i = 1; i <= 3; i++) {
      const alpha = (0.13 - i * 0.032) * pulse;
      if (alpha <= 0) continue;
      ctx.beginPath();
      ctx.arc(bx, by, r + i * 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(160,240,190,${alpha.toFixed(3)})`;
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
  }

  _drawParticles(ctx, universe) {
    const COLORS = {
      'matter-false':     { fill: '#4FC3F7', shadow: '#0277BD' },
      'matter-true':      { fill: '#80CBC4', shadow: '#00695C' },
      'dark-false':       { fill: '#7986CB', shadow: '#283593' },
      'dark-true':        { fill: '#CE93D8', shadow: '#6A1B9A' },
      'antimatter-false': { fill: '#FF8A65', shadow: '#BF360C' },
      'antimatter-true':  { fill: '#FFD54F', shadow: '#E65100' },
    };

    // Group by visual key to minimise ctx state changes
    const groups = {};
    for (const p of universe.particles) {
      const k = p.type + '-' + p.phase;
      if (!groups[k]) groups[k] = [];
      groups[k].push(p);
    }

    ctx.shadowBlur = 7;

    for (const key of Object.keys(groups)) {
      const c = COLORS[key];
      if (!c) continue;
      const list = groups[key];
      ctx.fillStyle = c.fill;
      ctx.shadowColor = c.shadow;

      for (const p of list) {
        const r = p.type === 'dark'
          ? 2.0
          : Math.max(1.1, 1.4 + p.energy * 1.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
  }
}
