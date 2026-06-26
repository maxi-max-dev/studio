/**
 * 信息场 · UI 控制层
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('sim-canvas');
  const sim    = new Simulator(canvas);
  const viz    = new Visualizer(sim);

  viz.start();   // render loop always runs
  // sim starts paused — user hits Play

  // ── Strategy state ──
  const strategyState = {
    weights: { tech: 5, career: 5, creative: 5, life: 5, emotion: 5, game: 5 },
    frequency: 'medium',
    platforms: ['jike'],
  };

  // ── DOM refs ──
  const sliders     = {};
  const sliderVals  = {};
  TOPICS.forEach(t => {
    sliders[t.id]    = document.getElementById(`slider-${t.id}`);
    sliderVals[t.id] = document.getElementById(`val-${t.id}`);
  });

  const freqSelect    = document.getElementById('freq-select');
  const platformBtns  = document.querySelectorAll('.platform-btn');
  const btnPlay       = document.getElementById('btn-play');
  const btnReset      = document.getElementById('btn-reset');
  const btnSave       = document.getElementById('btn-save');
  const snapshotList  = document.getElementById('snapshot-list');

  const statCaptured = document.getElementById('stat-captured');
  const statEmitted  = document.getElementById('stat-emitted');
  const statRate     = document.getElementById('stat-rate');
  const statTopTopic = document.getElementById('stat-top-topic');
  const statusMsg    = document.getElementById('status-msg');
  const speedLabel   = document.getElementById('speed-label');
  const hudCaptured  = document.getElementById('hud-captured');
  const hudEmitted   = document.getElementById('hud-emitted');
  const miniBarFills = document.querySelectorAll('.mini-bar-fill');
  const statFit      = document.getElementById('stat-fit');
  const statFitBar   = document.getElementById('stat-fit-bar');

  // ── Restore saved strategy to UI ──
  {
    const sw = sim.strategy.weights;
    strategyState.weights   = { ...sw };
    strategyState.frequency = sim.strategy.frequency;
    strategyState.platforms = [...sim.strategy.platforms];
    TOPICS.forEach(t => {
      if (sliders[t.id])    sliders[t.id].value        = sw[t.id] ?? 5;
      if (sliderVals[t.id]) sliderVals[t.id].textContent = sw[t.id] ?? 5;
    });
    freqSelect.value = sim.strategy.frequency;
    platformBtns.forEach(btn => {
      btn.classList.toggle('active', sim.strategy.platforms.includes(btn.dataset.platform));
    });
  }

  // ── Slider inputs ──
  TOPICS.forEach(t => {
    const sl = sliders[t.id];
    if (!sl) return;
    sl.addEventListener('input', () => {
      strategyState.weights[t.id] = parseInt(sl.value);
      sliderVals[t.id].textContent = sl.value;
      pushStrategy();
    });
  });

  freqSelect.addEventListener('change', () => {
    strategyState.frequency = freqSelect.value;
    pushStrategy();
  });

  platformBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.platform;
      const idx = strategyState.platforms.indexOf(pid);
      if (idx >= 0) {
        if (strategyState.platforms.length === 1) return; // keep at least one
        strategyState.platforms.splice(idx, 1);
        btn.classList.remove('active');
      } else {
        strategyState.platforms.push(pid);
        btn.classList.add('active');
      }
      pushStrategy();
    });
  });

  function pushStrategy() {
    sim.updateStrategy({
      weights:   { ...strategyState.weights },
      frequency: strategyState.frequency,
      platforms: [...strategyState.platforms],
    });
    sim.saveStrategyToStorage();
  }

  // ── Control buttons ──
  let playing = false;

  btnPlay.addEventListener('click', () => {
    playing = !playing;
    if (playing) {
      sim.start();
      btnPlay.textContent = '⏸ 暂停';
      btnPlay.classList.replace('btn-primary', 'btn-secondary');
      setMsg('模拟运行中…');
    } else {
      sim.stop();
      btnPlay.textContent = '▶ 开始';
      btnPlay.classList.replace('btn-secondary', 'btn-primary');
      setMsg('已暂停');
    }
  });

  btnReset.addEventListener('click', () => {
    sim.reset();
    if (playing) {
      sim.start();
      setMsg('已重置，继续运行');
    } else {
      setMsg('已重置');
    }
  });

  btnSave.addEventListener('click', () => {
    if (sim.stats.emitted < 5) {
      setMsg('还没有足够数据，先跑一会儿');
      return;
    }
    const label = prompt('给这次策略起个名字（可留空）', `策略 ${sim.snapshots.length + 1}`);
    if (label === null) return;
    const snap = sim.saveSnapshot(label || undefined);
    renderSnapshots();
    setMsg(`已存档：${snap.label}（捕获率 ${snap.rate}%）`);
  });

  // Speed: click speed label to cycle
  let speedIndex = 0;
  const speeds = [1, 2, 4];
  const speedLabels = ['1×', '2×', '4×'];
  speedLabel.style.cursor = 'pointer';
  speedLabel.title = '点击切换速度';
  speedLabel.addEventListener('click', () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    sim.speed = speeds[speedIndex];
    speedLabel.textContent = `速度 ${speedLabels[speedIndex]}`;
  });

  // ── Snapshot list render ──
  function renderSnapshots() {
    snapshotList.innerHTML = '';
    if (sim.snapshots.length === 0) {
      snapshotList.innerHTML = '<div style="color:var(--text-muted);font-size:11px;text-align:center;padding:8px 0">暂无存档</div>';
      return;
    }
    sim.snapshots.forEach(snap => {
      const el = document.createElement('div');
      el.className = 'snapshot-item';
      el.innerHTML = `
        <span class="snapshot-name" style="color:${snap.color}">${snap.label}</span>
        <span style="display:flex;align-items:center;gap:8px">
          <span class="snapshot-score">${snap.rate}%</span>
          <span class="snapshot-del" data-id="${snap.id}" title="删除">×</span>
        </span>`;
      el.querySelector('.snapshot-del').addEventListener('click', (e) => {
        e.stopPropagation();
        sim.deleteSnapshot(snap.id);
        renderSnapshots();
      });
      snapshotList.appendChild(el);
    });
  }

  renderSnapshots();

  // ── Stats refresh loop ──
  function refreshStats() {
    const s = sim.stats;
    const rate = s.emitted ? Math.round(s.captured / s.emitted * 100) : 0;
    statCaptured.textContent = s.captured;
    statEmitted.textContent  = s.emitted;
    statRate.textContent     = s.emitted ? rate + '%' : '—';

    const top = sim.getTopTopics(1)[0];
    statTopTopic.textContent = top ? top.name : '—';
    statTopTopic.style.color  = top ? top.color : 'var(--text)';

    const fit = sim.platformFit();
    if (statFit)    statFit.textContent   = fit + '%';
    if (statFitBar) statFitBar.style.width = fit + '%';

    // HUD
    hudCaptured.querySelector('span').textContent = s.captured;
    hudEmitted.querySelector('span').textContent  = s.emitted;

    // Mini bars (topic weights)
    const weights = strategyState.weights;
    const maxW = Math.max(...Object.values(weights), 1);
    miniBarFills.forEach(bar => {
      const tid = bar.dataset.topic;
      const h = Math.round((weights[tid] / maxW) * 24) || 2;
      bar.style.height = h + 'px';
    });

    requestAnimationFrame(refreshStats);
  }

  requestAnimationFrame(refreshStats);

  function setMsg(msg) {
    statusMsg.textContent = msg;
  }

  setMsg('调整策略后按▶开始模拟');
  pushStrategy();
});
