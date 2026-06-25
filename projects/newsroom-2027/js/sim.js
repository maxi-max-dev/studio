// sim.js — 2027 Newsroom simulation engine

const HUMAN_NAMES = [
  'Chen Wei','Lin Xiao','Wu Hao','Zhang Yu',
  'Mei Lin','Li Fen','Xu Rui','Zhao Qi',
  'Sun Jie','Tang Bo','Wen Lu','Fang Yan',
  'Cai Mo','Shen Yi','Guo Ping','He Chun'
];

const AI_NAMES = [
  'ARIA-1','BYTE-7','AXIOM','NOVA-3',
  'RELAY','ECHO-2','FORGE','NEXUS',
  'PULSE','GRID-5','VELA','TRACE'
];

const TOPICS = {
  tech:          { color: '#58a6ff', label: '科技' },
  culture:       { color: '#d2a8ff', label: '文化' },
  business:      { color: '#ffa657', label: '商业' },
  investigation: { color: '#ff7b72', label: '深度' },
};

const ARTICLE_TITLES = {
  tech: [
    'AI 写作工具月活突破两亿','量子计算机商用化时间表',
    '开源模型超越闭源巨头','算力芯片国产替代加速',
    'AR 眼镜进入大众市场','自动驾驶事故追责框架',
    '数字人主播市占率超三成','LLM 推理成本下降 80%',
    '具身智能迎来爆发元年','模型蒸馏技术普及化',
    'AI 代码生成准确率达 94%','边缘计算重塑云计算格局',
  ],
  culture: [
    '短剧席卷东南亚市场','AI 音乐版权争议升温',
    'B 站 UP 主加速 AI 化','虚拟偶像商业价值评估',
    '播客收听时长创历史高','竖屏叙事改写影视语言',
    'AIGC 内容监管新规出台','独立游戏开发门槛归零',
    '数字藏品市场重新洗牌','沉浸式体验经济走入下沉',
  ],
  business: [
    'AI 创业公司融资额缩水','传统媒体数字转型报告',
    'MRR 增速放缓的 SaaS 市场','超级应用时代落幕信号',
    '内容商业化的效率极限','人才争夺：AI 还是人？',
    '订阅疲劳影响内容付费','平台抽成比例国际对比',
    'AGI 风险定价难题','跨境电商新基础设施',
  ],
  investigation: [
    '算法推荐背后的隐性偏见','数据标注工厂的生存状态',
    '平台内容审核标准调查','AI 换脸诈骗产业链起底',
    '大模型训练数据版权困境','内容创作者收入分配不公',
    '媒体信任危机深度调查','AI 辅助新闻的核实难题',
    '算法信息茧房量化报告','平台封号规则透明度调查',
  ],
};

const EVENT_POOL = [
  { text: '读者质疑 AI 生成内容真实性，编辑室讨论核实流程', type: 'warn' },
  { text: 'AI 工具更新，所有 AI 记者效率提升 20%',         type: 'hot'  },
  { text: '平台算法变化，深度内容流量下降 15%',            type: 'warn' },
  { text: '资深记者完成年度深度报道，获读者高度评价',      type: 'hot'  },
  { text: '读者订阅数创月度新高',                          type: 'hot'  },
  { text: '内部工具故障，部分 AI 记者暂停 2 小时',         type: 'warn' },
  { text: '竞品媒体关闭深度报道部门，流量向本刊转移',      type: 'hot'  },
  { text: '独家渠道爆料，紧急调度编辑室资源',              type: 'scoop'},
];

const state = {
  tick:   0,
  day:    1,
  hour:   8,
  minute: 0,
  paused: false,

  config: {
    aiRatio:      0.5,
    teamSize:     8,
    pubSpeed:     2,    // 1=slow 2=normal 3=fast
    contentDepth: 2,    // 1=quick 2=balanced 3=deep
  },

  workers:       [],
  articles:      [],
  published:     [],
  nextArticleId: 1,
  nextWorkerId:  1,

  metrics: {
    totalPublished:    0,
    totalAIPublished:  0,
    audienceK:         0,
    avgQuality:        0,
    aiBylinesPercent:  0,
    publishedThisHour: 0,
    topicCounts: { tech: 0, culture: 0, business: 0, investigation: 0 },
  },

  history: {
    outputPerHour: [],
    qualityScore:  [],
    audienceK:     [],
  },

  events: [],
};

// ── Worker factory ──────────────────────────────────────────
function createWorker(type) {
  const isAI  = type === 'ai';
  const pool  = isAI ? AI_NAMES : HUMAN_NAMES;
  const taken = new Set(state.workers.map(w => w.name));
  const avail = pool.filter(n => !taken.has(n));
  const name  = avail.length ? avail[Math.floor(Math.random() * avail.length)]
                             : (isAI ? 'UNIT-X' : 'Staff');
  return {
    id: state.nextWorkerId++,
    type,
    name,
    productivity: isAI ? 72 + Math.floor(Math.random() * 22)
                       : 58 + Math.floor(Math.random() * 32),
    currentArticleId: null,
    fatigue: 0,
    state: 'idle',
  };
}

function initWorkers() {
  state.workers = [];
  const { teamSize, aiRatio } = state.config;
  const aiCount    = Math.round(teamSize * aiRatio);
  const humanCount = teamSize - aiCount;
  for (let i = 0; i < humanCount; i++) state.workers.push(createWorker('human'));
  for (let i = 0; i < aiCount;    i++) state.workers.push(createWorker('ai'));
}

function rebuildWorkers() {
  const { teamSize, aiRatio } = state.config;
  const targetAI    = Math.round(teamSize * aiRatio);
  const targetHuman = teamSize - targetAI;

  function trim(type, target) {
    const group = state.workers.filter(w => w.type === type);
    while (group.length > target) {
      const idle = group.find(w => w.state !== 'working');
      const rem  = idle || group[group.length - 1];
      if (rem.currentArticleId) {
        const art = state.articles.find(a => a.id === rem.currentArticleId);
        if (art) art.workerId = null;
      }
      state.workers = state.workers.filter(w => w.id !== rem.id);
      group.splice(group.indexOf(rem), 1);
    }
  }

  trim('ai',    targetAI);
  trim('human', targetHuman);

  const curAI    = state.workers.filter(w => w.type === 'ai').length;
  const curHuman = state.workers.filter(w => w.type === 'human').length;
  for (let i = curAI;    i < targetAI;    i++) state.workers.push(createWorker('ai'));
  for (let i = curHuman; i < targetHuman; i++) state.workers.push(createWorker('human'));
}

// ── Article factory ─────────────────────────────────────────
function createArticle() {
  const topicKeys = Object.keys(TOPICS);
  const topic     = topicKeys[Math.floor(Math.random() * topicKeys.length)];
  const titles    = ARTICLE_TITLES[topic];
  const title     = titles[Math.floor(Math.random() * titles.length)];
  const depthBonus = (state.config.contentDepth - 1) * 8;
  const baseQuality = Math.min(100, 40 + depthBonus + Math.floor(Math.random() * 28));
  const isAI = Math.random() < state.config.aiRatio;
  return {
    id: state.nextArticleId++,
    title,
    topic,
    stage: 'pitching',
    quality: baseQuality,
    progress: 0,
    workerId: null,
    isAI,
    audienceHit: 0,
    _stageTick: 0,
    _stageTotal: 0,
  };
}

// ── Stage duration (in ticks) ────────────────────────────────
function stageDuration(stage, worker) {
  const speedMult = [2.0, 1.0, 0.55][state.config.pubSpeed - 1];
  const depthMult = [0.6, 1.0, 1.75][state.config.contentDepth - 1];
  const base = { pitching: 7, drafting: 18, editing: 11 }[stage] || 8;

  let wMult = 1.0;
  if (worker) {
    if (worker.type === 'ai' && stage === 'drafting') wMult = 0.58;
    if (worker.type === 'human' && stage === 'editing') wMult = 0.82;
    if (worker.type === 'human') wMult *= (1 + worker.fatigue / 180);
  }

  return Math.max(3, Math.round(base * speedMult * depthMult * wMult));
}

// ── Assignment ───────────────────────────────────────────────
function assignWorkers() {
  const idle = state.workers.filter(w => w.state === 'idle' && !w.currentArticleId);
  const open = state.articles.filter(a => a.stage !== 'published' && a.workerId === null);

  for (const art of open) {
    if (!idle.length) break;
    const w = idle.shift();
    w.currentArticleId = art.id;
    w.state = 'working';
    art.workerId = w.id;
    art._stageTotal = stageDuration(art.stage, w);
    art._stageTick  = 0;
    art.progress    = 0;
  }
}

// ── Main tick ────────────────────────────────────────────────
function tick() {
  if (state.paused) return;
  state.tick++;

  // Advance simulation time (1 tick ≈ 2 sim-minutes)
  state.minute += 2;
  if (state.minute >= 60) {
    state.minute -= 60;
    state.hour++;
    state.history.outputPerHour.push(state.metrics.publishedThisHour);
    state.history.qualityScore.push(state.metrics.avgQuality | 0);
    state.history.audienceK.push(state.metrics.audienceK | 0);
    if (state.history.outputPerHour.length > 20) state.history.outputPerHour.shift();
    if (state.history.qualityScore.length  > 20) state.history.qualityScore.shift();
    if (state.history.audienceK.length     > 20) state.history.audienceK.shift();
    state.metrics.publishedThisHour = 0;

    if (state.hour >= 24) { state.hour = 0; state.day++; }
  }

  // Spawn new pitch
  const pitchProb = [0.05, 0.11, 0.20][state.config.pubSpeed - 1];
  const pitchCount = state.articles.filter(a => a.stage === 'pitching').length;
  if (pitchCount < 9 && Math.random() < pitchProb) {
    state.articles.push(createArticle());
  }

  // Advance articles
  const toPublish = [];
  for (const art of state.articles) {
    if (!art.workerId || art.stage === 'published') continue;

    art._stageTick++;
    art.progress = Math.min(100, (art._stageTick / art._stageTotal) * 100);

    if (art._stageTick >= art._stageTotal) {
      const w = state.workers.find(w => w.id === art.workerId);
      art.workerId = null;
      art.progress = 100;

      if (w) {
        w.currentArticleId = null;
        if (w.type === 'human') {
          w.fatigue = Math.min(100, w.fatigue + 14);
          w.state = w.fatigue > 68 ? 'tired' : 'idle';
        } else {
          w.state = 'idle';
        }
      }

      if      (art.stage === 'pitching') art.stage = 'drafting';
      else if (art.stage === 'drafting') art.stage = 'editing';
      else if (art.stage === 'editing')  toPublish.push(art);

      art._stageTick  = 0;
      art._stageTotal = 0;
    }
  }

  // Publish finished articles
  for (const art of toPublish) {
    const depthBonus = (state.config.contentDepth - 1) * 4;
    art.quality = Math.min(100, art.quality + depthBonus + Math.floor(Math.random() * 8) - 3);
    art.audienceHit = Math.round((art.quality / 100) * 50 + Math.random() * 28);
    art.stage = 'published';
    art._justPub = true;

    state.metrics.totalPublished++;
    state.metrics.publishedThisHour++;
    state.metrics.topicCounts[art.topic]++;
    if (art.isAI) state.metrics.totalAIPublished++;

    state.published.unshift(art);
    if (state.published.length > 20) state.published.pop();

    state.metrics.audienceK = Math.min(9999, state.metrics.audienceK + art.audienceHit * 0.1);

    const recent = state.published.slice(0, 10);
    state.metrics.avgQuality = Math.round(
      recent.reduce((s, a) => s + a.quality, 0) / recent.length
    );

    state.metrics.aiBylinesPercent = Math.round(
      (state.metrics.totalAIPublished / state.metrics.totalPublished) * 100
    );

    state.articles = state.articles.filter(a => a.id !== art.id);

    if (Math.random() < 0.10) fireEvent(art);
  }

  // Rest tired humans
  for (const w of state.workers) {
    if (w.type === 'human' && w.state === 'tired') {
      w.fatigue = Math.max(0, w.fatigue - 2.5);
      if (w.fatigue < 28) w.state = 'idle';
    }
  }

  assignWorkers();
}

function fireEvent(article) {
  let ev;
  if (article.quality > 82 && Math.random() < 0.45) {
    ev = { text: `「${article.title}」爆款！读者数激增`, type: 'hot' };
    state.metrics.audienceK = Math.min(9999, state.metrics.audienceK + 18);
  } else if (article.topic === 'investigation' && article.quality > 70) {
    ev = { text: `深度报道「${article.title}」引发广泛讨论`, type: 'scoop' };
  } else {
    ev = EVENT_POOL[Math.floor(Math.random() * EVENT_POOL.length)];
  }
  state.events.unshift({ ...ev, tick: state.tick });
  if (state.events.length > 10) state.events.pop();
}

function init() {
  initWorkers();
  for (let i = 0; i < 4; i++) state.articles.push(createArticle());
  assignWorkers();
}
