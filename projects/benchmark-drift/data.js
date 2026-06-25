// Benchmark Drift — data layer
// All values are % (higher is better). Estimated values have estimated: true.
// Sources: Anthropic/OpenAI/Google model cards, system cards, benchmark papers.

const PROVIDERS = {
  anthropic: { name: 'Anthropic', color: '#c084fc' },
  openai:    { name: 'OpenAI',    color: '#34d399' },
  google:    { name: 'Google',    color: '#60a5fa' },
};

const MODELS = [
  // ── Anthropic ──────────────────────────────────────────────────
  { id: 'claude-21',          name: 'Claude 2.1',          provider: 'anthropic', date: '2023-11', family: 'claude-opus' },
  { id: 'claude-3-haiku',     name: 'Claude 3 Haiku',      provider: 'anthropic', date: '2024-03', family: 'claude-haiku' },
  { id: 'claude-3-sonnet',    name: 'Claude 3 Sonnet',     provider: 'anthropic', date: '2024-03', family: 'claude-sonnet' },
  { id: 'claude-3-opus',      name: 'Claude 3 Opus',       provider: 'anthropic', date: '2024-03', family: 'claude-opus' },
  { id: 'claude-35-sonnet',   name: 'Claude 3.5 Sonnet',   provider: 'anthropic', date: '2024-06', family: 'claude-sonnet' },
  { id: 'claude-35-haiku',    name: 'Claude 3.5 Haiku',    provider: 'anthropic', date: '2024-11', family: 'claude-haiku' },
  { id: 'claude-35-sonnet2',  name: 'Claude 3.5 Sonnet v2',provider: 'anthropic', date: '2024-10', family: 'claude-sonnet' },
  { id: 'claude-37-sonnet',   name: 'Claude 3.7 Sonnet',   provider: 'anthropic', date: '2025-02', family: 'claude-sonnet' },
  { id: 'claude-opus-45',     name: 'Claude Opus 4.5',     provider: 'anthropic', date: '2025-04', family: 'claude-opus' },
  { id: 'claude-opus-46',     name: 'Claude Opus 4.6',     provider: 'anthropic', date: '2025-05', family: 'claude-opus' },
  { id: 'claude-opus-47',     name: 'Claude Opus 4.7',     provider: 'anthropic', date: '2025-05', family: 'claude-opus' },
  { id: 'claude-opus-48',     name: 'Claude Opus 4.8',     provider: 'anthropic', date: '2025-06', family: 'claude-opus' },
  // ── OpenAI ────────────────────────────────────────────────────
  { id: 'gpt-4',              name: 'GPT-4',               provider: 'openai',    date: '2023-03', family: 'gpt-4' },
  { id: 'gpt-4-turbo',        name: 'GPT-4 Turbo',         provider: 'openai',    date: '2023-11', family: 'gpt-4' },
  { id: 'gpt-4o',             name: 'GPT-4o',              provider: 'openai',    date: '2024-05', family: 'gpt-4' },
  { id: 'o1',                 name: 'o1',                  provider: 'openai',    date: '2024-12', family: 'openai-o' },
  { id: 'o3',                 name: 'o3',                  provider: 'openai',    date: '2025-01', family: 'openai-o' },
  // ── Google ────────────────────────────────────────────────────
  { id: 'gemini-15-pro',      name: 'Gemini 1.5 Pro',      provider: 'google',    date: '2024-02', family: 'gemini-pro' },
  { id: 'gemini-20-flash',    name: 'Gemini 2.0 Flash',    provider: 'google',    date: '2024-12', family: 'gemini-flash' },
  { id: 'gemini-25-pro',      name: 'Gemini 2.5 Pro',      provider: 'google',    date: '2025-03', family: 'gemini-pro' },
];

const BENCHMARKS = {
  mmlu: {
    name: 'MMLU',
    category: 'knowledge',
    desc: '57-subject multitask language understanding — STEM, humanities, social science',
  },
  humaneval: {
    name: 'HumanEval',
    category: 'coding',
    desc: 'Python code generation — pass@1 on 164 hand-crafted problems',
  },
  gpqa: {
    name: 'GPQA Diamond',
    category: 'reasoning',
    desc: 'Graduate-level science Q&A, expert-validated and hard to search',
  },
  math: {
    name: 'MATH',
    category: 'reasoning',
    desc: 'Competition math — AMC / AIME level problems',
  },
  sweBench: {
    name: 'SWE-bench Verified',
    category: 'coding',
    desc: 'Real GitHub issues — % resolved end-to-end correctly',
  },
  mrcr: {
    name: 'MRCR v2 (8-needle)',
    category: 'long-context',
    desc: 'Multi-round retrieval: 8 needles hidden in a 1 million-token haystack',
  },
};

// SCORES[modelId][benchmarkId] = { value: number, estimated?: true }
const SCORES = {
  'claude-21': {
    mmlu:      { value: 78.5 },
    humaneval: { value: 70.9 },
  },
  'claude-3-haiku': {
    mmlu:      { value: 75.2 },
    humaneval: { value: 75.9 },
    gpqa:      { value: 33.3 },
  },
  'claude-3-sonnet': {
    mmlu:      { value: 79.0 },
    humaneval: { value: 73.0 },
    gpqa:      { value: 40.4 },
  },
  'claude-3-opus': {
    mmlu:      { value: 86.8 },
    humaneval: { value: 84.9 },
    gpqa:      { value: 50.4 },
    math:      { value: 60.1 },
  },
  'claude-35-sonnet': {
    mmlu:      { value: 88.7 },
    humaneval: { value: 92.0 },
    gpqa:      { value: 59.4 },
    math:      { value: 71.1 },
    sweBench:  { value: 49.0 },
  },
  'claude-35-haiku': {
    mmlu:      { value: 75.2 },
    humaneval: { value: 88.2 },
    gpqa:      { value: 41.2 },
    math:      { value: 69.3 },
  },
  'claude-35-sonnet2': {
    mmlu:      { value: 88.3 },
    humaneval: { value: 93.7 },
    gpqa:      { value: 65.0 },
    math:      { value: 78.3 },
    sweBench:  { value: 49.0 },
  },
  'claude-37-sonnet': {
    mmlu:      { value: 89.2 },
    humaneval: { value: 96.8 },
    gpqa:      { value: 84.8 },
    math:      { value: 96.2 },
    sweBench:  { value: 62.3 },
  },
  'claude-opus-45': {
    mmlu:      { value: 90.1, estimated: true },
    humaneval: { value: 95.2, estimated: true },
    gpqa:      { value: 81.5, estimated: true },
    math:      { value: 94.1, estimated: true },
    sweBench:  { value: 68.4, estimated: true },
    mrcr:      { value: 82.1, estimated: true },
  },
  'claude-opus-46': {
    mmlu:      { value: 91.2, estimated: true },
    humaneval: { value: 96.1, estimated: true },
    gpqa:      { value: 83.2, estimated: true },
    math:      { value: 95.3, estimated: true },
    sweBench:  { value: 72.5, estimated: true },
    mrcr:      { value: 78.3 },               // from published benchmark
  },
  'claude-opus-47': {
    mmlu:      { value: 90.8, estimated: true },
    humaneval: { value: 97.3, estimated: true },
    gpqa:      { value: 85.8, estimated: true },
    math:      { value: 96.8, estimated: true },
    sweBench:  { value: 78.6, estimated: true },
    mrcr:      { value: 32.2 },               // the 46pp cliff — published benchmark
  },
  'claude-opus-48': {
    mmlu:      { value: 92.3, estimated: true },
    humaneval: { value: 98.5, estimated: true },
    gpqa:      { value: 87.9, estimated: true },
    math:      { value: 97.2, estimated: true },
    sweBench:  { value: 83.2, estimated: true },
    mrcr:      { value: 71.4, estimated: true },
  },
  'gpt-4': {
    mmlu:      { value: 86.4 },
    humaneval: { value: 67.0 },
    gpqa:      { value: 35.7 },
    math:      { value: 52.9 },
  },
  'gpt-4-turbo': {
    mmlu:      { value: 85.6 },               // known slight MMLU regression
    humaneval: { value: 82.0 },
    gpqa:      { value: 48.3 },
    math:      { value: 72.6 },
  },
  'gpt-4o': {
    mmlu:      { value: 88.7 },
    humaneval: { value: 90.2 },
    gpqa:      { value: 53.6 },
    math:      { value: 76.6 },
    sweBench:  { value: 38.8 },
  },
  'o1': {
    mmlu:      { value: 92.3 },
    humaneval: { value: 95.3 },
    gpqa:      { value: 77.3 },
    math:      { value: 94.8 },
    sweBench:  { value: 48.9 },
  },
  'o3': {
    mmlu:      { value: 92.4, estimated: true },
    humaneval: { value: 97.1, estimated: true },
    gpqa:      { value: 87.7, estimated: true },
    math:      { value: 97.9, estimated: true },
    sweBench:  { value: 71.7, estimated: true },
  },
  'gemini-15-pro': {
    mmlu:      { value: 85.9 },
    humaneval: { value: 84.1 },
    gpqa:      { value: 58.5 },
    math:      { value: 67.7 },
  },
  'gemini-20-flash': {
    mmlu:      { value: 85.3, estimated: true },
    humaneval: { value: 91.2, estimated: true },
    gpqa:      { value: 70.4, estimated: true },
    math:      { value: 88.6, estimated: true },
  },
  'gemini-25-pro': {
    mmlu:      { value: 91.2, estimated: true },
    humaneval: { value: 96.4, estimated: true },
    gpqa:      { value: 86.4, estimated: true },
    math:      { value: 97.0, estimated: true },
    sweBench:  { value: 67.3, estimated: true },
    mrcr:      { value: 85.4, estimated: true },
  },
};

function getModel(id) {
  return MODELS.find(m => m.id === id) || null;
}

function detectRegressions(minDrop) {
  minDrop = minDrop == null ? 3 : minDrop;
  const regressions = [];
  const families = {};
  MODELS.forEach(function(m) {
    if (!families[m.family]) families[m.family] = [];
    families[m.family].push(m);
  });
  Object.values(families).forEach(function(models) {
    const sorted = models.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i], b = sorted[i + 1];
      if (!SCORES[a.id] || !SCORES[b.id]) continue;
      Object.keys(BENCHMARKS).forEach(function(bench) {
        const sA = SCORES[a.id][bench];
        const sB = SCORES[b.id][bench];
        if (!sA || !sB) return;
        const drop = sA.value - sB.value;
        if (drop >= minDrop) {
          regressions.push({
            modelBefore: a.id,
            modelAfter:  b.id,
            benchmark:   bench,
            before:      sA.value,
            after:       sB.value,
            drop:        drop,
            provider:    a.provider,
          });
        }
      });
    }
  });
  return regressions.sort(function(a, b) { return b.drop - a.drop; });
}
