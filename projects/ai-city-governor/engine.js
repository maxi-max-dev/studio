const GameEngine = {
  KEY: 'ai_city_v1',

  get() {
    const raw = localStorage.getItem(this.KEY);
    return raw ? JSON.parse(raw) : null;
  },

  save(state) {
    localStorage.setItem(this.KEY, JSON.stringify(state));
  },

  start(cityName) {
    const ind = { eco: 50, eq: 50, lib: 50, cul: 50, wk: 50, inn: 50, tru: 50, sust: 50 };
    const state = {
      cityName,
      turn: 0,
      indicators: { ...ind },
      snapshots: [{ ...ind }],
      history: []
    };
    this.save(state);
    return state;
  },

  choose(state, optionLabel) {
    const decision = DECISIONS[state.turn];
    const option = decision.options.find(o => o.label === optionLabel);

    INDICATORS.forEach(({ key }) => {
      const delta = option.effects[key] || 0;
      state.indicators[key] = Math.max(0, Math.min(100, state.indicators[key] + delta));
    });

    this._cascade(state.indicators);

    state.history.push({
      turn: state.turn,
      year: decision.year,
      quarter: decision.quarter,
      title: decision.title,
      label: optionLabel,
      text: option.text,
      effects: { ...option.effects },
      outcome: option.outcome,
      parallel: option.parallel
    });

    state.snapshots.push({ ...state.indicators });
    state.turn++;
    this.save(state);
    return option;
  },

  _cascade(ind) {
    if (ind.lib < 35)               ind.tru  = Math.max(0,   ind.tru  - 1);
    if (ind.eq  < 30)               ind.wk   = Math.max(0,   ind.wk   - 1);
    if (ind.tru < 30)               ind.eco  = Math.max(0,   ind.eco  - 1);
    if (ind.inn > 70 && ind.eq < 45) ind.eq  = Math.max(0,   ind.eq   - 1);
    if (ind.cul > 70 && ind.tru < 50) ind.tru = Math.min(100, ind.tru + 1);
    if (ind.sust > 72)              ind.eco  = Math.min(100, ind.eco  + 1);
    if (ind.eq  > 80)               ind.tru  = Math.min(100, ind.tru  + 1);
  },

  done(state) {
    return state.turn >= DECISIONS.length;
  },

  overallScore(state) {
    const vals = INDICATORS.map(({ key }) => state.indicators[key]);
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  },

  closestCity(state) {
    let best = null, minD = Infinity;
    REFERENCE_CITIES.forEach(city => {
      const d = INDICATORS.reduce((acc, { key }) => {
        return acc + Math.pow((state.indicators[key] - city.values[key]), 2);
      }, 0);
      if (d < minD) { minD = d; best = city; }
    });
    return best;
  },

  indicatorColor(val) {
    if (val >= 65) return '#10b981';
    if (val >= 40) return '#f59e0b';
    return '#ef4444';
  },

  indicatorLabel(val) {
    if (val >= 75) return '优秀';
    if (val >= 60) return '良好';
    if (val >= 45) return '一般';
    if (val >= 30) return '警示';
    return '危机';
  }
};
