// Mirror — App entry point
// Assembles all modules: editor, dashboard, navigation

import { initEditor, getAllEntriesSnapshot } from './editor.js';
import { renderFullHeatmap, getTopWords, computeStreak } from './charts.js';
import { getThemeLabel, detectThemes } from './prompts.js';

// ── Init ──

document.addEventListener('DOMContentLoaded', async () => {
  await initEditor();
  bindViewToggle();
  bindExport();
});

// ── View Toggle (Write ↔ Dashboard) ──

function bindViewToggle() {
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const view = tab.dataset.view;
      const editorPane = document.getElementById('editor-pane');

      if (view === 'dashboard') {
        editorPane.classList.add('dashboard-mode');
        renderDashboard();
      } else {
        editorPane.classList.remove('dashboard-mode');
      }
    });
  });
}

// ── Dashboard ──

function renderDashboard() {
  const entries = getAllEntriesSnapshot();
  const { current, longest } = computeStreak(entries);

  // Stats
  const totalWords = entries.reduce((s, e) => s + (e.wordCount || 0), 0);
  const uniqueDays = new Set(entries.map(e => e.date)).size;

  document.getElementById('dash-total-entries').textContent = entries.length;
  document.getElementById('dash-total-words').textContent = totalWords.toLocaleString();
  document.getElementById('dash-streak-current').textContent = current;
  document.getElementById('dash-streak-longest').textContent = longest;
  document.getElementById('dash-unique-days').textContent = uniqueDays;

  // Heatmap
  const heatContainer = document.getElementById('dash-heatmap');
  if (heatContainer) renderFullHeatmap(heatContainer, entries);

  // Top words
  const topWords = getTopWords(entries, 8);
  const maxCount = topWords[0]?.count || 1;
  const wordListEl = document.getElementById('dash-word-freq');
  if (wordListEl) {
    wordListEl.innerHTML = topWords.map(({ word, count }) => `
      <div class="word-freq-item">
        <span class="word-freq-label">${word}</span>
        <div class="word-freq-bar" style="width:${Math.round((count/maxCount)*120)}px"></div>
        <span class="word-freq-count">${count}</span>
      </div>`).join('');
  }

  // Top themes across all entries
  const themeCounts = {};
  for (const e of entries) {
    for (const t of (e.themes || [])) {
      themeCounts[t] = (themeCounts[t] || 0) + 1;
    }
  }
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const themeListEl = document.getElementById('dash-themes');
  if (themeListEl) {
    themeListEl.innerHTML = topThemes.length
      ? topThemes.map(([t, n]) => `
          <div class="theme-pill">
            ${getThemeLabel(t)}
            <span class="theme-count">${n}</span>
          </div>`).join('')
      : '<span style="color:var(--text-3);font-size:12px">写几条之后会出现</span>';
  }
}

// ── Export ──

function bindExport() {
  document.getElementById('btn-export')?.addEventListener('click', exportEntries);
}

function exportEntries() {
  const entries = getAllEntriesSnapshot();
  if (!entries.length) {
    showToast('没有可导出的记录');
    return;
  }

  const lines = entries.map(e => {
    const divider = '─'.repeat(50);
    return `${divider}\n日期：${e.date}\n字数：${e.wordCount || 0}\n主题：${(e.themes||[]).map(getThemeLabel).join('、') || '—'}\n\n${e.content}\n`;
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mirror-journal-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('已导出');
}

// ── Toast notification ──

function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

// Make showToast available globally (editor module needs it)
window.showToast = showToast;
