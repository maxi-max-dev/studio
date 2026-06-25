/* engine.js — adversarial challenge generation for 反方日记 */
const Engine = (() => {

  /* ── Pattern detectors ──
     Note: \b doesn't work with CJK, so each pattern has English part (with \b)
     OR'd with a Chinese part (no boundary needed, substring is fine). */
  const P = {
    absolute:   /\b(always|never|everyone|nobody|none|definitely|certainly|impossible)\b|必须|总是|从来不|永远|绝对|肯定|不可能|所有人|没有人|从不|一定/i,
    prediction: /\b(will|going to|predict|expect|soon|eventually)\b|一定会|将会|迟早|未来会|以后会|预计|估计/i,
    judgment:   /\b(should|ought|need to|better|worse|right|wrong|good|bad)\b|应该|应当|更好|更差|正确|错误|不对|不应该/i,
    causal:     /\b(because|therefore|since|due to|caused by)\b|因为|所以|因此|导致|由于|的原因|才会|才能/i,
    personal:   /\bI (think|believe|feel|know)\b|我认为|我觉得|我相信|我知道|我感觉|我确定|我以为/i,
    binary:     /\b(either|only option|no other)\b|要么|不是.{1,20}就是|只有|只能|非此即彼|没有别的/i,
    comparison: /\b(better than|worse than|compared to)\b|比.{1,12}更|相比之下|比起|不如|优于|劣于/i,
    universal:  /\b(all|every|always|everyone|never|nobody)\b|所有|每个|全都|没有人|从来没/i,
  };

  /* ── Challenge templates ── */
  function makeQ(type, belief) {
    const b = belief ? `「${belief}」` : '你写的这个核心判断';
    const defs = {
      steelman: {
        icon: '🛡', label: '钢人论证',
        q: `找一个聪明、了解内情、但不同意${b}的人——不是蠢人，是真正的反对者。他们最有力的论点是什么？给出他们的最强版本。`,
      },
      devils_advocate: {
        icon: '⚔️', label: '逆向假设',
        q: `如果${b}正好反过来才是真的，世界是什么样的？认真构建那个版本——它有没有哪怕一点站得住？`,
      },
      premortem: {
        icon: '💀', label: '预演失败',
        q: `三年后，${b}这件事以一种很难看的方式失败了。回头看，第一张倒下的多米诺骨牌是哪一张？`,
      },
      scope: {
        icon: '🔭', label: '边界测试',
        q: `${b}——在 10 倍规模下还成立吗？缩小到一个人呢？换一个文化或时代背景呢？它在什么条件下会失效？`,
      },
      who_disagrees: {
        icon: '👥', label: '异见者',
        q: `谁会强烈不同意${b}？他们的出发点——哪怕只有 20% 的可能是对的——是什么？`,
      },
      assumption: {
        icon: '🧱', label: '前提检验',
        q: `要让${b}为真，你必须先相信哪几个前提？逐一列出来——其中有没有你其实从未认真验证过的？`,
      },
      evidence: {
        icon: '🔍', label: '证伪条件',
        q: `什么样的证据会让你认真动摇${b}？这样的证据客观上存在吗？你有没有在主动寻找它？`,
      },
      survivorship: {
        icon: '🎯', label: '幸存偏差',
        q: `你关注到的例子、案例、数据点——它们代表了全貌吗？还是只看见了支持你立场的那一半？沉默的反例在哪里？`,
      },
      third_option: {
        icon: '🌀', label: '第三条路',
        q: `${b}——这是你考虑过的唯一框架吗？逼自己想出三个完全不同的解读或路径，哪怕听起来很怪。`,
      },
    };
    const d = defs[type] || defs.steelman;
    return { type, icon: d.icon, label: d.label, question: d.q };
  }

  /* ── Extract specific belief phrases from text ── */
  function extractBeliefs(text) {
    const sents = text.split(/[.。!！?？\n]+/).map(s => s.trim()).filter(s => s.length > 8);
    const candidates = sents.filter(s =>
      P.personal.test(s) || P.judgment.test(s) || P.absolute.test(s) || P.universal.test(s)
    );
    return candidates
      .map(s => {
        const cleaned = s
          .replace(/^(我认为|我觉得|我相信|我知道|我感觉|我确定|感觉|觉得)\s*/i, '')
          .replace(/^(I think|I believe|I feel|I know|I'm sure that)\s*/i, '')
          .trim();
        return cleaned.length > 65 ? cleaned.slice(0, 65) + '…' : cleaned;
      })
      .filter(s => s.length > 6)
      .slice(0, 2);
  }

  /* ── Main: generate 3-5 challenges for a body of text ── */
  function generate(body) {
    const d = {};
    for (const [k, re] of Object.entries(P)) {
      if (re.test(body)) d[k] = true;
    }

    const beliefs = extractBeliefs(body);
    const b0 = beliefs[0] || null;
    const b1 = beliefs[1] || b0;

    // Build ordered pick list: [type, belief_to_target]
    const picks = [];

    // Always start with steelman or devils_advocate
    picks.push(b0 ? ['steelman', b0] : ['devils_advocate', null]);

    // Pattern-driven additions
    if (d.prediction || d.judgment)  picks.push(['premortem', b1]);
    if (d.absolute || d.universal)   picks.push(['scope', b0]);
    if (d.comparison)                picks.push(['scope', b0]);
    if (d.binary)                    picks.push(['third_option', b0]);
    if (d.causal)                    picks.push(['assumption', b0]);
    if (d.personal)                  picks.push(['who_disagrees', b1]);

    // Fallback fillers to reach 3 minimum
    const fillers = ['evidence', 'survivorship', 'assumption', 'who_disagrees', 'devils_advocate'];
    for (const f of fillers) {
      if (picks.length >= 3) break;
      if (!picks.find(([t]) => t === f)) picks.push([f, b0]);
    }

    // Deduplicate and cap at 5
    const seen = new Set();
    const final = [];
    for (const [type, belief] of picks) {
      if (seen.has(type) || final.length >= 5) continue;
      seen.add(type);
      const c = makeQ(type, belief);
      final.push({ ...c, id: type + '_' + final.length, response: '', answered: false });
    }

    return final;
  }

  return { generate };
})();
