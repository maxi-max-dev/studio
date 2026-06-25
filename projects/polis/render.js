// Polis — Canvas Renderer (global scope, depends on sim.js globals)

const NODE_STYLE = {
  farm:    { fill:'#031a0a', stroke:'#4ade80', glow:[74,222,128],    label:'农场' },
  mine:    { fill:'#0f1520', stroke:'#94a3b8', glow:[148,163,184],   label:'矿山' },
  market:  { fill:'#1a1100', stroke:'#fbbf24', glow:[251,191,36],    label:'市集' },
  senate:  { fill:'#160820', stroke:'#c084fc', glow:[192,132,252],   label:'元老院' },
}

let _t = 0

function draw(canvas, nowMs) {
  _t = nowMs / 1000
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, CFG.W, CFG.H)

  drawBackground(ctx)
  drawEffects(ctx)
  drawNodes(ctx)
  drawTrails(ctx)
  drawConnections(ctx)
  drawAgents(ctx)
}

// ── Background ──────────────────────────────────────────────────────────────

function drawBackground(ctx) {
  ctx.fillStyle = '#06071a'
  ctx.fillRect(0, 0, CFG.W, CFG.H)

  const leftGrad = ctx.createLinearGradient(0,0,320,0)
  leftGrad.addColorStop(0, 'rgba(74,222,128,0.04)')
  leftGrad.addColorStop(1, 'rgba(74,222,128,0)')
  ctx.fillStyle = leftGrad; ctx.fillRect(0, 0, 320, CFG.H)

  const rightGrad = ctx.createLinearGradient(CFG.W,0,580,0)
  rightGrad.addColorStop(0, 'rgba(148,163,184,0.04)')
  rightGrad.addColorStop(1, 'rgba(148,163,184,0)')
  ctx.fillStyle = rightGrad; ctx.fillRect(580, 0, 320, CFG.H)

  ctx.strokeStyle = 'rgba(255,255,255,0.022)'
  ctx.lineWidth = 1
  for (let x = 0; x <= CFG.W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CFG.H); ctx.stroke()
  }
  for (let y = 0; y <= CFG.H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CFG.W, y); ctx.stroke()
  }
}

// ── Nodes ────────────────────────────────────────────────────────────────────

function drawNodes(ctx) {
  const votingActive = sim.proposals[0] && sim.proposals[0].phase === 'voting'

  sim.nodes.forEach(function(node) {
    const s = NODE_STYLE[node.type]
    const r = s.glow[0], g = s.glow[1], b = s.glow[2]
    const isSenate = node.type === 'senate'

    const pulse = isSenate && votingActive
      ? 1 + 0.25 * Math.sin(_t * 4.5)
      : 1 + 0.07 * Math.sin(_t * 1.4 + node.x * 0.008)

    const glowR = node.r * 2.8 * pulse
    const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR)
    grd.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (isSenate && votingActive ? 0.35 : 0.22) + ')')
    grd.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(node.x, node.y, glowR, 0, Math.PI*2); ctx.fill()

    ctx.fillStyle = s.fill
    ctx.beginPath(); ctx.arc(node.x, node.y, node.r, 0, Math.PI*2); ctx.fill()

    ctx.strokeStyle = s.stroke
    ctx.lineWidth = isSenate ? 2 : 1.5
    ctx.globalAlpha = 0.85
    ctx.beginPath(); ctx.arc(node.x, node.y, node.r, 0, Math.PI*2); ctx.stroke()
    ctx.globalAlpha = 1

    ctx.fillStyle = s.stroke
    ctx.font = (isSenate ? 10 : 9) + 'px system-ui'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.label, node.x, node.y)
  })
}

// ── Trails ───────────────────────────────────────────────────────────────────

function drawTrails(ctx) {
  ctx.lineWidth = 1.5
  sim.agents.forEach(function(agent) {
    const tr = agent.trail
    if (tr.length < 2) return
    const r = ROLES[agent.role].hex[0]
    const g = ROLES[agent.role].hex[1]
    const b = ROLES[agent.role].hex[2]
    for (let i = 1; i < tr.length; i++) {
      const a = (i / tr.length) * 0.3
      ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'
      ctx.beginPath()
      ctx.moveTo(tr[i-1].x, tr[i-1].y)
      ctx.lineTo(tr[i].x,   tr[i].y)
      ctx.stroke()
    }
  })
}

// ── Trade connection lines ────────────────────────────────────────────────────

function drawConnections(ctx) {
  ctx.setLineDash([3,7])
  ctx.lineWidth = 1
  const markets = sim.nodes.filter(function(n) { return n.type === 'market' })
  markets.forEach(function(mkt) {
    sim.agents
      .filter(function(a) { return a.state === 'selling' && a.targetNodeId === mkt.id })
      .forEach(function(a) {
        ctx.strokeStyle = 'rgba(251,191,36,0.13)'
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mkt.x, mkt.y); ctx.stroke()
      })
  })
  ctx.setLineDash([])
}

// ── Agents ───────────────────────────────────────────────────────────────────

function drawAgents(ctx) {
  const votingActive = sim.proposals[0] && sim.proposals[0].phase === 'voting'

  sim.agents.forEach(function(agent) {
    const role = ROLES[agent.role]
    const r = role.hex[0], g = role.hex[1], b = role.hex[2]
    const isSel  = agent.id === sim.selectedId
    const isVot  = agent.voted && votingActive

    const flash  = agent.flashTimer > 0 ? Math.min(1, agent.flashTimer / 35) : 0
    const glowSz = isSel ? 24 : isVot ? 16 : 11
    const glowA  = (isSel ? 0.55 : 0.22) + flash * 0.25

    const grd = ctx.createRadialGradient(agent.x, agent.y, 0, agent.x, agent.y, glowSz)
    grd.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + glowA + ')')
    grd.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(agent.x, agent.y, glowSz, 0, Math.PI*2); ctx.fill()

    const bodyR = isSel ? 6.5 : 4.5
    ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.88 + flash*0.12) + ')'
    ctx.beginPath(); ctx.arc(agent.x, agent.y, bodyR, 0, Math.PI*2); ctx.fill()

    if (isVot) {
      ctx.strokeStyle = agent.voteFor ? 'rgba(74,222,128,0.85)' : 'rgba(248,113,113,0.85)'
      ctx.lineWidth = 1.5
      ctx.beginPath(); ctx.arc(agent.x, agent.y, bodyR+3.5, 0, Math.PI*2); ctx.stroke()
    }

    if (isSel) {
      ctx.strokeStyle = role.color
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(_t * 3))
      ctx.beginPath(); ctx.arc(agent.x, agent.y, 10, 0, Math.PI*2); ctx.stroke()
      ctx.globalAlpha = 1
    }
  })
}

// ── Visual effects (pulses, ripples) ────────────────────────────────────────

function drawEffects(ctx) {
  sim.effects.forEach(function(e) {
    const lifespan = e.type === 'law_pass' ? 160 : 100
    const alpha = Math.max(0, 1 - e.tick / lifespan)

    ctx.strokeStyle = e.color + (alpha * 0.65) + ')'
    ctx.lineWidth = e.type === 'law_pass' ? 2.5 : 1.5
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.stroke()

    if (e.type === 'law_pass' && e.r > 30) {
      ctx.strokeStyle = e.color + (alpha * 0.3) + ')'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.65, 0, Math.PI*2); ctx.stroke()
    }
  })
}
