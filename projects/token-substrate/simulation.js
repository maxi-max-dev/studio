// Token Substrate — Simulation Engine

const WORLD = { W: 820, H: 580 };

class Agent {
  constructor(id, type, tokens, x, y) {
    this.id = id;
    this.type = type; // 'corp' | 'individual' | 'open'
    this.tokens = tokens;
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.alive = true;
    this.totalGained = 0;
    this.diedAt = -1;
    this.absorbedBy = null;
    this.lastAcquisition = -999;
    this.labelShort = type === 'corp' ? `C${id.split('-')[1]}` : '';
  }

  get radius() {
    if (!this.alive) return 3;
    if (this.type === 'corp') {
      return Math.max(16, Math.min(52, Math.log2(Math.max(2, this.tokens)) * 2.6));
    }
    return Math.max(4, Math.min(14, Math.log2(Math.max(2, this.tokens)) * 0.9));
  }
}

class Simulation {
  constructor() {
    this.agents = [];
    this.tick = 0;
    this.running = false;
    this.commons = 0;
    this.flows = [];
    this.history = [];
    this.config = {
      initialInequality: 50,
      corpAdvantage:     50,
      openSourceRate:    30,
      regulationStrength: 30,
    };
    this.init();
  }

  init() {
    this.agents = [];
    this.tick = 0;
    this.commons = 0;
    this.flows = [];
    this.history = [];

    const TOTAL = 14000;
    const { initialInequality, openSourceRate } = this.config;

    const numCorps = 4;
    // Open-source agents scale with openSourceRate (3–12)
    const numOpen = Math.max(3, Math.round(openSourceRate / 9));
    const numInd = 38;

    // Corps start with corpFrac of all tokens
    const corpFrac = 0.22 + (initialInequality / 100) * 0.38; // 22–60%
    const tokensPerCorp = (TOTAL * corpFrac) / numCorps;

    // Corps: inner ring — slight random variance so one can pull ahead
    for (let i = 0; i < numCorps; i++) {
      const angle = (i / numCorps) * Math.PI * 2 - Math.PI / 2;
      const r = 100 + (i % 2) * 15;
      const variance = 0.7 + Math.random() * 0.6;
      this.agents.push(new Agent(
        `corp-${i}`, 'corp', tokensPerCorp * variance,
        WORLD.W / 2 + Math.cos(angle) * r,
        WORLD.H / 2 + Math.sin(angle) * r
      ));
    }

    const remPerAgent = (TOTAL * (1 - corpFrac)) / (numOpen + numInd);
    const totalNonCorp = numOpen + numInd;

    for (let i = 0; i < totalNonCorp; i++) {
      const type = i < numOpen ? 'open' : 'individual';
      const angle = (i / totalNonCorp) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const r = 160 + Math.random() * 190;
      // Natural variation in starting wealth
      const mult = 0.3 + Math.random() * 1.4;
      this.agents.push(new Agent(
        `${type}-${i}`, type, Math.max(18, remPerAgent * mult),
        WORLD.W / 2 + Math.cos(angle) * r,
        WORLD.H / 2 + Math.sin(angle) * r
      ));
    }
  }

  step() {
    const { corpAdvantage, openSourceRate, regulationStrength } = this.config;
    const alive = this.agents.filter(a => a.alive);
    if (alive.length < 2) return;

    // Per-tick ROI (corps: 0.5–3.5%; individuals slightly more viable vs. early game)
    const corpROI = 0.005 + (corpAdvantage / 100) * 0.03;
    const indROI  = 0.006;
    const openROI = 0.005;

    const totalAlive = alive.reduce((s, a) => s + a.tokens, 0) + 0.001;
    const avgTokens  = totalAlive / alive.length;

    // Accumulation phase
    let commonsDelta = 0;
    for (const a of alive) {
      if (a.type === 'corp') {
        const g = a.tokens * corpROI;
        a.tokens += g;
        a.totalGained += g;
      } else if (a.type === 'open') {
        const g = a.tokens * openROI;
        const share = openSourceRate / 100;
        const toCommons = g * share;
        const toSelf    = g - toCommons;
        a.tokens += toSelf;
        a.totalGained += g;
        commonsDelta += toCommons;
      } else {
        const g = a.tokens * indROI;
        a.tokens += g;
        a.totalGained += g;
      }
    }

    this.commons += commonsDelta;

    // Commons redistribution: flows back to non-corp agents every tick (slowly)
    if (this.commons > 30) {
      const nonCorps = alive.filter(a => a.type !== 'corp');
      if (nonCorps.length > 0) {
        const rate = 0.12;
        const perAgent = (this.commons * rate) / nonCorps.length;
        for (const a of nonCorps) {
          a.tokens += perAgent;
        }
        this.commons *= (1 - rate);
      }
    }

    // Corp acquisitions: weaker agents get absorbed
    const regFactor = 1 - regulationStrength / 100;
    const acquisitionProb = 0.08 * regFactor;
    if (Math.random() < acquisitionProb) {
      const corps = alive.filter(a => a.type === 'corp');
      const threshold = avgTokens * (0.15 + regFactor * 0.22);
      const targets = alive.filter(a => a.type !== 'corp' && a.tokens < threshold);
      if (corps.length > 0 && targets.length > 0) {
        const corp = corps[Math.floor(Math.random() * corps.length)];
        const target = targets[Math.floor(Math.random() * targets.length)];
        corp.tokens += target.tokens * 0.85;
        target.alive = false;
        target.diedAt = this.tick;
        target.absorbedBy = corp.id;
        corp.lastAcquisition = this.tick;
        this.flows.push({
          x1: target.x, y1: target.y,
          x2: corp.x,   y2: corp.y,
          t: 0, color: '#e05a5a', magnitude: target.tokens
        });
      }
    }

    // Corp-on-corp dominance: when one corp far outstrips another, it absorbs the weakest
    if (corpAdvantage > 60 && Math.random() < 0.009 * (corpAdvantage / 100)) {
      const liveCorps = alive.filter(a => a.type === 'corp').sort((a, b) => a.tokens - b.tokens);
      if (liveCorps.length >= 2) {
        const dominant = liveCorps[liveCorps.length - 1];
        const weakest  = liveCorps[0];
        if (dominant.tokens > weakest.tokens * 4) {
          dominant.tokens += weakest.tokens * 0.9;
          weakest.alive = false;
          weakest.diedAt = this.tick;
          weakest.absorbedBy = dominant.id;
          dominant.lastAcquisition = this.tick;
          this.flows.push({
            x1: weakest.x, y1: weakest.y,
            x2: dominant.x, y2: dominant.y,
            t: 0, color: '#ff3030', magnitude: weakest.tokens
          });
        }
      }
    }

    // Occasional open-source contribution flow visuals
    if (this.tick % 20 === 0) {
      const opens = alive.filter(a => a.type === 'open');
      for (const o of opens) {
        if (Math.random() < 0.35) {
          this.flows.push({
            x1: o.x, y1: o.y,
            x2: WORLD.W / 2, y2: WORLD.H / 2,
            t: 0, color: '#5ae0a0', magnitude: 1
          });
        }
      }
    }

    // Advance / expire flows — larger transfers travel faster
    this.flows.forEach(f => {
      f.t += 0.028 + Math.min(0.05, Math.log10(Math.max(1, f.magnitude)) * 0.006);
    });
    this.flows = this.flows.filter(f => f.t < 1);

    // Record snapshot every 4 ticks
    if (this.tick % 4 === 0) {
      this.history.push(this._snapshot(alive));
      if (this.history.length > 400) this.history.shift();
    }

    this.tick++;
  }

  _snapshot(alive) {
    if (!alive) alive = this.agents.filter(a => a.alive);
    const vals = alive.map(a => a.tokens).sort((a, b) => a - b);
    const total = vals.reduce((s, v) => s + v, 0) + 0.001;

    let giniNum = 0;
    const n = vals.length;
    for (let i = 0; i < n; i++) {
      giniNum += (2 * (i + 1) - n - 1) * vals[i];
    }
    const gini = Math.min(0.99, Math.abs(giniNum) / (n * total));

    const corpTotal = alive.filter(a => a.type === 'corp').reduce((s, a) => s + a.tokens, 0);
    const initNonCorp = this.agents.filter(a => a.type !== 'corp').length;
    const liveNonCorp = alive.filter(a => a.type !== 'corp').length;

    return {
      tick: this.tick,
      gini,
      corpShare: corpTotal / total,
      survival: liveNonCorp / Math.max(1, initNonCorp),
      commons: this.commons,
      innovators: liveNonCorp,
    };
  }

  getStats() {
    const snap = this._snapshot();
    return snap;
  }

  updatePhysics() {
    const alive = this.agents.filter(a => a.alive);
    const DAMP    = 0.82;
    const MAX_SPD = 2.2;
    const PAD     = 28;

    for (const a of alive) {
      let fx = 0, fy = 0;

      // Repulsion from other alive agents
      for (const b of alive) {
        if (a === b) continue;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist2 = dx * dx + dy * dy + 0.01;
        const dist  = Math.sqrt(dist2);
        const minD  = a.radius + b.radius + 8;
        if (dist < minD * 2.5) {
          const f = Math.min(500, 1200 / dist2);
          fx += (dx / dist) * f;
          fy += (dy / dist) * f;
        }
      }

      // Gentle pull toward center for individuals (makes capture dynamic visible)
      if (a.type !== 'corp') {
        fx -= (a.x - WORLD.W / 2) * 0.0004;
        fy -= (a.y - WORLD.H / 2) * 0.0004;
      }

      // Corps: very gentle outward repulsion from center (keep them spread)
      if (a.type === 'corp') {
        const dx = a.x - WORLD.W / 2;
        const dy = a.y - WORLD.H / 2;
        const d  = Math.sqrt(dx * dx + dy * dy) + 0.1;
        fx += (dx / d) * 0.5;
        fy += (dy / d) * 0.5;
      }

      // Boundary repulsion
      const bStr = 30;
      if (a.x < PAD)           fx += bStr;
      if (a.x > WORLD.W - PAD) fx -= bStr;
      if (a.y < PAD)           fy += bStr;
      if (a.y > WORLD.H - PAD) fy -= bStr;

      a.vx = (a.vx + fx * 0.08) * DAMP;
      a.vy = (a.vy + fy * 0.08) * DAMP;

      // Cap speed
      const spd = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
      if (spd > MAX_SPD) { a.vx *= MAX_SPD / spd; a.vy *= MAX_SPD / spd; }

      a.x = Math.max(PAD, Math.min(WORLD.W - PAD, a.x + a.vx));
      a.y = Math.max(PAD, Math.min(WORLD.H - PAD, a.y + a.vy));
    }

    // Drift dead agents slightly (ghost effect)
    for (const a of this.agents) {
      if (!a.alive && a.diedAt >= 0 && this.tick - a.diedAt < 80) {
        if (a.absorbedBy) {
          const corp = this.agents.find(c => c.id === a.absorbedBy);
          if (corp) {
            a.x += (corp.x - a.x) * 0.04;
            a.y += (corp.y - a.y) * 0.04;
          }
        }
      }
    }
  }
}
