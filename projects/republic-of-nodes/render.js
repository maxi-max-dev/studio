// render.js — 节点共和国 Canvas Renderer

class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.world  = world;
    this.frame  = 0;

    this.COLORS = {
      builder:    '#3b82f6',
      scout:      '#f59e0b',
      trader:     '#10b981',
      researcher: '#8b5cf6',
      bg:         '#060a12',
      grid:       '#0b1628',
      resource:   '#1e3a8a',
      resourceHi: '#3b82f6',
    };
  }

  render() {
    this.frame++;
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;
    const f   = this.frame;

    // Background
    ctx.fillStyle = this.COLORS.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle dot grid
    ctx.fillStyle = '#0d1a2e';
    const gs = 32;
    for (let gx = gs; gx < W; gx += gs) {
      for (let gy = gs; gy < H; gy += gs) {
        ctx.beginPath();
        ctx.arc(gx, gy, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Coalition connections
    this.world.coalitions.forEach(coalition => {
      const members = coalition.members
        .map(id => this.world.agents.find(a => a.id === id))
        .filter(Boolean);
      if (members.length < 2) return;

      ctx.save();
      ctx.strokeStyle = 'rgba(148,163,184,0.12)';
      ctx.lineWidth   = 1;
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          ctx.beginPath();
          ctx.moveTo(members[i].x, members[i].y);
          ctx.lineTo(members[j].x, members[j].y);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // Resource nodes
    this.world.resources.forEach(r => {
      if (!r.discovered) {
        // Faint undiscovered hint (glimmer)
        const alpha = 0.04 + 0.02 * Math.sin(f * 0.04 + r.id * 1.3);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#94a3b8';
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return;
      }

      const fill  = r.current / r.effectiveCapacity();
      const pulse = 0.7 + 0.3 * Math.sin(f * 0.025 + r.id * 0.8);
      const lvl   = r.level;
      const rad   = 7 + lvl * 2.5;
      const col   = lvl > 2 ? this.COLORS.resourceHi : this.COLORS.resource;

      // Outer glow
      ctx.save();
      const grd = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, rad * 3.5);
      grd.addColorStop(0, col + '30');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(r.x, r.y, rad * 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Hexagon body
      this._hexagon(ctx, r.x, r.y, rad, col, fill * pulse);

      // Fill level bar inside hex
      if (fill < 0.35) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad + 3.5, -Math.PI / 2, -Math.PI / 2 + fill * Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Level label
      if (lvl > 0.3) {
        ctx.save();
        ctx.fillStyle  = col;
        ctx.font       = '8px monospace';
        ctx.textAlign  = 'center';
        ctx.globalAlpha = 0.7;
        ctx.fillText('L' + lvl.toFixed(1), r.x, r.y + rad + 11);
        ctx.restore();
      }
    });

    // Agents
    this.world.agents.filter(a => a.alive).forEach(agent => {
      const col   = this.COLORS[agent.type];
      const ratio = Math.min(1, agent.tokens / 100);
      const pulse = 0.85 + 0.15 * Math.sin(f * 0.06 + agent.id * 0.9);
      const rad   = 4 + ratio * 3.5;

      // Outer glow
      ctx.save();
      const grd = ctx.createRadialGradient(agent.x, agent.y, 0, agent.x, agent.y, rad * 3);
      grd.addColorStop(0, col + '50');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, rad * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Body
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, rad * pulse, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();

      // White center dot (shows life)
      ctx.beginPath();
      ctx.arc(agent.x, agent.y, rad * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fill();

      // Low-token danger ring
      if (ratio < 0.25) {
        ctx.save();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(f * 0.15);
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, rad + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Coalition membership indicator (tiny arc in coalition color)
      if (agent.coalitionId !== null) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, rad + 2.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Researcher pulse ring
      if (agent.type === 'researcher' && agent.pulse > 0) {
        const p   = agent.pulse;
        const r2  = 85 * (1 - p);
        ctx.save();
        ctx.strokeStyle = this.COLORS.researcher;
        ctx.lineWidth   = 1.5;
        ctx.globalAlpha = p * 0.6;
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, r2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Scout pulse
      if (agent.type === 'scout' && agent.pulse > 0) {
        const p  = agent.pulse;
        const r2 = 45 * (1 - p);
        ctx.save();
        ctx.strokeStyle = this.COLORS.scout;
        ctx.lineWidth   = 1;
        ctx.globalAlpha = p * 0.7;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.arc(agent.x, agent.y, r2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    });

    // Event flash overlay
    const fc = this.world.flashColor;
    if (fc && fc.alpha > 0) {
      ctx.save();
      ctx.globalAlpha = fc.alpha;
      ctx.fillStyle = `rgb(${fc.r},${fc.g},${fc.b})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      fc.alpha -= 0.012;
      if (fc.alpha <= 0) this.world.flashColor = null;
    }

    // Era label (top-left of canvas)
    const era = this.world.getEraName();
    ctx.save();
    ctx.fillStyle  = 'rgba(100,148,200,0.25)';
    ctx.font       = '11px monospace';
    ctx.textAlign  = 'left';
    ctx.fillText(`${era}  ·  t=${this.world.tick}`, 14, 18);
    ctx.restore();

    // Trader frozen notice
    if (this.world.traderFrozen > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(94,234,212,0.15)';
      ctx.font      = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`市场冻结 ${this.world.traderFrozen}`, W - 14, 18);
      ctx.restore();
    }
  }

  _hexagon(ctx, x, y, r, color, alpha) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0.15, alpha));
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const px    = x + r * Math.cos(angle);
      const py    = y + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle   = color + '35';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }
}
