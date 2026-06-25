// Socratic reflection prompt engine
// Detects themes in text and returns relevant probing questions

// Keyword → theme mappings
const THEME_KEYWORDS = {
  work: ['工作','job','work','career','职业','公司','company','offer','面试','interview','offer','项目','project','deadline','任务','task','boss','上司','同事','colleague','resign','离职','加班','overtime'],
  decision: ['决定','decide','decision','choice','选择','纠结','struggle','应该','should','must','必须','to do','不确定','uncertain','confused','困惑','consider','考虑','option','选项','plan','计划','weighing'],
  emotion: ['感觉','feel','feeling','情绪','emotion','焦虑','anxiety','anxious','开心','happy','沮丧','depressed','frustrated','upset','tired','累','压力','stress','scared','害怕','担心','worried','excited','excited','兴奋'],
  relationship: ['朋友','friend','家人','family','父母','parents','partner','伴侣','恋人','同事','colleague','mentor','导师','团队','team','someone','某人','he','she','they','他','她','他们'],
  growth: ['学习','learn','study','成长','grow','improve','提升','skill','技能','practice','练习','progress','进步','goal','目标','habit','习惯','discipline','自律','change','改变'],
  identity: ['我是','I am','who am I','自我','self','identity','身份','价值','value','意义','meaning','purpose','目的','believe','相信','principle','原则','pride','骄傲','shame','羞耻'],
  future: ['将来','future','明天','tomorrow','next','下一步','plan','计划','dream','梦想','hope','希望','goal','目标','five years','五年','someday','有一天','eventually','最终'],
  procrastination: ['一直','always','keep','不断','never','从不','should have','早该','avoid','回避','put off','推迟','later','以后','eventually','明天再','tomorrow','not yet','还没'],
};

// Socratic question banks per theme
const QUESTIONS = {
  work: [
    '你说这个工作的问题——这是事实还是解读？',
    '三年后，你现在的担忧还会重要吗？',
    '你最害怕的那个结果，发生概率有多大？凭什么这么觉得？',
    '如果你的最好的朋友有同样的情况，你会建议他怎么做？',
    '你对这份工作的期待，是你真正想要的，还是你觉得你应该想要的？',
    '什么样的进展会让你觉得值得——你能量化吗？',
  ],
  decision: [
    '你最大的顾虑，是基于数据还是感觉？',
    '你真正恐惧的是什么——失败本身，还是别人看到你失败？',
    '如果两个选项都失败了，你更能接受哪一个？为什么？',
    '你在等什么信息才能做决定？这个信息真的会改变你的判断吗？',
    '一年后，哪个选择让你更不后悔？',
    '你现在的"纠结"，有多少是真正的信息不足，多少是回避做决定？',
  ],
  emotion: [
    '这个情绪告诉了你什么？你是在用它做决策，还是只是感受它？',
    '这种感觉以前有过吗？上次是怎么过去的？',
    '你正在体验这个情绪，还是在评判自己有这个情绪？',
    '如果你把这个感觉先放下，你认为接下来应该做什么？',
    '你的感觉和你实际面对的事实，区别在哪？',
  ],
  relationship: [
    '你对这个人的判断，基于他们的行为还是你对动机的猜测？',
    '你最近有没有直接问过他们你想知道的？',
    '这段关系里，你在逃避什么？',
    '你想让这段关系变成什么样——你说清楚过吗？对方知道吗？',
    '如果立场互换，对方会怎么描述这件事？',
  ],
  growth: [
    '你的学习目标背后，真正想解决的问题是什么？',
    '你说你想改变——你过去三十天的行动，支持这个说法吗？',
    '什么是你一直说要做但从没做的？为什么没做？',
    '技能和习惯，你缺的是哪个？',
    '你愿意在这件事上花多少时间、多少年？这个数字是认真的吗？',
  ],
  identity: [
    '这个"我是"的说法，是你的信念还是别人给你贴的标签？',
    '你的价值观和你的实际行为，今天有没有对齐？',
    '你最引以为豪的事，和你最不愿承认的事，有什么共同点？',
    '如果没有人知道，你还会做同样的选择吗？',
    '你现在的生活，是你设计的，还是默认发生的？',
  ],
  future: [
    '这个"将来"的目标，你今天做了什么让它更近一步？',
    '你的计划，有没有做过真正的压力测试？',
    '如果你知道某件事会失败，你还会试吗？为什么？',
    '你对未来的期望，有多少是社会期望的折射？',
  ],
  procrastination: [
    '你说"以后"——具体是哪天？',
    '你一直在回避的那件事，真正让你不舒服的是什么？',
    '这件事做了会怎样？不做会怎样？你想清楚了吗？',
    '你现在在干的事，比你在回避的那件事重要吗？',
  ],
  default: [
    '你写下这些，最想让自己明白的是什么？',
    '你今天的行动，和你自己说的优先级一致吗？',
    '如果这件事是你最好朋友告诉你的，你会怎么回应？',
    '你最不想承认的那部分，是什么？',
    '如果答案已经在你心里，它会是什么？',
  ],
};

// Polarity words for contradiction detection
export const POSITIVE_WORDS = ['love','like','enjoy','great','good','excellent','happy','excited','want','will','can','yes','definitely','always','sure','confident','hope','believe','prefer','agree','ready','清楚','喜欢','确定','想','会','可以','好','很好','期待','相信','愿意','开心'];
export const NEGATIVE_WORDS = ['hate','dislike','avoid','terrible','bad','awful','sad','worried','don\'t','won\'t','can\'t','no','never','unsure','confused','doubt','disagree','fear','scared','not ready','不','没','讨厌','不想','不会','不能','不好','担心','困惑','害怕','回避','纠结'];

export function detectThemes(text) {
  const lower = text.toLowerCase();
  const found = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    const hits = keywords.filter(kw => lower.includes(kw.toLowerCase()));
    if (hits.length > 0) {
      found.push({ theme, score: hits.length });
    }
  }
  found.sort((a, b) => b.score - a.score);
  return found.map(f => f.theme);
}

export function getPrompts(text, count = 4) {
  const themes = detectThemes(text);
  const usedThemes = themes.length > 0 ? themes.slice(0, 3) : ['default'];

  const pool = [];
  for (const theme of usedThemes) {
    const qs = QUESTIONS[theme] || QUESTIONS.default;
    pool.push(...qs);
  }

  // Always add 1-2 from default if not already there
  if (!usedThemes.includes('default')) {
    pool.push(...QUESTIONS.default.slice(0, 2));
  }

  // Deduplicate and shuffle
  const unique = [...new Set(pool)];
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }

  return unique.slice(0, count);
}

export function getThemeLabel(theme) {
  const labels = {
    work: '工作', decision: '决策', emotion: '情绪',
    relationship: '关系', growth: '成长', identity: '自我',
    future: '未来', procrastination: '回避',
  };
  return labels[theme] || theme;
}

export { QUESTIONS, THEME_KEYWORDS };
