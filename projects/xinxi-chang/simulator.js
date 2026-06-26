/**
 * 信息场 · 物理引擎
 * 话题引力井 + 内容粒子 + 受众星云
 */

const TOPICS = [
  { id: 'tech',     name: '科技', color: '#6af7c8', glow: 'rgba(106,247,200,0.18)' },
  { id: 'career',   name: '职场', color: '#f7c86a', glow: 'rgba(247,200,106,0.18)' },
  { id: 'creative', name: '创意', color: '#c86af7', glow: 'rgba(200,106,247,0.18)' },
  { id: 'life',     name: '生活', color: '#6ab4f7', glow: 'rgba(106,180,247,0.18)' },
  { id: 'emotion',  name: '情感', color: '#f76a8a', glow: 'rgba(247,106,138,0.18)' },
  { id: 'game',     name: '游戏', color: '#8af76a', glow: 'rgba(138,247,106,0.18)' },
];

const PLATFORMS = {
  xiaohongshu: { label: '小红书', audienceBias: ['life', 'creative', 'emotion'], reachMult: 1.3 },
  jike:        { label: '即刻',   audienceBias: ['tech', 'career', 'creative'],  reachMult: 1.0 },
  bilibili:    { label: '哔哩',   audienceBias: ['game', 'creative', 'tech'],     reachMult: 1.2 },
  zhihu:       { label: '知乎',   audienceBias: ['tech', 'career', 'life'],       reachMult: 0.9 },
};

// Pre-seeded demo strategies to show on first load
const DEMO_SNAPSHOTS = [
  { id: 'demo_1', label: '均衡流量策略', captured: 847, emitted: 1203, rate: 70,
    weights: { tech:5, career:5, creative:5, life:5, emotion:5, game:5 },
    frequency: 'medium', platforms: ['jike'], color: '#7c6af7' },
  { id: 'demo_2', label: '科技精英路线', captured: 612, emitted: 764, rate: 80,
    weights: { tech:9, career:7, creative:4, life:2, emotion:2, game:1 },
    frequency: 'high', platforms: ['zhihu', 'jike'], color: '#f76a8a' },
  { id: 'demo_3', label: '生活情感共鸣', captured: 1102, emitted: 1580, rate: 70,
    weights: { tech:2, career:2, creative:6, life:8, emotion:9, game:3 },
    frequency: 'high', platforms: ['xiaohongshu'], color: '#6af7c8' },
];

class Simulator {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.ctx    = canvasEl.getContext('2d');
    this.W = 0; this.H = 0;
    this.running = false;
    this.speed   = 1;
    this._raf    = null;
    this._lastT  = null;
    this._emitAcc = 0;

    // State
    this.wells     = [];  // topic gravity wells
    this.particles = [];  // content particles
    this.audience  = [];  // audience nodes
    this.captured  = [];  // capture events (for flash anim)
    this.snapshots = [];  // saved strategy runs

    // Live stats
    this.stats = { captured: 0, emitted: 0, tick: 0 };

    // Strategy (set from UI)
    this.strategy = {
      weights:   { tech: 5, career: 5, creative: 5, life: 5, emotion: 5, game: 5 },
      frequency: 'medium',  // low / medium / high
      platforms: ['jike'],
    };

    this._loadFromStorage();

    this._onResize = this._resize.bind(this);
    window.addEventListener('resize', this._onResize);
    this._resize();
  }

  /* ── Storage ── */

  _loadFromStorage() {
    try {
      const savedSnaps = localStorage.getItem('xc_snapshots');
      this.snapshots = savedSnaps
        ? JSON.parse(savedSnaps)
        : JSON.parse(JSON.stringify(DEMO_SNAPSHOTS));
      if (!savedSnaps) this._saveSnapshotsToStorage();

      const savedStrat = localStorage.getItem('xc_strategy');
      if (savedStrat) {
        const parsed = JSON.parse(savedStrat);
        this.strategy = { ...this.strategy, ...parsed };
      }
    } catch (e) {
      this.snapshots = JSON.parse(JSON.stringify(DEMO_SNAPSHOTS));
    }
  }

  _saveSnapshotsToStorage() {
    try { localStorage.setItem('xc_snapshots', JSON.stringify(this.snapshots)); } catch (e) {}
  }

  saveStrategyToStorage() {
    try { localStorage.setItem('xc_strategy', JSON.stringify(this.strategy)); } catch (e) {}
  }

  /* ── Setup ── */

  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = window.devicePixelRatio || 1;
    this.W = Math.round(rect.width);
    this.H = Math.round(rect.height);
    this.canvas.width  = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this._placeWells();
    if (this.audience.length === 0) this._spawnAudience();
    else this._clampAudience();
  }

  _placeWells() {
    const W = this.W, H = this.H;
    const cx = W / 2, cy = H / 2;
    const rx = Math.min(W, H) * 0.32;
    const ry = Math.min(W, H) * 0.26;
    this.wells = TOPICS.map((t, i) => {
      const angle = (i / TOPICS.length) * Math.PI * 2 - Math.PI / 2;
      return {
        ...t,
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        strength: 0,   // updated from strategy
        radius: 52,
      };
    });
    this._syncWellStrengths();
  }

  _syncWellStrengths() {
    const w = this.strategy.weights;
    const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    this.wells.forEach(wl => {
      wl.strength = ((w[wl.id] || 0) / total) * 6;
    });
  }

  _spawnAudience() {
    this.audience = [];
    const N = 44;
    for (let i = 0; i < N; i++) {
      const margin = 60;
      this.audience.push({
        x:  margin + Math.random() * (this.W - margin * 2),
        y:  margin + Math.random() * (this.H - margin * 2),
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        affinity: TOPICS[Math.floor(Math.random() * TOPICS.length)].id,
        lit: 0,       // 0-1 glow intensity
        r: 3 + Math.random() * 2,
        captureFlash: 0,
      });
    }
  }

  _clampAudience() {
    this.audience.forEach(a => {
      a.x = Math.max(10, Math.min(this.W - 10, a.x));
      a.y = Math.max(10, Math.min(this.H - 10, a.y));
    });
  }

  /* ── Simulation loop ── */

  start() {
    if (this.running) return;
    this.running = true;
    this._lastT = null;
    const loop = (t) => {
      if (!this.running) return;
      if (this._lastT !== null) {
        const raw = Math.min((t - this._lastT) / 1000, 0.05);
        const dt  = raw * this.speed;
        for (let s = 0; s < this.speed && s < 4; s++) this._step(dt / Math.min(this.speed, 4));
      }
      this._lastT = t;
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  reset() {
    this.stop();
    this.particles = [];
    this.captured  = [];
    this.stats = { captured: 0, emitted: 0, tick: 0 };
    this._emitAcc = 0;
    this._spawnAudience();
    this.audience.forEach(a => { a.lit = 0; a.captureFlash = 0; });
  }

  _emitRate() {
    const freq = this.strategy.frequency;
    // particles per second
    if (freq === 'low')    return 0.4;
    if (freq === 'medium') return 1.1;
    if (freq === 'high')   return 2.4;
    return 1.1;
  }

  _step(dt) {
    this.stats.tick++;
    const W = this.W, H = this.H;

    // Emit particles
    this._emitAcc += dt * this._emitRate();
    while (this._emitAcc >= 1) {
      this._emitAcc -= 1;
      this._emitParticle();
    }

    // Physics constants (px/s units)
    // G * strength / max(d, 30) → acceleration in px/s²
    const G_BASE   = 14000;
    const DRAG     = Math.exp(-0.9 * dt);  // velocity decays to 0.9^(1/s)
    const toRemove = new Set();

    this.particles.forEach((p, pi) => {
      p.life -= dt;
      if (p.life <= 0) { toRemove.add(pi); return; }

      // Gravity pull from wells (1/d falloff, capped at d=30)
      let ax = 0, ay = 0;
      this.wells.forEach(wl => {
        const dx = wl.x - p.x, dy = wl.y - p.y;
        const d  = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = G_BASE * wl.strength / Math.max(d, 30);
        ax += force * dx / d;
        ay += force * dy / d;
      });

      // Velocity update (px/s) + exponential drag
      p.vx = (p.vx + ax * dt) * DRAG;
      p.vy = (p.vy + ay * dt) * DRAG;
      // Position update (px/s → px)
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Store trail
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 28) p.trail.shift();

      // OOB check
      if (p.x < -60 || p.x > W + 60 || p.y < -60 || p.y > H + 60) {
        toRemove.add(pi);
        return;
      }

      // Check capture by well (close enough)
      for (const wl of this.wells) {
        const dx = wl.x - p.x, dy = wl.y - p.y;
        if (dx * dx + dy * dy < wl.radius * wl.radius) {
          if (p.topicId === wl.id) {
            // same topic → captured!
            this.stats.captured++;
            this.captured.push({ x: wl.x, y: wl.y, color: wl.color, life: 0.7 });
            this._lightAudienceNear(wl);
          }
          toRemove.add(pi);
          break;
        }
      }
    });

    // Remove dead/captured
    if (toRemove.size) {
      this.particles = this.particles.filter((_, i) => !toRemove.has(i));
    }

    // Update audience drift (slow brownian, px/s)
    const aDRAG = Math.exp(-1.5 * dt);
    this.audience.forEach(a => {
      a.vx = (a.vx + (Math.random() - 0.5) * 4) * aDRAG;
      a.vy = (a.vy + (Math.random() - 0.5) * 4) * aDRAG;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      // Bounce
      if (a.x < 8)       { a.x = 8;       a.vx *= -1; }
      if (a.x > W - 8)   { a.x = W - 8;   a.vx *= -1; }
      if (a.y < 8)       { a.y = 8;        a.vy *= -1; }
      if (a.y > H - 8)   { a.y = H - 8;   a.vy *= -1; }
      // Fade lit
      a.lit = Math.max(0, a.lit - dt * 0.4);
      a.captureFlash = Math.max(0, a.captureFlash - dt * 1.6);
    });

    // Update capture flashes
    this.captured.forEach(c => { c.life -= dt * 1.2; });
    this.captured = this.captured.filter(c => c.life > 0);
  }

  _emitParticle() {
    // Choose topic weighted by strategy
    const w = this.strategy.weights;
    const keys = Object.keys(w);
    const total = keys.reduce((s, k) => s + (w[k] || 0), 0) || 1;
    const r = Math.random() * total;
    let acc = 0, chosenTopic = keys[0];
    for (const k of keys) {
      acc += w[k] || 0;
      if (r <= acc) { chosenTopic = k; break; }
    }

    // Platform reach multiplier → affects initial speed spread
    const activePlatforms = this.strategy.platforms;
    let reachMult = 1;
    if (activePlatforms.length) {
      reachMult = activePlatforms.reduce((s, pid) => s + (PLATFORMS[pid]?.reachMult || 1), 0) / activePlatforms.length;
    }

    // Spawn from a random edge or center-ish
    const spawnEdge = Math.random() < 0.35;
    let sx, sy;
    if (spawnEdge) {
      const side = Math.floor(Math.random() * 4);
      if (side === 0) { sx = Math.random() * this.W; sy = -10; }
      else if (side === 1) { sx = this.W + 10; sy = Math.random() * this.H; }
      else if (side === 2) { sx = Math.random() * this.W; sy = this.H + 10; }
      else { sx = -10; sy = Math.random() * this.H; }
    } else {
      const margin = Math.min(this.W, this.H) * 0.06;
      sx = margin + Math.random() * (this.W - margin * 2);
      sy = margin + Math.random() * (this.H - margin * 2);
    }

    const angle = Math.random() * Math.PI * 2;
    // Platform-topic bias: faster particles when topic aligns with platform audience
    const platBias = activePlatforms.some(pid =>
      (PLATFORMS[pid]?.audienceBias || []).includes(chosenTopic)
    ) ? 1.38 : 0.78;
    const speed = (55 + Math.random() * 110) * reachMult * platBias;
    const topic = TOPICS.find(t => t.id === chosenTopic) || TOPICS[0];

    this.particles.push({
      x: sx, y: sy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      topicId: chosenTopic,
      color: topic.color,
      r: 2.5 + Math.random() * 1.5,
      life: 9 + Math.random() * 7,
      trail: [],
    });

    this.stats.emitted++;
  }

  _lightAudienceNear(well) {
    const R2 = 140 * 140;
    this.audience.forEach(a => {
      if (a.affinity !== well.id) return;
      const dx = a.x - well.x, dy = a.y - well.y;
      if (dx * dx + dy * dy < R2 * 4) {
        a.lit = Math.min(1, a.lit + 0.5 + Math.random() * 0.4);
        a.captureFlash = 1;
      }
    });
  }

  /* ── Snapshots ── */

  saveSnapshot(label) {
    const topicScores = {};
    this.wells.forEach(wl => {
      topicScores[wl.id] = this.strategy.weights[wl.id] || 0;
    });
    const snap = {
      id: Date.now(),
      label: label || `策略 ${this.snapshots.length + 1}`,
      captured: this.stats.captured,
      emitted:  this.stats.emitted,
      rate: this.stats.emitted ? Math.round(this.stats.captured / this.stats.emitted * 100) : 0,
      weights: { ...this.strategy.weights },
      platforms: [...this.strategy.platforms],
      frequency: this.strategy.frequency,
      color: ['#7c6af7','#f76a8a','#6af7c8','#f7c86a'][this.snapshots.length % 4],
    };
    this.snapshots.push(snap);
    this._saveSnapshotsToStorage();
    return snap;
  }

  deleteSnapshot(id) {
    this.snapshots = this.snapshots.filter(s => s.id !== id);
    this._saveSnapshotsToStorage();
  }

  platformFit() {
    const w = this.strategy.weights;
    const plats = this.strategy.platforms;
    const total = Object.values(w).reduce((s, v) => s + v, 0) || 1;
    if (!plats.length) return 0;
    const score = plats.reduce((pSum, pid) => {
      const bias = PLATFORMS[pid]?.audienceBias || [];
      return pSum + bias.reduce((s, id) => s + (w[id] || 0), 0) / total;
    }, 0) / plats.length;
    return Math.round(score * 100);
  }

  updateStrategy(strategy) {
    this.strategy = { ...this.strategy, ...strategy };
    this._syncWellStrengths();
  }

  getTopTopics(n = 3) {
    const w = this.strategy.weights;
    return Object.entries(w)
      .sort(([,a],[,b]) => b - a)
      .slice(0, n)
      .map(([id]) => TOPICS.find(t => t.id === id));
  }
}

window.Simulator = Simulator;
window.TOPICS    = TOPICS;
window.PLATFORMS = PLATFORMS;
