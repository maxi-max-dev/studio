// Polis — Simulation Engine (global scope, no ES modules)

const CFG = {
  W: 900, H: 580,
  TRAIL_LEN: 18,
  N_FARMER: 14,
  N_MINER: 10,
  N_GOVERNOR: 4,

  PROD_RATE: 0.055,
  FOOD_CONSUME: 0.005,
  CARRY_CAP: 10,
  GOLD_PER_FOOD: 1.2,
  GOLD_PER_ORE: 2.4,
  SELL_THRESHOLD: 7.5,

  PROPOSAL_INTERVAL: 1600,
  VOTE_DURATION: 1000,
  LAW_DURATION: 7200,

  AGENT_SPEED: 1.15,
  ARRIVE_DIST: 20,
}

const ROLES = {
  farmer:   { label: '农耕者', color: '#4ade80', hex: [74,222,128] },
  miner:    { label: '矿工',   color: '#94a3b8', hex: [148,163,184] },
  governor: { label: '执政官', color: '#c084fc', hex: [192,132,252] },
}

const PROPOSAL_DEFS = [
  {
    id: 'harvest',
    title: '丰收令',
    desc: '农场产量 +40%，持续 2 分钟',
    roleVote: { farmer: 0.88, miner: 0.28, governor: 0.60 },
    effect(s) { s.laws.push({ type:'harvest', factor:1.4, ticks: CFG.LAW_DURATION }) },
  },
  {
    id: 'ore_boom',
    title: '矿业扩张',
    desc: '矿山产量 +50%，持续 2 分钟',
    roleVote: { farmer: 0.22, miner: 0.92, governor: 0.55 },
    effect(s) { s.laws.push({ type:'ore_boom', factor:1.5, ticks: CFG.LAW_DURATION }) },
  },
  {
    id: 'redistribute',
    title: '均富税',
    desc: '前 25% 富人缴纳 20% 财富，均分全体',
    roleVote: { farmer: 0.62, miner: 0.42, governor: 0.80 },
    effect(s) {
      const sorted = [...s.agents].sort((a,b) => b.gold - a.gold)
      const cutoff = Math.ceil(s.agents.length * 0.25)
      let pool = 0
      sorted.slice(0, cutoff).forEach(a => { const t = a.gold * 0.20; a.gold -= t; pool += t })
      const share = pool / s.agents.length
      s.agents.forEach(a => { a.gold += share; a.flashTimer = 40 })
    },
  },
  {
    id: 'market_boom',
    title: '市集繁荣',
    desc: '所有商品售价 +30%，持续 2 分钟',
    roleVote: { farmer: 0.68, miner: 0.70, governor: 0.62 },
    effect(s) { s.laws.push({ type:'market_boom', factor:1.3, ticks: CFG.LAW_DURATION }) },
  },
  {
    id: 'mutual_aid',
    title: '互助基金',
    desc: '每人捐出 5 金，救助贫困市民',
    roleVote: { farmer: 0.55, miner: 0.38, governor: 0.85 },
    effect(s) {
      let pool = 0
      s.agents.forEach(a => { const t = Math.min(a.gold, 5); a.gold -= t; pool += t })
      const poor = s.agents.filter(a => a.gold < 15)
      const targets = poor.length ? poor : s.agents
      const share = pool / targets.length
      targets.forEach(a => { a.gold += share; a.flashTimer = 40 })
    },
  },
]

function rnd(lo, hi) { return lo + Math.random() * (hi - lo) }
function rndPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rndRange(v, range) { return v + (Math.random() - 0.5) * 2 * range }

function makeNodes() {
  return [
    { id:'f1', type:'farm',   x:85,  y:105, r:22, prod: CFG.PROD_RATE },
    { id:'f2', type:'farm',   x:190, y:210, r:22, prod: CFG.PROD_RATE },
    { id:'f3', type:'farm',   x:75,  y:340, r:22, prod: CFG.PROD_RATE },
    { id:'f4', type:'farm',   x:205, y:445, r:22, prod: CFG.PROD_RATE },
    { id:'f5', type:'farm',   x:110, y:530, r:22, prod: CFG.PROD_RATE },

    { id:'m1', type:'mine',   x:810, y:110, r:20, prod: CFG.PROD_RATE * 0.85 },
    { id:'m2', type:'mine',   x:855, y:265, r:20, prod: CFG.PROD_RATE * 0.85 },
    { id:'m3', type:'mine',   x:795, y:400, r:20, prod: CFG.PROD_RATE * 0.85 },
    { id:'m4', type:'mine',   x:830, y:520, r:20, prod: CFG.PROD_RATE * 0.85 },

    { id:'mk1', type:'market', x:450, y:140, r:24 },
    { id:'mk2', type:'market', x:450, y:440, r:24 },

    { id:'senate', type:'senate', x:450, y:290, r:30 },
  ]
}

function makeAgent(id, role) {
  let x, y
  if      (role === 'farmer')   { x = rnd(50,300);  y = rnd(80,560) }
  else if (role === 'miner')    { x = rnd(660,890); y = rnd(80,560) }
  else                          { x = rnd(340,560); y = rnd(160,420) }
  return {
    id, role,
    x, y,
    vx: 0, vy: 0,
    food: role === 'governor' ? rnd(15, 25) : rnd(3, 8),
    carrying: 0,
    gold: rnd(role === 'governor' ? 20 : 5, role === 'governor' ? 50 : 22),
    state: 'idle',
    targetNodeId: null,
    trail: [],
    voted: false,
    voteFor: null,
    flashTimer: 0,
  }
}

const sim = {
  tick: 0,
  speed: 1,
  paused: false,
  agents: [],
  nodes: [],
  proposals: [],
  laws: [],
  events: [],
  effects: [],
  proposalQueue: [],
  nextProposalTick: CFG.PROPOSAL_INTERVAL,
  selectedId: null,
  stats: { totalWealth: 0, gini: 0, lawsPassed: 0, lawsFailed: 0 },
}

function initSim() {
  sim.nodes = makeNodes()
  sim.agents = []
  let id = 0
  for (let i = 0; i < CFG.N_FARMER;   i++) sim.agents.push(makeAgent(id++, 'farmer'))
  for (let i = 0; i < CFG.N_MINER;    i++) sim.agents.push(makeAgent(id++, 'miner'))
  for (let i = 0; i < CFG.N_GOVERNOR; i++) sim.agents.push(makeAgent(id++, 'governor'))
  sim.proposalQueue = [...PROPOSAL_DEFS].sort(() => Math.random() - 0.5)
  pushEvent('🏛️ 城邦建立，历史开始。')
}

function pushEvent(text) {
  sim.events.unshift({ text, day: Math.floor(sim.tick / 2400) + 1 })
  if (sim.events.length > 25) sim.events.length = 25
}

function getNode(id)       { return sim.nodes.find(n => n.id === id) }
function nearest(agent, type) {
  return sim.nodes.filter(n => n.type === type)
    .sort((a, b) => rndRange(dist(agent,a), 40) - rndRange(dist(agent,b), 40))[0]
}
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) }

function moveTo(agent, tx, ty) {
  const dx = tx - agent.x, dy = ty - agent.y
  const d  = Math.hypot(dx, dy)
  if (d < 1) return true
  const spd = CFG.AGENT_SPEED
  agent.vx = (dx/d) * spd + (Math.random() - 0.5) * 0.2
  agent.vy = (dy/d) * spd + (Math.random() - 0.5) * 0.2
  agent.x  = Math.max(8, Math.min(CFG.W - 8, agent.x + agent.vx))
  agent.y  = Math.max(8, Math.min(CFG.H - 8, agent.y + agent.vy))
  agent.trail.push({ x: agent.x, y: agent.y })
  if (agent.trail.length > CFG.TRAIL_LEN) agent.trail.shift()
  return d < CFG.ARRIVE_DIST
}

function agentTick(agent) {
  agent.food -= CFG.FOOD_CONSUME
  if (agent.food < 0) { agent.gold = Math.max(0, agent.gold - 0.008); agent.food = 0 }
  if (agent.flashTimer > 0) agent.flashTimer -= sim.speed

  // Voting override — head to senate when proposal is open and not yet voted
  const prop = sim.proposals[0]
  if (prop && prop.phase === 'voting' && !agent.voted) {
    const senate = getNode('senate')
    const arrived = moveTo(agent, senate.x, senate.y)
    if (arrived) {
      const def = PROPOSAL_DEFS.find(p => p.id === prop.type)
      const base = def ? def.roleVote[agent.role] : 0.5
      const wBias = (agent.role !== 'governor' && prop.type === 'redistribute')
        ? (agent.gold > 60 ? -0.3 : agent.gold < 10 ? 0.2 : 0) : 0
      const prob = Math.max(0.05, Math.min(0.95, base + wBias + (Math.random() - 0.5) * 0.15))
      agent.voteFor = Math.random() < prob
      agent.voted = true
      const weight = Math.max(1, agent.gold)
      prop.votesFor     += agent.voteFor  ? weight : 0
      prop.votesAgainst += !agent.voteFor ? weight : 0
      prop.voterCount++
      agent.state = 'voting'
    }
    return
  }
  if (agent.state === 'voting') { agent.state = 'idle'; agent.targetNodeId = null }

  // Governor — wander and forage food at farms
  if (agent.role === 'governor') {
    if (agent.state === 'idle' || !agent.targetNodeId) {
      const wanderNodes = sim.nodes.filter(n => n.type !== 'senate')
      agent.targetNodeId = rndPick(wanderNodes).id
      agent.state = 'seeking'
    }
    const t = getNode(agent.targetNodeId)
    if (t && moveTo(agent, t.x, t.y)) {
      if (t.type === 'farm') agent.food = Math.min(20, agent.food + 3)
      agent.targetNodeId = null
      agent.state = 'idle'
    }
    return
  }

  // Farmer / Miner shared state machine
  const isF = agent.role === 'farmer'
  const workType    = isF ? 'farm'   : 'mine'
  const goldPerUnit = isF ? CFG.GOLD_PER_FOOD : CFG.GOLD_PER_ORE

  if (agent.state === 'idle' || !agent.targetNodeId) {
    if (agent.carrying >= CFG.SELL_THRESHOLD) {
      agent.targetNodeId = nearest(agent, 'market').id
      agent.state = 'selling'
    } else {
      agent.targetNodeId = nearest(agent, workType).id
      agent.state = 'seeking'
    }
  }

  const target = getNode(agent.targetNodeId)
  if (!target) { agent.state = 'idle'; agent.targetNodeId = null; return }

  const arrived = moveTo(agent, target.x, target.y)

  if (arrived && agent.state === 'seeking') {
    agent.state = 'working'
  } else if (arrived && agent.state === 'working') {
    let prod = target.prod
    if (isF) {
      const law = sim.laws.find(l => l.type === 'harvest')
      if (law) prod = prod * law.factor
      agent.food = Math.min(20, agent.food + prod * 0.25)
    } else {
      const law = sim.laws.find(l => l.type === 'ore_boom')
      if (law) prod = prod * law.factor
    }
    agent.carrying = Math.min(CFG.CARRY_CAP, agent.carrying + prod)
    if (agent.carrying >= CFG.CARRY_CAP) { agent.state = 'idle'; agent.targetNodeId = null }
  } else if (arrived && agent.state === 'selling') {
    let rate = goldPerUnit
    const mktLaw = sim.laws.find(l => l.type === 'market_boom')
    if (mktLaw) rate *= mktLaw.factor
    agent.gold += agent.carrying * rate
    agent.flashTimer = 35
    agent.carrying = 0
    if (!isF) {
      const foodCost = Math.min(agent.gold * 0.2, 6)
      agent.gold -= foodCost
      agent.food = Math.min(20, agent.food + 7)
    }
    agent.state = 'idle'
    agent.targetNodeId = null
  }
}

function governanceTick() {
  // Decay laws
  for (let i = sim.laws.length - 1; i >= 0; i--) {
    sim.laws[i].ticks -= 1
    if (sim.laws[i].ticks <= 0) {
      const def = PROPOSAL_DEFS.find(p => p.id === sim.laws[i].type)
      pushEvent('⏱️ 《' + (def ? def.title : sim.laws[i].type) + '》已到期')
      sim.laws.splice(i, 1)
    }
  }

  // Proposal lifecycle
  const prop = sim.proposals[0]
  if (prop) {
    prop.ticks++
    if (prop.phase === 'voting') {
      if (prop.ticks >= CFG.VOTE_DURATION || prop.voterCount >= sim.agents.length) {
        const passed = prop.votesFor > prop.votesAgainst
        prop.phase = passed ? 'passed' : 'failed'
        sim.agents.forEach(a => {
          a.voted = false
          a.voteFor = null
          if (a.state === 'voting') { a.state = 'idle'; a.targetNodeId = null }
        })
        if (passed) {
          const def = PROPOSAL_DEFS.find(p => p.id === prop.type)
          if (def) def.effect(sim)
          sim.stats.lawsPassed++
          pushEvent('✅ 《' + prop.title + '》通过 (赞 ' + Math.round(prop.votesFor) + ' vs 反 ' + Math.round(prop.votesAgainst) + ')')
          sim.effects.push({ type:'law_pass', x:450, y:290, r:0, maxR:700, color:'rgba(74,222,128,', tick:0 })
        } else {
          sim.stats.lawsFailed++
          pushEvent('❌ 《' + prop.title + '》被否决 (赞 ' + Math.round(prop.votesFor) + ' vs 反 ' + Math.round(prop.votesAgainst) + ')')
          sim.effects.push({ type:'vote_fail', x:450, y:290, r:0, maxR:300, color:'rgba(248,113,113,', tick:0 })
        }
      }
    }
    if ((prop.phase === 'passed' || prop.phase === 'failed') && prop.ticks > CFG.VOTE_DURATION + 300) {
      sim.proposals.shift()
    }
  }

  // Generate new proposal
  if (sim.tick >= sim.nextProposalTick && sim.proposals.length === 0) {
    if (!sim.proposalQueue.length) sim.proposalQueue = [...PROPOSAL_DEFS].sort(() => Math.random() - 0.5)
    const def = sim.proposalQueue.pop()
    sim.proposals.push({
      type: def.id,
      title: def.title,
      desc: def.desc,
      phase: 'voting',
      votesFor: 0,
      votesAgainst: 0,
      voterCount: 0,
      ticks: 0,
    })
    pushEvent('🏛️ 新提案：《' + def.title + '》')
    sim.effects.push({ type:'vote_pulse', x:450, y:290, r:0, maxR:220, color:'rgba(192,132,252,', tick:0 })
    sim.agents.forEach(a => a.voted = false)
    sim.nextProposalTick = sim.tick + CFG.PROPOSAL_INTERVAL
  }
}

function statsUpdate() {
  const ws = sim.agents.map(a => a.gold).sort((a,b) => a-b)
  const total = ws.reduce((s,v) => s+v, 0)
  sim.stats.totalWealth = total
  const n = ws.length
  if (n > 0 && total > 0) {
    let sum = 0
    ws.forEach(function(w, i) { sum += (2*(i+1) - n - 1) * w })
    sim.stats.gini = Math.max(0, Math.min(1, sum / (n * total)))
  }
}

function effectsTick() {
  for (let i = sim.effects.length - 1; i >= 0; i--) {
    const e = sim.effects[i]
    e.r  += (e.maxR - e.r) * 0.07
    e.tick += 1
    if (e.tick > 140) sim.effects.splice(i, 1)
  }
}

function tickSim() {
  if (sim.paused) return
  const steps = Math.round(sim.speed)
  for (let s = 0; s < steps; s++) {
    sim.tick++
    sim.agents.forEach(agentTick)
    governanceTick()
    effectsTick()
  }
  if (sim.tick % 60 === 0) statsUpdate()
}
