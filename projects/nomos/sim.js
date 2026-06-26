// Nomos simulation engine

const W = 60, H = 40;
const INIT_AGENTS = 130;
const MAX_AGENTS = 280;
const MAX_AGE = 90;
const REPRO_WEALTH = 65;
const STARVE_TICKS = 18;
const BASE_HARVEST = 2.8;
const LAND_CLAIM_COST = 18;
const PASSIVE_RATE = 0.35;
const TRADE_DELTA = 6;
const HISTORY_MAX = 400;

const constitution = {
  taxRate: 0.30,
  redistribution: 'universal',
  landCap: 20,
  inheritanceTax: 0.50,
  marketFreedom: 0.80,
};

const PRESETS = {
  liberal: {
    taxRate: 0.08, redistribution: 'none',
    landCap: 0, inheritanceTax: 0.05, marketFreedom: 0.95,
  },
  social: {
    taxRate: 0.42, redistribution: 'means_tested',
    landCap: 25, inheritanceTax: 0.60, marketFreedom: 0.70,
  },
  feudal: {
    taxRate: 0.05, redistribution: 'none',
    landCap: 0, inheritanceTax: 0.02, marketFreedom: 0.30,
  },
  planned: {
    taxRate: 0.75, redistribution: 'universal',
    landCap: 8, inheritanceTax: 0.90, marketFreedom: 0.20,
  },
};

const state = {
  cells: [],
  agents: [],
  agentById: {},
  treasury: 0,
  year: 0,
  nextId: 0,
  history: { pop: [], gini: [], wealth: [] },
};

function cellIdx(x, y) { return y * W + x; }

function seedFertility(x, y) {
  const v = 0.35
    + 0.30 * Math.abs(Math.sin(x * 0.13 + y * 0.09))
    + 0.20 * Math.abs(Math.sin(x * 0.07 - y * 0.19))
    + 0.15 * Math.abs(Math.cos(x * 0.17 + y * 0.05));
  return Math.min(0.98, Math.max(0.05, v));
}

function initWorld() {
  state.cells.length = 0;
  state.agents.length = 0;
  state.agentById = {};
  state.treasury = 0;
  state.year = 0;
  state.nextId = 0;
  state.history.pop.length = 0;
  state.history.gini.length = 0;
  state.history.wealth.length = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      state.cells.push({ fertility: seedFertility(x, y), ownerId: null });
    }
  }

  for (let i = 0; i < INIT_AGENTS; i++) {
    spawnAgent(
      10 + Math.random() * 20,
      Math.floor(Math.random() * W),
      Math.floor(Math.random() * H),
      Math.floor(Math.random() * 30)
    );
  }
}

function spawnAgent(wealth, x, y, age) {
  if (state.agents.filter(a => a.alive).length >= MAX_AGENTS) return;
  const id = state.nextId++;
  const agent = {
    id,
    x: x ?? Math.floor(Math.random() * W),
    y: y ?? Math.floor(Math.random() * H),
    wealth: wealth ?? 15,
    age: age ?? 0,
    ownedCells: new Set(),
    alive: true,
    starveTicks: 0,
  };
  state.agents.push(agent);
  state.agentById[id] = agent;
}

function killAgent(a) {
  a.alive = false;
  for (const ci of a.ownedCells) {
    if (state.cells[ci]) state.cells[ci].ownerId = null;
  }
  a.ownedCells.clear();
}

function moveAgent(a) {
  const dirs = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = (a.x + dx + W) % W;
      const ny = (a.y + dy + H) % H;
      const cell = state.cells[cellIdx(nx, ny)];
      const isOwn = cell.ownerId === a.id;
      const isFree = cell.ownerId === null;
      const score = cell.fertility * (isOwn ? 1.4 : isFree ? 1.0 : 0.5);
      dirs.push({ nx, ny, score });
    }
  }
  dirs.sort((a, b) => b.score - a.score);
  if (Math.random() < 0.65) {
    a.x = dirs[0].nx;
    a.y = dirs[0].ny;
  } else {
    const pick = dirs[Math.floor(Math.random() * dirs.length)];
    a.x = pick.nx;
    a.y = pick.ny;
  }
}

function tick() {
  const alive = state.agents.filter(a => a.alive);
  if (alive.length === 0) return;

  let taxCollected = 0;

  // Harvest + tax
  for (const a of alive) {
    const homeCell = state.cells[cellIdx(a.x, a.y)];
    let gross = homeCell.fertility * BASE_HARVEST;

    for (const ci of a.ownedCells) {
      if (ci !== cellIdx(a.x, a.y)) {
        gross += state.cells[ci].fertility * BASE_HARVEST * PASSIVE_RATE;
      }
    }

    const tax = gross * constitution.taxRate;
    taxCollected += tax;
    a.wealth += gross - tax;
  }

  state.treasury += taxCollected;

  // Redistribution
  redistribute(alive);

  // Move
  for (const a of alive) {
    moveAgent(a);
  }

  // Claim land
  const cap = constitution.landCap === 0 ? Infinity : constitution.landCap;
  for (const a of alive) {
    const ci = cellIdx(a.x, a.y);
    const cell = state.cells[ci];
    if (cell.ownerId === null && a.wealth >= LAND_CLAIM_COST && a.ownedCells.size < cap) {
      cell.ownerId = a.id;
      a.ownedCells.add(ci);
      a.wealth -= LAND_CLAIM_COST;
    }
  }

  // Trade
  const tradeChance = constitution.marketFreedom;
  if (alive.length >= 2) {
    const rounds = Math.max(1, Math.floor(alive.length * 0.15));
    for (let i = 0; i < rounds; i++) {
      if (Math.random() > tradeChance) continue;
      const ia = Math.floor(Math.random() * alive.length);
      let ib = Math.floor(Math.random() * alive.length);
      if (ib === ia) ib = (ib + 1) % alive.length;
      const a = alive[ia], b = alive[ib];
      if (a.wealth > b.wealth + TRADE_DELTA * 2) {
        const delta = Math.min(TRADE_DELTA, (a.wealth - b.wealth) * 0.25);
        a.wealth -= delta;
        b.wealth += delta * 0.92;
      }
    }
  }

  // Age / reproduce / die
  for (const a of alive) {
    a.age++;
    if (a.wealth < 0) a.starveTicks++;
    else a.starveTicks = 0;

    if (a.age > MAX_AGE || a.starveTicks > STARVE_TICKS) {
      killAgent(a);
      continue;
    }

    if (
      a.wealth >= REPRO_WEALTH &&
      alive.length < MAX_AGENTS * 0.92 &&
      Math.random() < 0.009
    ) {
      const heirWealth = a.wealth * 0.4 * (1 - constitution.inheritanceTax);
      a.wealth -= a.wealth * 0.4;
      const nx = (a.x + Math.floor(Math.random() * 5) - 2 + W) % W;
      const ny = (a.y + Math.floor(Math.random() * 5) - 2 + H) % H;
      spawnAgent(heirWealth, nx, ny, 0);
    }
  }

  // History
  state.year++;
  const liveNow = state.agents.filter(a => a.alive);
  const pop = liveNow.length;
  const avgW = pop > 0 ? liveNow.reduce((s, a) => s + a.wealth, 0) / pop : 0;
  const gini = calcGini(liveNow.map(a => a.wealth));

  push(state.history.pop, pop);
  push(state.history.gini, gini);
  push(state.history.wealth, avgW);

  // Trim dead agents from array every 120 ticks to keep iteration fast
  if (state.year % 120 === 0) {
    state.agents = state.agents.filter(a => a.alive);
  }
}

function redistribute(alive) {
  if (state.treasury <= 0.5 || alive.length === 0) return;

  switch (constitution.redistribution) {
    case 'universal': {
      const share = state.treasury / alive.length;
      for (const a of alive) a.wealth += share;
      state.treasury = 0;
      break;
    }
    case 'means_tested': {
      const sorted = [...alive].sort((a, b) => a.wealth - b.wealth);
      const bottom = sorted.slice(0, Math.max(1, Math.ceil(sorted.length * 0.35)));
      const share = state.treasury / bottom.length;
      for (const a of bottom) a.wealth += share;
      state.treasury = 0;
      break;
    }
    case 'public_goods': {
      const budget = state.treasury;
      state.treasury = 0;
      const boosts = Math.ceil(budget * 1.5);
      for (let i = 0; i < boosts; i++) {
        const ci = Math.floor(Math.random() * W * H);
        state.cells[ci].fertility = Math.min(0.98, state.cells[ci].fertility + 0.012);
      }
      break;
    }
    case 'none':
      state.treasury *= 0.998;
      break;
  }
}

function calcGini(rawWealths) {
  if (rawWealths.length < 2) return 0;
  const ws = rawWealths.map(w => Math.max(0, w)).sort((a, b) => a - b);
  const n = ws.length;
  const total = ws.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  let num = 0;
  for (let i = 0; i < n; i++) num += (2 * (i + 1) - n - 1) * ws[i];
  return Math.max(0, Math.min(1, num / (n * total)));
}

function push(arr, v) {
  arr.push(v);
  if (arr.length > HISTORY_MAX) arr.shift();
}
