// Calendar heatmap and dashboard charts

// Generate last N days as ISO strings
function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    days.push(iso);
  }
  return days;
}

// Build compact heatmap (sidebar) — last 84 days (12 weeks)
export function renderMiniHeatmap(container, entries) {
  const days = lastNDays(84);
  const countByDate = {};
  for (const e of entries) {
    countByDate[e.date] = (countByDate[e.date] || 0) + 1;
  }

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  for (const day of days) {
    const count = countByDate[day] || 0;
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    if (count === 1) cell.classList.add('level-2');
    else if (count === 2) cell.classList.add('level-3');
    else if (count >= 3) cell.classList.add('level-4');
    cell.title = day;
    grid.appendChild(cell);
  }

  container.innerHTML = '';
  container.appendChild(grid);
}

// Build full heatmap (dashboard) — last 364 days (52 weeks × 7)
export function renderFullHeatmap(container, entries) {
  const days = lastNDays(364);
  const countByDate = {};
  for (const e of entries) {
    countByDate[e.date] = (countByDate[e.date] || 0) + 1;
  }

  // Group into weeks (Sun-Sat)
  const weeks = [];
  let currentWeek = [];

  // Pad start to align to Sunday
  const firstDay = new Date(days[0]);
  const startDow = firstDay.getDay(); // 0=Sun
  for (let i = 0; i < startDow; i++) currentWeek.push(null);

  for (const day of days) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  // Month labels
  const monthsRow = document.createElement('div');
  monthsRow.className = 'heatmap-months';
  let lastMonth = null;
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi];
    const firstDate = week.find(d => d !== null);
    if (firstDate) {
      const m = parseInt(firstDate.split('-')[1]) - 1;
      const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      if (m !== lastMonth) {
        const label = document.createElement('span');
        label.className = 'heatmap-month-label';
        label.style.minWidth = '44px';
        label.textContent = monthNames[m];
        monthsRow.appendChild(label);
        lastMonth = m;
      } else {
        const spacer = document.createElement('span');
        spacer.style.minWidth = '16px';
        spacer.style.display = 'inline-block';
        monthsRow.appendChild(spacer);
      }
    }
  }

  const gridEl = document.createElement('div');
  gridEl.className = 'heatmap-full-grid';

  for (const week of weeks) {
    const col = document.createElement('div');
    col.className = 'heatmap-week-col';
    for (const day of week) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell-lg';
      if (day) {
        const count = countByDate[day] || 0;
        if (count === 1) cell.classList.add('level-1');
        else if (count === 2) cell.classList.add('level-2');
        else if (count === 3) cell.classList.add('level-3');
        else if (count >= 4) cell.classList.add('level-4');
        cell.title = `${day}: ${count} entr${count===1?'y':'ies'}`;
      } else {
        cell.style.opacity = '0';
      }
      col.appendChild(cell);
    }
    gridEl.appendChild(col);
  }

  container.innerHTML = '';
  container.appendChild(monthsRow);
  container.appendChild(gridEl);
}

// Word frequency from all entries
export function getTopWords(entries, n = 8) {
  const stopWords = new Set([
    'i','me','my','we','you','he','she','it','they','the','a','an','is','are','was',
    'were','be','been','have','has','had','do','does','did','will','would','could',
    'should','may','might','can','and','or','but','so','if','when','that','this',
    'to','of','in','on','at','for','with','about','from','by','as','not','no','just',
    '我','你','他','她','它','的','了','是','在','有','不','也','都','和','就',
    '很','但','如果','因为','所以','这','那','个','会','要','把','对','与','或',
    'one','two','three','more','some','what','how','why','who','when','where',
  ]);

  const freq = {};
  for (const e of entries) {
    const words = (e.content || '').toLowerCase()
      .replace(/[^\w一-鿿\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word, count]) => ({ word, count }));
}

// Compute writing streak (consecutive days up to today)
export function computeStreak(entries) {
  if (!entries.length) return { current: 0, longest: 0 };

  const dateSet = new Set(entries.map(e => e.date));
  const now = new Date();

  // Current streak
  let current = 0;
  const d = new Date(now);
  while (true) {
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (dateSet.has(iso)) {
      current++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }

  // Longest streak
  const sortedDates = [...dateSet].sort();
  let longest = 0, run = 0;
  let prev = null;
  for (const iso of sortedDates) {
    if (prev) {
      const prevD = new Date(prev);
      prevD.setDate(prevD.getDate() + 1);
      const expectedNext = `${prevD.getFullYear()}-${String(prevD.getMonth()+1).padStart(2,'0')}-${String(prevD.getDate()).padStart(2,'0')}`;
      if (iso === expectedNext) {
        run++;
      } else {
        run = 1;
      }
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
    prev = iso;
  }

  return { current, longest };
}
