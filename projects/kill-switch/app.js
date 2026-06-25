// State: scores[0..4], each 0-100 (higher = healthier signal)
const STATE_KEY = 'killswitch_scores';

const Labels = [
  'Pain Depth',
  'Use Frequency',
  'Alternatives',
  'Love Signal',
  'Conviction',
];

function saveScores(scores) {
  sessionStorage.setItem(STATE_KEY, JSON.stringify(scores));
}

function loadScores() {
  const raw = sessionStorage.getItem(STATE_KEY);
  return raw ? JSON.parse(raw) : [50, 50, 50, 50, 50];
}

// Verdict logic: weighted average → category
function getVerdict(scores) {
  // Weights: pain and love signal matter most
  const weights = [0.25, 0.15, 0.20, 0.25, 0.15];
  const weighted = scores.reduce((sum, s, i) => sum + s * weights[i], 0);

  if (weighted >= 72) return 'double';
  if (weighted >= 55) return 'keep';
  if (weighted >= 38) return 'pivot';
  return 'kill';
}

const VerdictCopy = {
  kill: {
    label: 'Kill It.',
    tagline: 'The numbers don\'t lie. You do.',
    explanation: `The pain you're solving isn't urgent enough to pull people away from their current habits. Users aren't desperate — they're polite. There's a meaningful difference. Right now, you're building a solution looking for a problem. The kindest thing you can do for your time, your money, and your future self is to shut it down cleanly and carry the lessons forward.`,
    steps: [
      'Write a post-mortem while the memory is fresh — what did you assume that turned out wrong?',
      'Identify the one insight you\'d keep if you started over. That might be your next company.',
      'Tell your early users honestly. Some of them will follow you to what comes next.',
      'Give yourself a week, then start looking for the hair-on-fire problem you actually want to solve.',
    ],
  },
  pivot: {
    label: 'Pivot.',
    tagline: 'The core is broken. The instinct might not be.',
    explanation: `You\'re circling a real problem, but the current form isn\'t the answer. Something in the model — the user, the use case, the channel, the pricing — isn't clicking. This isn\'t a failure; it\'s data. The question is whether you have the honesty to change something meaningful, or whether you\'ll do a cosmetic pivot and end up here again in six months.`,
    steps: [
      'Identify your one strongest signal: the user type or use case that actually loves it.',
      'Drop everything else and rebuild exclusively for that person.',
      'Change the model, not just the UI. Real pivots are uncomfortable.',
      'Set a hard date: 60 days to find three users who tell friends unprompted.',
    ],
  },
  keep: {
    label: 'Keep Going.',
    tagline: 'Early signals are real. Execution is the variable.',
    explanation: `The fundamentals are there. There's a genuine problem, some real usage, and you still care. But you're not in breakout territory — you're at the point where most products plateau and die from neglect or loss of focus. The risk isn't that this can't work; it's that you'll get distracted or underfocus just when consistency would compound.`,
    steps: [
      'Define your one metric: the single number that tells you if this is working.',
      'Talk to 10 users this week. Not to pitch — to understand why they stayed.',
      'Ruthlessly cut features until the core is undeniable.',
      'Set a public commitment: ship something that matters in 30 days.',
    ],
  },
  double: {
    label: 'Double Down.',
    tagline: 'You have something. Don\'t waste it hesitating.',
    explanation: `The signals are strong across the board: real pain, real usage, real love. The only way to lose from here is to second-guess yourself, move slowly, or dilute focus across too many things. Most founders who have what you have still find a way to fumble it — usually by waiting for permission they already have.`,
    steps: [
      'Ship the thing you\'ve been nervous to ship. This week.',
      'Find the 10 users who love it most and make them feel like insiders.',
      'Identify your biggest constraint (distribution? retention? revenue?) and attack only that.',
      'Raise if you can, or find the path to default-alive before you need to.',
    ],
  },
};

// Expose for pages
window.KS = { saveScores, loadScores, getVerdict, VerdictCopy, Labels };
