// engine.js — 节点共和国 Simulation Engine

const AGENT_TYPES = {
  builder:    { color: '#3b82f6', speed: 1.0, tokenStart: 80,  upkeep: 0.04 },
  scout:      { color: '#f59e0b', speed: 2.2, tokenStart: 55,  upkeep: 0.06 },
  trader:     { color: '#10b981', speed: 1.5, tokenStart: 100, upkeep: 0.05 },
  researcher: { color: '#8b5cf6', speed: 0.7, tokenStart: 65,  upkeep: 0.03 },
};

const TYPES = Object.keys(AGENT_TYPES);

class Agent {
  constructor(id, type, x, y) {
    this.id       = id;
    this.type     = type;
    this.x        = x;
    this.y        = y;
    this.vx       = (Math.random() - 0.5) * 1.5;
    this.vy       = (Math.random() - 0.5) * 1.5;
    this.tokens   = AGENT_TYPES[type].tokenStart + (Math.random() - 0.5) * 20;
    this.alive    = true;
    this.age      = 0;
    this.coalitionId = null;
    this.target   = null;
    this.cooldown = 0;
    this.buildProgress = 0;
    this.earnings = 0;
    this.trades   = 0;
    this.pulse    = 0; // for visual effects
  }
}

class ResourceNode {
  constructor(id, x, y, capacity) {
    this.id         = id;
    this.x          = x;
    this.y          = y;
    this.capacity   = capacity;
    this.current    = capacity * (0.4 + Math.random() * 0.4);
    this.regenRate  = 0.015 + Math.random() * 0.01;
    this.level      = 0;
    this.discovered = false;
  }

  effectiveCapacity() {
    return this.capacity * (1 + this.level * 0.4);
  }
}

class Coalition {
  constructor(id) {
    this.id         = id;
    this.members    = [];
    this.age        = 0;
    this.bonusAccum = 0;
  }
}

class World {
  constructor(width, height) {
    this.width    = width;
    this.height   = height;
    this.agents   = [];
    this.resources = [];
    this.coalitions = [];
    this.tick     = 0;
    this.nextId   = 0;
    this.globalKnowledge = 0;
    this.traderFrozen = 0;
    this.metrics  = {};
    this.metricHistory = [];
    this._cbs     = {};
    this.recentEvents = [];
    this.flashColor = null;
  }

  init() {
    // Place resource nodes — clustered in a few regions
    const clusterCenters = [
      [this.width * 0.25, this.height * 0.3],
      [this.width * 0.72, this.height * 0.25],
      [this.width * 0.5,  this.height * 0.62],
      [this.width * 0.2,  this.height * 0.75],
      [this.width * 0.78, this.height * 0.72],
    ];

    let nodeId = 0;
    clusterCenters.forEach(([cx, cy]) => {
      const count = 3 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        const angle  = Math.random() * Math.PI * 2;
        const radius = 20 + Math.random() * 60;
        const x = Math.max(30, Math.min(this.width  - 30, cx + Math.cos(angle) * radius));
        const y = Math.max(30, Math.min(this.height - 30, cy + Math.sin(angle) * radius));
        const cap = 80 + Math.random() * 120;
        this.resources.push(new ResourceNode(nodeId++, x, y, cap));
      }
    });

    // Scatter a few more
    for (let i = 0; i < 4; i++) {
      const x = 40 + Math.random() * (this.width - 80);
      const y = 40 + Math.random() * (this.height - 80);
      this.resources.push(new ResourceNode(nodeId++, x, y, 60 + Math.random() * 80));
    }

    // Discover the central cluster initially
    const cx = this.width / 2, cy = this.height / 2;
    this.resources.forEach(r => {
      const d = Math.hypot(r.x - cx, r.y - cy);
      if (d < 150) r.discovered = true;
    });

    // Spawn initial agents in the center region
    const initialCounts = { builder: 6, scout: 6, trader: 6, researcher: 4 };
    TYPES.forEach(type => {
      for (let i = 0; i < initialCounts[type]; i++) this._spawnAgent(type, true);
    });
  }

  _spawnAgent(type, center = false) {
    let x, y;
    if (center) {
      x = this.width  * 0.3 + Math.random() * this.width  * 0.4;
      y = this.height * 0.3 + Math.random() * this.height * 0.4;
    } else {
      x = 30 + Math.random() * (this.width  - 60);
      y = 30 + Math.random() * (this.height - 60);
    }
    const agent = new Agent(this.nextId++, type, x, y);
    this.agents.push(agent);
    return agent;
  }

  step() {
    this.tick++;

    // Regenerate resources
    this.resources.forEach(r => {
      const cap = r.effectiveCapacity();
      r.current = Math.min(cap, r.current + r.regenRate * (1 + r.level * 0.15));
    });

    // Decrease trader freeze
    if (this.traderFrozen > 0) this.traderFrozen--;

    // Update agents
    this.agents.forEach(agent => {
      if (!agent.alive) return;
      this._updateAgent(agent);
    });

    // Remove dead agents
    this.agents = this.agents.filter(a => a.alive);

    // Coalition updates
    this._updateCoalitions();

    // Events
    if (this.tick % 350 === 0) this._fireEvent();

    // Spawn if population low
    if (this.tick % 80 === 0) this._maybeSpawn();

    // Metrics
    this._updateMetrics();

    // Record history
    if (this.tick % 60 === 0) {
      this.metricHistory.push({ tick: this.tick, ...this.metrics });
      if (this.metricHistory.length > 300) this.metricHistory.shift();
    }
  }

  _updateAgent(agent) {
    agent.age++;
    agent.cooldown = Math.max(0, agent.cooldown - 1);
    if (agent.pulse > 0) agent.pulse -= 0.05;

    const cfg = AGENT_TYPES[agent.type];
    agent.tokens -= cfg.upkeep;

    if (agent.tokens <= 0) {
      agent.alive = false;
      this._removeFromCoalition(agent);
      return;
    }

    switch (agent.type) {
      case 'builder':    this._behaviorBuilder(agent, cfg.speed);    break;
      case 'scout':      this._behaviorScout(agent, cfg.speed);      break;
      case 'trader':     this._behaviorTrader(agent, cfg.speed);     break;
      case 'researcher': this._behaviorResearcher(agent, cfg.speed); break;
    }

    // Apply velocity
    agent.x += agent.vx;
    agent.y += agent.vy;

    // Bounce off walls with damping
    if (agent.x < 8)  { agent.x = 8;  agent.vx =  Math.abs(agent.vx) * 0.8; }
    if (agent.x > this.width  - 8) { agent.x = this.width  - 8; agent.vx = -Math.abs(agent.vx) * 0.8; }
    if (agent.y < 8)  { agent.y = 8;  agent.vy =  Math.abs(agent.vy) * 0.8; }
    if (agent.y > this.height - 8) { agent.y = this.height - 8; agent.vy = -Math.abs(agent.vy) * 0.8; }
  }

  _behaviorBuilder(agent, speed) {
    const discovered = this.resources.filter(r => r.discovered);
    if (discovered.length === 0) { this._wander(agent, speed * 0.5); return; }

    // Pick or refresh target: prefer low-level resources with decent current value
    if (!agent.target || agent.buildProgress > 25 || agent.target.level >= 4.5) {
      const scored = discovered.map(r => ({
        r,
        s: (r.current / r.effectiveCapacity()) * 20 - r.level * 4 - this._dist(agent, r) * 0.08
      }));
      scored.sort((a, b) => b.s - a.s);
      agent.target = scored[0].r;
      agent.buildProgress = 0;
    }

    const t = agent.target;
    const d = this._dist(agent, t);

    if (d < 18) {
      // At resource — build
      this._steer(agent, t, speed * 0.1);
      agent.vx *= 0.7;
      agent.vy *= 0.7;

      if (agent.cooldown === 0 && agent.tokens >= 5) {
        t.level = Math.min(5, t.level + 0.12);
        agent.tokens  -= 5;
        const earn     = 3.5 + t.level * 0.55;
        agent.tokens  += earn;
        agent.earnings += earn;
        agent.buildProgress++;
        agent.pulse = 1;
        agent.cooldown = 18;
      }
    } else {
      this._steer(agent, t, speed);
    }
  }

  _behaviorScout(agent, speed) {
    // Reveal resources nearby
    this.resources.forEach(r => {
      if (!r.discovered && this._dist(agent, r) < 45) {
        r.discovered   = true;
        agent.tokens  += 18;
        agent.earnings += 18;
        agent.pulse    = 1;
        this.globalKnowledge++;
        this._emit('event', { type: 'knowledge', message: `探索者 #${agent.id} 发现了新资源节点！` });
      }
    });

    // Tend toward undiscovered areas (edges, dark zones)
    if (agent.cooldown === 0) {
      const undiscovered = this.resources.filter(r => !r.discovered);
      if (undiscovered.length > 0 && Math.random() < 0.3) {
        const pick = undiscovered[Math.floor(Math.random() * undiscovered.length)];
        this._steer(agent, pick, speed);
      } else {
        this._wander(agent, speed);
      }
      agent.cooldown = 20 + Math.floor(Math.random() * 20);
    }

    // Small passive earn for exploration
    agent.tokens  += 0.03;
    agent.earnings += 0.03;
  }

  _behaviorTrader(agent, speed) {
    if (this.traderFrozen > 0) {
      this._wander(agent, speed * 0.2);
      return;
    }

    const rich = this.resources.filter(r => r.discovered && r.current > 15);
    if (rich.length < 1) { this._wander(agent, speed * 0.5); return; }

    if (!agent.target || agent.cooldown === 0) {
      // Pick resource with most current value, weighted by proximity
      const scored = rich.map(r => ({ r, s: r.current * 0.6 - this._dist(agent, r) * 0.12 }));
      scored.sort((a, b) => b.s - a.s);
      agent.target = scored[0].r;
    }

    const t = agent.target;
    const d = this._dist(agent, t);

    if (d < 20) {
      if (agent.cooldown === 0) {
        const extract = Math.min(t.current, 8 + Math.random() * 4);
        if (extract > 0.5) {
          t.current     -= extract;
          const earn     = extract * 0.75;
          agent.tokens  += earn;
          agent.earnings += earn;
          agent.trades++;
          agent.pulse    = 0.8;
        }
        agent.target   = null;
        agent.cooldown = 25;
      }
    } else {
      this._steer(agent, t, speed);
    }
  }

  _behaviorResearcher(agent, speed) {
    // Drift toward the nearest cluster of resources
    const discovered = this.resources.filter(r => r.discovered);
    if (discovered.length > 0) {
      const nearest = discovered.reduce((a, b) => this._dist(agent, a) < this._dist(agent, b) ? a : b);
      const d = this._dist(agent, nearest);

      if (d > 70) {
        this._steer(agent, nearest, speed * 0.6);
      } else {
        // Orbit slowly
        agent.vx += (Math.random() - 0.5) * 0.4;
        agent.vy += (Math.random() - 0.5) * 0.4;
        agent.vx *= 0.92;
        agent.vy *= 0.92;
      }
    }

    // Research pulse: boost nearby resources
    if (agent.cooldown === 0) {
      const nearby = this.resources.filter(r => r.discovered && this._dist(agent, r) < 85);
      nearby.forEach(r => {
        r.current = Math.min(r.effectiveCapacity(), r.current + 0.8);
        this.globalKnowledge += 0.005;
      });
      const earn = 0.8 + nearby.length * 0.3;
      agent.tokens  += earn;
      agent.earnings += earn;
      agent.pulse    = 0.7;
      agent.cooldown = 35;
    }
  }

  _steer(agent, target, speed) {
    const dx = target.x - agent.x;
    const dy = target.y - agent.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) return;
    agent.vx += (dx / len) * speed * 0.15;
    agent.vy += (dy / len) * speed * 0.15;
    const spd = Math.hypot(agent.vx, agent.vy);
    if (spd > speed) {
      agent.vx = (agent.vx / spd) * speed;
      agent.vy = (agent.vy / spd) * speed;
    }
  }

  _wander(agent, speed) {
    if (Math.random() < 0.08) {
      agent.vx += (Math.random() - 0.5) * speed * 1.5;
      agent.vy += (Math.random() - 0.5) * speed * 1.5;
    }
    const spd = Math.hypot(agent.vx, agent.vy);
    if (spd > speed) {
      agent.vx = (agent.vx / spd) * speed;
      agent.vy = (agent.vy / spd) * speed;
    }
    // Minimum wander
    if (spd < speed * 0.3) {
      agent.vx += (Math.random() - 0.5) * speed;
      agent.vy += (Math.random() - 0.5) * speed;
    }
  }

  _updateCoalitions() {
    const live = this.agents.filter(a => a.alive);

    // Try to form new coalitions between nearby agents without one
    const loners = live.filter(a => !a.coalitionId);
    for (let i = 0; i < loners.length; i++) {
      const a = loners[i];
      if (a.coalitionId) continue; // was just assigned
      for (let j = i + 1; j < loners.length; j++) {
        const b = loners[j];
        if (b.coalitionId) continue;
        if (this._dist(a, b) < 48 && Math.random() < 0.004) {
          const c = new Coalition(this.nextId++);
          c.members = [a.id, b.id];
          a.coalitionId = c.id;
          b.coalitionId = c.id;
          this.coalitions.push(c);
          break;
        }
      }
    }

    // Update existing coalitions
    this.coalitions = this.coalitions.filter(coalition => {
      coalition.age++;

      // Remove dead members
      coalition.members = coalition.members.filter(id => {
        const a = this.agents.find(x => x.id === id);
        return a && a.alive;
      });

      if (coalition.members.length < 2) {
        coalition.members.forEach(id => {
          const a = this.agents.find(x => x.id === id);
          if (a) a.coalitionId = null;
        });
        return false;
      }

      // Check cohesion — if members drift too far, break up
      let maxDist = 0;
      for (let i = 0; i < coalition.members.length; i++) {
        const ai = this.agents.find(x => x.id === coalition.members[i]);
        for (let j = i + 1; j < coalition.members.length; j++) {
          const aj = this.agents.find(x => x.id === coalition.members[j]);
          if (ai && aj) maxDist = Math.max(maxDist, this._dist(ai, aj));
        }
      }
      if (maxDist > 120) {
        coalition.members.forEach(id => {
          const a = this.agents.find(x => x.id === id);
          if (a) a.coalitionId = null;
        });
        return false;
      }

      // Coalition bonus
      const bonus = 0.012 * coalition.members.length;
      coalition.members.forEach(id => {
        const a = this.agents.find(x => x.id === id);
        if (a) { a.tokens += bonus; a.earnings += bonus; }
      });

      return true;
    });
  }

  _removeFromCoalition(agent) {
    if (!agent.coalitionId) return;
    const c = this.coalitions.find(x => x.id === agent.coalitionId);
    if (c) c.members = c.members.filter(id => id !== agent.id);
    agent.coalitionId = null;
  }

  _maybeSpawn() {
    const live = this.agents.filter(a => a.alive);
    const maxAgents = 50;

    // Emergency respawn if everyone died
    if (live.length === 0 && this.tick % 120 === 0) {
      this._emit('event', { type: 'entrants', message: '网络崩溃后自愈！新节点重新进入' });
      TYPES.forEach(t => this._spawnAgent(t, true));
      return;
    }

    const totalTokens = live.reduce((s, a) => s + a.tokens, 0);
    if (live.length < maxAgents && totalTokens > 150 && live.length > 3) {
      const counts = {};
      TYPES.forEach(t => counts[t] = 0);
      live.forEach(a => counts[a.type]++);
      const sorted = TYPES.slice().sort((a, b) => counts[a] - counts[b]);
      this._spawnAgent(sorted[0]);
    }
  }

  _fireEvent() {
    const events = [
      {
        name: 'boom',
        fn: () => {
          const r = this.resources[Math.floor(Math.random() * this.resources.length)];
          r.current = r.effectiveCapacity();
          r.capacity *= 1.3;
          r.discovered = true;
          this._emit('event', { type: 'boom', message: `资源大爆发！节点容量扩大 30%` });
        }
      },
      {
        name: 'shock',
        fn: () => {
          this.agents.filter(a => a.alive).forEach(a => a.tokens *= 0.75);
          this._emit('event', { type: 'shock', message: `算力冲击！全网算力缩水 25%` });
        }
      },
      {
        name: 'knowledge',
        fn: () => {
          this.resources.forEach(r => r.discovered = true);
          this.globalKnowledge += 15;
          this._emit('event', { type: 'knowledge', message: `知识爆炸！所有资源节点已被探明` });
        }
      },
      {
        name: 'entrants',
        fn: () => {
          for (let i = 0; i < 4; i++) this._spawnAgent(TYPES[Math.floor(Math.random() * TYPES.length)]);
          this._emit('event', { type: 'entrants', message: `新节点入场！4 个新节点加入网络` });
        }
      },
      {
        name: 'freeze',
        fn: () => {
          this.traderFrozen = 200;
          this._emit('event', { type: 'freeze', message: `市场冻结！交易者节点停摆 200 tick` });
        }
      },
      {
        name: 'tax',
        fn: () => {
          const live = this.agents.filter(a => a.alive);
          live.sort((a, b) => b.tokens - a.tokens);
          const top = live.slice(0, Math.ceil(live.length * 0.2));
          let pool = 0;
          top.forEach(a => {
            const take = a.tokens * 0.15;
            a.tokens -= take;
            pool += take;
          });
          const share = pool / live.length;
          live.forEach(a => a.tokens += share);
          this._emit('event', { type: 'knowledge', message: `算力税！顶层 20% 节点缴税，全体均分` });
        }
      },
    ];

    const e = events[Math.floor(Math.random() * events.length)];
    e.fn();

    const FLASH_COLORS = {
      boom:      [59,  130, 246],
      shock:     [239, 68,  68 ],
      knowledge: [139, 92,  246],
      entrants:  [16,  185, 129],
      freeze:    [99,  102, 241],
      tax:       [245, 158, 11 ],
    };
    const fc = FLASH_COLORS[e.name] || [100, 148, 200];
    this.flashColor = { r: fc[0], g: fc[1], b: fc[2], alpha: 0.28 };
  }

  _updateMetrics() {
    const live = this.agents.filter(a => a.alive);
    if (live.length === 0) {
      this.metrics = { gini: 0, totalTokens: 0, agentCount: 0, coalitionCount: 0, discoveryRate: 0, byType: {} };
      return;
    }

    const totalTokens = live.reduce((s, a) => s + a.tokens, 0);

    // Gini
    const tokens = live.map(a => a.tokens).sort((a, b) => a - b);
    let sumDiff = 0;
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        sumDiff += Math.abs(tokens[i] - tokens[j]);
      }
    }
    const gini = live.length > 1 ? sumDiff / (2 * live.length * totalTokens) : 0;

    const byType = {};
    TYPES.forEach(t => byType[t] = 0);
    live.forEach(a => byType[a.type]++);

    this.metrics = {
      gini: parseFloat(gini.toFixed(3)),
      totalTokens: Math.round(totalTokens),
      avgTokens: Math.round(totalTokens / live.length),
      agentCount: live.length,
      coalitionCount: this.coalitions.length,
      discoveryRate: Math.round(this.resources.filter(r => r.discovered).length / this.resources.length * 100),
      byType,
      globalKnowledge: Math.round(this.globalKnowledge),
    };
  }

  _dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  on(event, cb) {
    if (!this._cbs[event]) this._cbs[event] = [];
    this._cbs[event].push(cb);
  }

  _emit(event, data) {
    if (this._cbs[event]) this._cbs[event].forEach(cb => cb(data));
  }

  getEraName() {
    const t = this.tick;
    const gini = this.metrics.gini || 0;
    if (t < 200)  return '初始涌现';
    if (t < 600)  return '扩张阶段';
    if (t < 1200) return gini > 0.5 ? '贫富分化' : '联盟博弈';
    return gini > 0.6 ? '寡头集中' : '稳态均衡';
  }

  reset() {
    this.agents      = [];
    this.resources   = [];
    this.coalitions  = [];
    this.tick        = 0;
    this.nextId      = 0;
    this.globalKnowledge = 0;
    this.traderFrozen = 0;
    this.metricHistory = [];
    this.metrics     = {};
    this._cbs        = {};
    this.flashColor  = null;
    this.init();
  }
}
