// Benchmark Drift — SPA

var state = {
  view:            'overview',
  benchmark:       'mmlu',
  providers:       { anthropic: true, openai: true, google: true },
  compareA:        'claude-opus-46',
  compareB:        'claude-opus-47',
};

// ── Router ────────────────────────────────────────────────────────
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.nav-tab').forEach(function(t) {
    var active = t.dataset.view === view;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderView();
}

function renderView() {
  var el = document.getElementById('app');
  if (!el) return;
  switch (state.view) {
    case 'overview':    el.innerHTML = viewOverview();    break;
    case 'timeline':    el.innerHTML = viewTimeline();    break;
    case 'regressions': el.innerHTML = viewRegressions(); break;
    case 'compare':      el.innerHTML = viewCompare();      break;
    case 'leaderboard':  el.innerHTML = viewLeaderboard();  break;
  }
  attachHandlers();
}

// ══════════════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════════════
function viewOverview() {
  var regs = detectRegressions(3);
  var top  = regs[0];
  var totalModels    = MODELS.length;
  var totalBenchmarks = Object.keys(BENCHMARKS).length;

  // Best SWE-bench model
  var bestCoder = null, bestCoderScore = -1;
  MODELS.forEach(function(m) {
    var s = SCORES[m.id];
    if (!s) return;
    var v = s.sweBench ? s.sweBench.value : (s.humaneval ? s.humaneval.value * 0.65 : -1);
    if (v > bestCoderScore) { bestCoderScore = v; bestCoder = m; }
  });

  return [
    '<div class="hero">',
      '<div class="hero-kicker">AI Model Observatory</div>',
      '<div class="hero-headline">New models don\'t always<br>score higher.</div>',
      '<div class="hero-sub">',
        'Benchmark scores across AI model families are not monotonically increasing. ',
        'New releases sometimes regress dramatically on specific capabilities — ',
        'especially long-context retrieval, where a single update can erase months of progress.',
      '</div>',
    '</div>',

    '<div class="g3" style="margin-bottom:1.5rem">',

      // Worst regression card
      top ? [
        '<div class="card" style="border-color:rgba(248,113,113,.25)">',
          '<div class="card-label">Worst Regression Detected</div>',
          '<div class="stat-value" style="color:var(--red)">−' + top.drop.toFixed(1) + 'pp</div>',
          '<div style="font-size:.85rem;margin:.15rem 0 .3rem">' + BENCHMARKS[top.benchmark].name + '</div>',
          '<div style="font-size:.78rem;color:var(--muted)">',
            dotFor(top.provider),
            getModel(top.modelBefore).name + ' → ' + getModel(top.modelAfter).name,
          '</div>',
        '</div>',
      ].join('') : '',

      // Top coder card
      bestCoder ? [
        '<div class="card">',
          '<div class="card-label">Top Coding Model</div>',
          '<div style="font-size:1rem;font-weight:600;margin:.3rem 0 .4rem">',
            dotFor(bestCoder.provider),
            bestCoder.name,
          '</div>',
          SCORES[bestCoder.id].sweBench
            ? '<span class="badge badge-green">' + SCORES[bestCoder.id].sweBench.value + '% SWE-bench</span>'
            : '<span class="badge badge-green">' + SCORES[bestCoder.id].humaneval.value + '% HumanEval</span>',
        '</div>',
      ].join('') : '',

      // Stats card
      '<div class="card">',
        '<div class="card-label">Coverage</div>',
        '<div class="stat-value">' + totalModels + '</div>',
        '<div style="font-size:.8rem;color:var(--muted);margin-top:.2rem">',
          'models &nbsp;·&nbsp; ' + totalBenchmarks + ' benchmarks &nbsp;·&nbsp; ' + regs.length + ' regressions',
        '</div>',
      '</div>',

    '</div>',

    // Spotlight: MRCR regression
    '<div class="card" style="margin-bottom:1.5rem">',
      '<div class="card-label" style="margin-bottom:.6rem">Spotlight — MRCR Long-Context Cliff · Claude Opus 4.x</div>',
      '<div style="font-size:.83rem;color:var(--muted);margin-bottom:1.2rem;max-width:520px">',
        '8-needle recall in a 1 million-token context. The 4.6 → 4.7 update caused a ',
        '<strong style="color:var(--red)">46-point drop</strong>. ',
        'The 4.8 release partially recovered but did not fully restore prior performance.',
      '</div>',
      mrcrSpotlightChart(),
    '</div>',

    '<div class="disclaimer">',
      'Data from Anthropic, OpenAI, and Google model cards and benchmark papers. ',
      'Values marked <strong>~</strong> are interpolated estimates. ',
      'Not investment or purchasing advice.',
    '</div>',
  ].join('');
}

function mrcrSpotlightChart() {
  var models  = ['claude-opus-45', 'claude-opus-46', 'claude-opus-47', 'claude-opus-48'];
  var points  = models.map(function(id) {
    var sc = SCORES[id] && SCORES[id].mrcr;
    return sc ? { id: id, name: getModel(id).name.replace('Claude Opus ', 'Opus '), value: sc.value, est: !!sc.estimated } : null;
  }).filter(Boolean);

  if (points.length < 2) return '<div style="color:var(--muted);font-size:.83rem">Chart unavailable.</div>';

  var W = 560, H = 190;
  var PL = 44, PR = 20, PT = 28, PB = 38;
  var iW = W - PL - PR, iH = H - PT - PB;

  function xOf(i)  { return PL + (i / (points.length - 1)) * iW; }
  function yOf(v)  { return PT + iH - (v / 100) * iH; }

  var gridLines = [0, 25, 50, 75, 100].map(function(v) {
    var y = yOf(v);
    return '<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + y + '" y2="' + y + '" stroke="var(--border)" stroke-dasharray="3 3"/>' +
           '<text x="' + (PL - 5) + '" y="' + (y + 4) + '" fill="var(--muted)" font-size="10" text-anchor="end">' + v + '</text>';
  }).join('');

  var path = points.map(function(p, i) { return (i === 0 ? 'M' : 'L') + ' ' + xOf(i) + ' ' + yOf(p.value); }).join(' ');

  var dots = points.map(function(p, i) {
    var cx = xOf(i), cy = yOf(p.value);
    var prev = points[i - 1];
    var isDown = prev && p.value < prev.value;
    var col = isDown ? 'var(--red)' : 'var(--green)';

    var valLabel = '<text x="' + cx + '" y="' + (cy - 11) + '" fill="' + col + '" font-size="11" text-anchor="middle" font-weight="700">' +
                   p.value + '%' + (p.est ? '~' : '') + '</text>';
    var nameLabel = '<text x="' + cx + '" y="' + (H - PB + 16) + '" fill="var(--muted)" font-size="9.5" text-anchor="middle">' + p.name + '</text>';
    var circle = '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="' + col + '" stroke="var(--bg)" stroke-width="2"/>';

    // Regression annotation between index 1 and 2
    var annotation = '';
    if (i === 2 && prev) {
      var midX = (xOf(1) + xOf(2)) / 2;
      var midY = (yOf(points[1].value) + cy) / 2 - 8;
      annotation = '<text x="' + midX + '" y="' + midY + '" fill="var(--red)" font-size="10.5" text-anchor="middle" font-weight="700">−' +
                   (points[1].value - p.value).toFixed(1) + 'pp</text>';
    }

    return circle + valLabel + nameLabel + annotation;
  }).join('');

  return '<div class="chart-wrap" style="max-width:560px">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" class="chart">' +
      gridLines +
      '<path d="' + path + '" fill="none" stroke="var(--c-anthropic)" stroke-width="2.5" stroke-linejoin="round"/>' +
      dots +
    '</svg></div>';
}

// ══════════════════════════════════════════════════════════════════
// TIMELINE
// ══════════════════════════════════════════════════════════════════
function viewTimeline() {
  var bench = state.benchmark;
  var bInfo = BENCHMARKS[bench];

  return [
    '<div class="section-head" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;margin-top:.5rem">',
      '<div>',
        '<div class="section-title">Benchmark Timeline</div>',
        '<div class="section-sub">' + (bInfo ? bInfo.desc : '') + '</div>',
      '</div>',
      '<select id="benchSel">' + Object.keys(BENCHMARKS).map(function(k) {
        return '<option value="' + k + '"' + (k === bench ? ' selected' : '') + '>' + BENCHMARKS[k].name + '</option>';
      }).join('') + '</select>',
    '</div>',

    '<div class="filter-row">',
      '<span style="font-size:.75rem;color:var(--muted);margin-right:.25rem">Providers:</span>',
      Object.keys(PROVIDERS).map(function(k) {
        var on = state.providers[k];
        return '<button class="pill pill-' + k + (on ? ' on' : '') + '" data-provider="' + k + '">' + PROVIDERS[k].name + '</button>';
      }).join(''),
    '</div>',

    '<div class="card" id="timeline-card">',
      timelineChart(bench),
    '</div>',

    '<div style="margin-top:1.25rem">',
      rankTable(bench),
    '</div>',

    '<p style="font-size:.72rem;color:var(--muted);margin-top:.75rem">Hollow dots = estimated values.</p>',
  ].join('');
}

function timelineChart(bench) {
  var W = 780, H = 270;
  var PL = 44, PR = 24, PT = 22, PB = 48;
  var iW = W - PL - PR, iH = H - PT - PB;

  // Collect points per provider
  var seriesData = {};
  Object.keys(PROVIDERS).forEach(function(prov) {
    if (!state.providers[prov]) return;
    seriesData[prov] = MODELS
      .filter(function(m) { return m.provider === prov && SCORES[m.id] && SCORES[m.id][bench]; })
      .sort(function(a, b) { return a.date.localeCompare(b.date); })
      .map(function(m) {
        return { id: m.id, name: m.name, date: m.date, value: SCORES[m.id][bench].value, est: !!SCORES[m.id][bench].estimated };
      });
  });

  var allPts = [];
  Object.values(seriesData).forEach(function(arr) { arr.forEach(function(p) { allPts.push(p); }); });
  if (!allPts.length) return '<div style="padding:2rem;text-align:center;color:var(--muted)">No data for this selection.</div>';

  // Date → numeric month offset from 2023-01
  function dateNum(d) {
    var parts = d.split('-');
    return (parseInt(parts[0]) - 2023) * 12 + parseInt(parts[1]) - 1;
  }
  var allDates = allPts.map(function(p) { return dateNum(p.date); });
  var minD = Math.min.apply(null, allDates), maxD = Math.max.apply(null, allDates);
  var spanD = Math.max(1, maxD - minD);

  var allVals = allPts.map(function(p) { return p.value; });
  var minV = Math.max(0, Math.min.apply(null, allVals) - 8);
  var maxV = Math.min(100, Math.max.apply(null, allVals) + 5);
  var spanV = Math.max(1, maxV - minV);

  function xOf(d) { return PL + ((dateNum(d) - minD) / spanD) * iW; }
  function yOf(v) { return PT + iH - ((v - minV) / spanV) * iH; }

  // Grid
  var gridStep = spanV > 50 ? 25 : spanV > 20 ? 10 : 5;
  var firstGrid = Math.ceil(minV / gridStep) * gridStep;
  var grids = [];
  for (var gv = firstGrid; gv <= maxV; gv += gridStep) {
    var gy = yOf(gv);
    grids.push('<line x1="' + PL + '" x2="' + (W - PR) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--border)" stroke-dasharray="3 3"/>');
    grids.push('<text x="' + (PL - 5) + '" y="' + (gy + 4) + '" fill="var(--muted)" font-size="10" text-anchor="end">' + gv + '%</text>');
  }

  // X-axis year labels
  var yearLabels = [];
  for (var yr = 2023; yr <= 2026; yr++) {
    var yd = dateNum(yr + '-06');
    if (yd < minD - 6 || yd > maxD + 6) continue;
    var yx = xOf(yr + '-06');
    yearLabels.push('<text x="' + yx + '" y="' + (H - PB + 20) + '" fill="var(--muted)" font-size="10" text-anchor="middle">' + yr + '</text>');
  }

  // Series
  var paths = Object.keys(seriesData).map(function(prov) {
    var pts = seriesData[prov];
    if (!pts.length) return '';
    var col = PROVIDERS[prov].color;
    var d = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + ' ' + xOf(p.date) + ' ' + yOf(p.value); }).join(' ');
    var circles = pts.map(function(p) {
      var cx = xOf(p.date), cy = yOf(p.value);
      var fill = p.est ? 'var(--bg)' : col;
      var sw = p.est ? '2' : '2';
      return '<circle cx="' + cx + '" cy="' + cy + '" r="4.5" fill="' + fill + '" stroke="' + col + '" stroke-width="' + sw + '" ' +
             'data-tip="' + p.name + ': ' + p.value + '%' + (p.est ? ' (est.)' : '') + '"/>';
    }).join('');
    return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/>' + circles;
  }).join('');

  // Legend
  var legend = Object.keys(seriesData).filter(function(k) { return seriesData[k].length; }).map(function(prov, i) {
    var col = PROVIDERS[prov].color;
    var lx = PL + i * 130;
    return '<rect x="' + lx + '" y="' + (H - PB + 32) + '" width="16" height="2.5" rx="1.5" fill="' + col + '"/>' +
           '<text x="' + (lx + 20) + '" y="' + (H - PB + 35) + '" fill="' + col + '" font-size="10.5">' + PROVIDERS[prov].name + '</text>';
  }).join('');

  return '<div class="chart-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" class="chart" id="tl-svg">' +
    grids.join('') + paths + yearLabels.join('') + legend +
  '</svg></div>';
}

function rankTable(bench) {
  var rows = MODELS
    .filter(function(m) { return SCORES[m.id] && SCORES[m.id][bench] && state.providers[m.provider]; })
    .sort(function(a, b) { return SCORES[b.id][bench].value - SCORES[a.id][bench].value; })
    .slice(0, 8);

  if (!rows.length) return '';
  var html = '<div class="card"><table class="data-table"><thead><tr>' +
    '<th>#</th><th>Model</th><th style="text-align:right">' + BENCHMARKS[bench].name + '</th><th>Release</th>' +
  '</tr></thead><tbody>';
  rows.forEach(function(m, i) {
    var sc = SCORES[m.id][bench];
    html += '<tr><td style="color:var(--muted);font-size:.78rem">' + (i + 1) + '</td>' +
      '<td>' + dotFor(m.provider) + m.name + '</td>' +
      '<td style="text-align:right" class="mono">' + sc.value + '%' + (sc.estimated ? '<span style="color:var(--muted)"> ~</span>' : '') + '</td>' +
      '<td style="color:var(--muted)">' + m.date + '</td></tr>';
  });
  return html + '</tbody></table></div>';
}

// ══════════════════════════════════════════════════════════════════
// REGRESSIONS
// ══════════════════════════════════════════════════════════════════
function viewRegressions() {
  var regs = detectRegressions(2);

  return [
    '<div class="section-head" style="margin-top:.5rem">',
      '<div class="section-title">Detected Regressions</div>',
      '<div class="section-sub">Version-over-version drops of ≥2 percentage points, within model families. Sorted by severity.</div>',
    '</div>',

    '<div class="card">',
      regs.length === 0
        ? '<div style="padding:2rem;text-align:center;color:var(--muted)">No regressions found.</div>'
        : regs.map(regItem).join(''),
    '</div>',
  ].join('');
}

function regItem(r) {
  var mB   = getModel(r.modelBefore);
  var mA   = getModel(r.modelAfter);
  var col  = PROVIDERS[r.provider].color;
  var bench = BENCHMARKS[r.benchmark];

  // Mini horizontal bar: before (faint) vs after (red), scaled to 100
  var wBefore = r.before.toFixed(1);
  var wAfter  = r.after.toFixed(1);

  return '<div class="reg-item">' +
    '<div>' +
      '<div style="font-size:.88rem;font-weight:600;display:flex;align-items:center;gap:.2rem">' +
        '<span class="dot" style="background:' + col + '"></span>' +
        mB.name +
        '<span class="reg-arrow">→</span>' +
        mA.name +
      '</div>' +
      '<div style="font-size:.76rem;color:var(--muted);margin:.15rem 0">' + bench.name + ' &nbsp;·&nbsp; ' + mB.date + ' → ' + mA.date + '</div>' +
      '<div class="mini-bar">' +
        '<span style="font-size:.74rem;color:var(--muted);font-family:monospace;min-width:36px">' + wBefore + '%</span>' +
        '<div class="mini-track">' +
          '<div class="mini-before" style="width:' + wBefore + '%"></div>' +
          '<div class="mini-after"  style="width:' + wAfter  + '%"></div>' +
        '</div>' +
        '<span style="font-size:.74rem;color:var(--red);font-family:monospace;min-width:36px">' + wAfter + '%</span>' +
      '</div>' +
    '</div>' +
    '<div style="flex-shrink:0"><span class="badge badge-red">−' + r.drop.toFixed(1) + 'pp</span></div>' +
  '</div>';
}

// ══════════════════════════════════════════════════════════════════
// COMPARE
// ══════════════════════════════════════════════════════════════════
function viewCompare() {
  return [
    '<div class="section-head" style="margin-top:.5rem">',
      '<div class="section-title">Head-to-Head</div>',
      '<div class="section-sub">Pick two models to compare across all tracked benchmarks.</div>',
    '</div>',

    '<div style="display:flex;gap:1.25rem;flex-wrap:wrap;margin-bottom:1.5rem;align-items:flex-end">',
      '<div>',
        '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.3rem">Model A</div>',
        '<select id="cmpA">' + modelOptions(state.compareA) + '</select>',
      '</div>',
      '<div style="color:var(--muted);padding-bottom:.5rem">vs</div>',
      '<div>',
        '<div style="font-size:.72rem;color:var(--muted);margin-bottom:.3rem">Model B</div>',
        '<select id="cmpB">' + modelOptions(state.compareB) + '</select>',
      '</div>',
    '</div>',

    '<div class="card">',
      compareChart(),
    '</div>',
  ].join('');
}

function modelOptions(selected) {
  return MODELS.map(function(m) {
    return '<option value="' + m.id + '"' + (m.id === selected ? ' selected' : '') + '>' + m.name + '</option>';
  }).join('');
}

function compareChart() {
  var idA = state.compareA, idB = state.compareB;
  var mA  = getModel(idA),  mB  = getModel(idB);
  if (!mA || !mB) return '<div style="color:var(--muted)">Select two models.</div>';

  var colA = PROVIDERS[mA.provider].color;
  var colB = PROVIDERS[mB.provider].color;

  // Header row
  var header = '<div style="display:flex;gap:1rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--border)">' +
    '<div style="display:flex;align-items:center;gap:.45rem"><span class="dot" style="background:' + colA + '"></span><span style="font-weight:600">' + mA.name + '</span><span style="font-size:.76rem;color:var(--muted)">' + mA.date + '</span></div>' +
    '<span style="color:var(--muted)">vs</span>' +
    '<div style="display:flex;align-items:center;gap:.45rem"><span class="dot" style="background:' + colB + '"></span><span style="font-weight:600">' + mB.name + '</span><span style="font-size:.76rem;color:var(--muted)">' + mB.date + '</span></div>' +
  '</div>';

  var rows = Object.keys(BENCHMARKS).map(function(bk) {
    var scA = SCORES[idA] && SCORES[idA][bk];
    var scB = SCORES[idB] && SCORES[idB][bk];
    if (!scA && !scB) return '';
    var vA = scA ? scA.value : null;
    var vB = scB ? scB.value : null;
    var winner = (vA !== null && vB !== null) ? (vA > vB ? 'A' : vB > vA ? 'B' : 'tie') : null;
    var winBadge = winner === 'A' ? '<span class="badge badge-green">A +' + (vA - vB).toFixed(1) + 'pp</span>'
                 : winner === 'B' ? '<span class="badge badge-red">B +' + (vB - vA).toFixed(1) + 'pp</span>'
                 : winner === 'tie' ? '<span class="badge badge-amber">Tie</span>' : '';

    var barA = vA !== null ? '<div class="cmp-fill" style="width:' + vA + '%;background:' + colA + '18;color:' + colA + '">' + vA + '%' + (scA.estimated ? '~' : '') + '</div>' : '';
    var barB = vB !== null ? '<div class="cmp-fill" style="width:' + vB + '%;background:' + colB + '18;color:' + colB + '">' + vB + '%' + (scB.estimated ? '~' : '') + '</div>' : '';

    return '<div class="cmp-row">' +
      '<div class="cmp-bench"><span>' + BENCHMARKS[bk].name + '</span>' + winBadge + '</div>' +
      '<div class="cmp-track">' + barA + '</div>' +
      '<div class="cmp-track">' + barB + '</div>' +
    '</div>';
  }).join('');

  return header + rows;
}

// ══════════════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════════════
function viewLeaderboard() {
  var benchKeys = Object.keys(BENCHMARKS);
  var shortNames = { mmlu: 'MMLU', humaneval: 'HumanEval', gpqa: 'GPQA', math: 'MATH', sweBench: 'SWE', mrcr: 'MRCR' };

  var rows = MODELS
    .filter(function(m) { return state.providers[m.provider]; })
    .map(function(m) {
      var s = SCORES[m.id] || {};
      var vals = benchKeys.filter(function(b) { return s[b]; }).map(function(b) { return s[b].value; });
      var composite = vals.length ? vals.reduce(function(acc, v) { return acc + v; }, 0) / vals.length : null;
      return { m: m, composite: composite, s: s };
    })
    .filter(function(x) { return x.composite !== null; })
    .sort(function(a, b) { return b.composite - a.composite; });

  var rankBadge = function(i) {
    if (i === 0) return '<span class="badge badge-amber" style="font-size:.68rem;letter-spacing:0">1st</span>';
    if (i === 1) return '<span class="badge badge-green" style="font-size:.68rem;letter-spacing:0">2nd</span>';
    if (i === 2) return '<span class="badge badge-green" style="font-size:.68rem;letter-spacing:0;background:rgba(74,222,128,.07)">3rd</span>';
    return '<span style="color:var(--muted);font-size:.78rem">' + (i + 1) + '</span>';
  };

  var headerCells = benchKeys.map(function(b) {
    return '<th style="text-align:right;white-space:nowrap">' + (shortNames[b] || b) + '</th>';
  }).join('');

  var bodyRows = rows.map(function(row, i) {
    var m = row.m, s = row.s;
    var col = PROVIDERS[m.provider].color;

    var benchCells = benchKeys.map(function(b) {
      var sc = s[b];
      if (!sc) return '<td style="text-align:right;color:var(--faint)">—</td>';
      var numCol = sc.estimated ? 'var(--muted)' : 'var(--text)';
      return '<td style="text-align:right" class="mono"><span style="color:' + numCol + '">' + sc.value + '</span></td>';
    }).join('');

    return '<tr>' +
      '<td style="text-align:center">' + rankBadge(i) + '</td>' +
      '<td style="white-space:nowrap">' + dotFor(m.provider) + '<span style="font-weight:500">' + m.name + '</span>' +
        '<span style="color:var(--muted);font-size:.72rem;margin-left:.45rem">' + m.date + '</span></td>' +
      '<td style="text-align:right"><strong style="color:' + col + ';font-size:.88rem">' + row.composite.toFixed(1) + '%</strong></td>' +
      benchCells +
    '</tr>';
  }).join('');

  return [
    '<div class="section-head" style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.75rem;margin-top:.5rem">',
      '<div>',
        '<div class="section-title">Overall Leaderboard</div>',
        '<div class="section-sub">Composite = unweighted mean across all available benchmarks. Muted numbers are estimates. — = no data.</div>',
      '</div>',
    '</div>',

    '<div class="filter-row">',
      '<span style="font-size:.75rem;color:var(--muted);margin-right:.25rem">Providers:</span>',
      Object.keys(PROVIDERS).map(function(k) {
        var on = state.providers[k];
        return '<button class="pill pill-' + k + (on ? ' on' : '') + '" data-provider="' + k + '">' + PROVIDERS[k].name + '</button>';
      }).join(''),
    '</div>',

    '<div style="overflow-x:auto">',
      '<div class="card" style="padding:0;overflow:hidden">',
        '<table class="data-table" style="min-width:640px">',
          '<thead><tr>',
            '<th style="text-align:center;width:3.5rem">#</th>',
            '<th>Model</th>',
            '<th style="text-align:right">Composite</th>',
            headerCells,
          '</tr></thead>',
          '<tbody>' + bodyRows + '</tbody>',
        '</table>',
      '</div>',
    '</div>',

    '<p style="font-size:.72rem;color:var(--muted);margin-top:.75rem">',
      'Models with fewer benchmarks on record may rank differently if all were measured. ',
      'Composite does not weight benchmarks by difficulty or recency.',
    '</p>',
  ].join('');
}

// ══════════════════════════════════════════════════════════════════
// HANDLERS
// ══════════════════════════════════════════════════════════════════
function attachHandlers() {
  // Nav tabs
  document.querySelectorAll('.nav-tab').forEach(function(t) {
    t.onclick = function() { navigate(t.dataset.view); };
  });

  // Benchmark selector
  var bSel = document.getElementById('benchSel');
  if (bSel) bSel.onchange = function() { state.benchmark = bSel.value; renderView(); };

  // Provider pills
  document.querySelectorAll('.pill[data-provider]').forEach(function(btn) {
    btn.onclick = function() {
      var k = btn.dataset.provider;
      var on = !state.providers[k];
      // Don't allow turning off all providers
      if (!on) {
        var activeCount = Object.values(state.providers).filter(Boolean).length;
        if (activeCount <= 1) return;
      }
      state.providers[k] = on;
      renderView();
    };
  });

  // Compare selects
  var cmpA = document.getElementById('cmpA');
  var cmpB = document.getElementById('cmpB');
  if (cmpA) cmpA.onchange = function() { state.compareA = cmpA.value; renderView(); };
  if (cmpB) cmpB.onchange = function() { state.compareB = cmpB.value; renderView(); };

  // SVG tooltip
  var svg = document.getElementById('tl-svg');
  var tip = document.getElementById('tooltip');
  if (svg && tip) {
    svg.addEventListener('mousemove', function(e) {
      var rect = svg.getBoundingClientRect();
      var scaleX = 780 / rect.width;
      var scaleY = 270 / rect.height;
      var mx = (e.clientX - rect.left) * scaleX;
      var my = (e.clientY - rect.top)  * scaleY;

      var best = null, bestDist = 999;
      svg.querySelectorAll('circle[data-tip]').forEach(function(c) {
        var cx = parseFloat(c.getAttribute('cx'));
        var cy = parseFloat(c.getAttribute('cy'));
        var d  = Math.sqrt((cx - mx) * (cx - mx) + (cy - my) * (cy - my));
        if (d < bestDist) { bestDist = d; best = c; }
      });

      if (best && bestDist < 28) {
        tip.textContent  = best.dataset.tip;
        tip.style.display = 'block';
        tip.style.left   = (e.clientX + 14) + 'px';
        tip.style.top    = (e.clientY - 8)  + 'px';
      } else {
        tip.style.display = 'none';
      }
    });
    svg.addEventListener('mouseleave', function() { tip.style.display = 'none'; });
  }
}

// ── Helpers ───────────────────────────────────────────────────────
function dotFor(provider) {
  var col = PROVIDERS[provider] ? PROVIDERS[provider].color : '#888';
  return '<span class="dot" style="background:' + col + '"></span>';
}

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  renderView();
});
