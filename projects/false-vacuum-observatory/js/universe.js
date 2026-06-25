'use strict';

class VacuumBubble {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 3;
    this.age = 0;
  }
}

class Universe {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.generation = 0;
    this.pendingReset = false;
    this.reset();
  }

  reset() {
    this.particles = [];
    this.bubbles = [];
    this.age = 0;
    this.generation++;
    this.pendingReset = false;
    this.dying = false;
    this._nucleationCooldown = 600;
    this._spawn();
  }

  _spawn() {
    const W = this.width, H = this.height;

    const add = (x, y, type, vx, vy) => {
      this.particles.push({
        x, y,
        vx: (vx || 0) + (Math.random() - 0.5) * 0.7,
        vy: (vy || 0) + (Math.random() - 0.5) * 0.7,
        mass: type === 'dark' ? 2.5 : (0.7 + Math.random() * 0.9),
        type,        // 'matter' | 'dark' | 'antimatter'
        phase: 'false',
        energy: 0,
        age: 0,
      });
    };

    // Scattered background particles
    for (let i = 0; i < 140; i++) {
      const t = Math.random() < 0.035 ? 'antimatter' : 'matter';
      add(Math.random() * W, Math.random() * H, t);
    }

    // Dark matter halos (invisible attractors)
    for (let c = 0; c < 3; c++) {
      const cx = W * (0.2 + 0.6 * Math.random());
      const cy = H * (0.2 + 0.6 * Math.random());
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 40 + Math.random() * 90;
        add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 'dark',
            -Math.sin(a) * 0.25, Math.cos(a) * 0.25);
      }
    }

    // Matter clusters orbiting halo regions
    for (let c = 0; c < 5; c++) {
      const cx = W * (0.12 + 0.76 * Math.random());
      const cy = H * (0.12 + 0.76 * Math.random());
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 8 + Math.random() * 55;
        add(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 'matter',
            -Math.sin(a) * 0.38, Math.cos(a) * 0.38);
      }
    }
  }

  step() {
    if (this.pendingReset) return [];

    this.age++;
    const events = [];
    const W = this.width, H = this.height;
    const G = 0.42;
    const SOFTEN2 = 144;   // 12²
    const CUTOFF2 = 25600; // 160²
    const ps = this.particles;
    const n = ps.length;

    // Accumulate accelerations (N² with distance cutoff)
    const ax = new Float32Array(n);
    const ay = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const pi = ps[i];
      const pix = pi.x, piy = pi.y;
      const pim = pi.mass;
      const piph = pi.phase;

      for (let j = i + 1; j < n; j++) {
        const pj = ps[j];
        let dx = pj.x - pix;
        let dy = pj.y - piy;

        // Shortest-path across periodic boundary
        if (dx >  W * 0.5) dx -= W;
        else if (dx < -W * 0.5) dx += W;
        if (dy >  H * 0.5) dy -= H;
        else if (dy < -H * 0.5) dy += H;

        const dist2 = dx * dx + dy * dy;
        if (dist2 > CUTOFF2) continue;

        const inv3 = 1.0 / Math.pow(dist2 + SOFTEN2, 1.5);
        const f = G * inv3;

        // Particles in different phases no longer attract (vacuum wall)
        const s = (piph === pj.phase) ? 1 : 0;

        const fjx = s * f * dx;
        const fjy = s * f * dy;

        ax[i] += fjx * pj.mass;
        ay[i] += fjy * pj.mass;
        ax[j] -= fjx * pim;
        ay[j] -= fjy * pim;
      }
    }

    // Integrate velocities + positions
    for (let i = 0; i < n; i++) {
      const p = ps[i];
      p.vx = (p.vx + ax[i]) * 0.9982;
      p.vy = (p.vy + ay[i]) * 0.9982;
      p.x = ((p.x + p.vx) % W + W) % W;
      p.y = ((p.y + p.vy) % H + H) % H;
      p.energy = Math.min(1.0, (p.vx * p.vx + p.vy * p.vy) * 0.45);
      p.age++;
    }

    // Expand bubbles
    const EXPAND_RATE = 2.2;
    for (const b of this.bubbles) {
      b.radius += EXPAND_RATE;
      b.age++;
    }

    // Convert particles inside bubbles (with periodic wrapping check)
    const blen = this.bubbles.length;
    if (blen > 0) {
      for (let i = 0; i < n; i++) {
        const p = ps[i];
        if (p.phase === 'true') continue;
        const px = p.x, py = p.y;

        outer: for (let bi = 0; bi < blen; bi++) {
          const b = this.bubbles[bi];
          const r2 = b.radius * b.radius;

          for (let ox = -1; ox <= 1; ox++) {
            for (let oy = -1; oy <= 1; oy++) {
              const dx = px - (b.x + ox * W);
              const dy = py - (b.y + oy * H);
              if (dx * dx + dy * dy <= r2) {
                p.phase = 'true';
                p.vx *= 0.35;
                p.vy *= 0.35;
                break outer;
              }
            }
          }
        }
      }
    }

    // Cull bubbles that have grown past useful size
    const maxR = Math.sqrt(W * W + H * H);
    this.bubbles = this.bubbles.filter(b => b.radius < maxR * 2.5);

    // Random nucleation (starts after cooldown, probability rises with age)
    if (this.age > this._nucleationCooldown) {
      const elapsed = this.age - this._nucleationCooldown;
      const prob = 0.00040 * (1 + elapsed * 0.000035);
      if (Math.random() < prob) {
        const bx = Math.random() * W;
        const by = Math.random() * H;
        this.bubbles.push(new VacuumBubble(bx, by));
        events.push({ type: 'nucleation', x: bx, y: by });
      }
    }

    // Dying check
    const fvf = this._falseVacFrac();
    if (fvf < 0.05 && !this.dying) {
      this.dying = true;
      events.push({ type: 'dying' });
    }

    // Rebirth trigger (deferred to main.js via event)
    if (!this.pendingReset && (fvf === 0 || (this.dying && this.bubbles.length === 0))) {
      this.pendingReset = true;
      events.push({ type: 'rebirth' });
    }

    return events;
  }

  nucleateBubble(x, y) {
    this.bubbles.push(new VacuumBubble(x, y));
  }

  _falseVacFrac() {
    const n = this.particles.length;
    if (!n) return 0;
    let count = 0;
    for (const p of this.particles) {
      if (p.phase === 'false') count++;
    }
    return count / n;
  }

  getStats() {
    return {
      age: this.age,
      generation: this.generation,
      falseVacFrac: this._falseVacFrac(),
      bubbleCount: this.bubbles.length,
      dying: this.dying,
    };
  }
}
