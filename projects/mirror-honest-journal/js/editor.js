// Editor module: writing, saving, entry list rendering

import { saveEntry, getAllEntries, deleteEntry, generateId, todayISO, formatDate } from './db.js';
import { getPrompts, detectThemes, getThemeLabel } from './prompts.js';
import { findContradictions } from './contradiction.js';
import { renderMiniHeatmap, computeStreak } from './charts.js';

let allEntries = [];
let activeEntryId = null;
let reflectionDebounceTimer = null;
let isDirty = false;

const $ = (sel) => document.querySelector(sel);

// ── Public API ──

export async function initEditor() {
  allEntries = await getAllEntries();
  renderEntryList();
  renderSidebarStats();

  // Start with a blank entry for today (or load the most recent)
  if (allEntries.length > 0) {
    loadEntry(allEntries[0]);
  } else {
    newEntry();
  }

  bindEvents();
}

export async function refreshAll() {
  allEntries = await getAllEntries();
  renderEntryList();
  renderSidebarStats();
}

// ── Events ──

function bindEvents() {
  const textarea = $('#editor-content');

  textarea.addEventListener('input', () => {
    isDirty = true;
    updateWordCount();
    scheduleReflection();
  });

  // Cmd+S / Ctrl+S to save
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveCurrentEntry();
    }
    // New entry: Cmd+N
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      newEntry();
    }
  });

  $('#btn-new-entry').addEventListener('click', newEntry);
  $('#btn-save').addEventListener('click', saveCurrentEntry);
}

// ── Entry CRUD ──

function newEntry() {
  activeEntryId = generateId();
  isDirty = false;

  const textarea = $('#editor-content');
  textarea.value = '';
  textarea.placeholder = '开始写……\n\n无论什么都行——工作、决定、感受、疑问。';
  textarea.focus();

  updateWordCount();
  updateEditorDate(todayISO());

  // Clear reflection panel
  clearReflection();

  // Deselect in list
  document.querySelectorAll('.entry-item').forEach(el => el.classList.remove('active'));
}

async function saveCurrentEntry() {
  const textarea = $('#editor-content');
  const content = textarea.value.trim();
  if (!content) return;

  const now = Date.now();
  const themes = detectThemes(content);
  const wordCount = countWords(content);

  const entry = {
    id: activeEntryId,
    date: todayISO(),
    content,
    wordCount,
    themes: themes.slice(0, 5),
    createdAt: now,
    updatedAt: now,
  };

  await saveEntry(entry);
  isDirty = false;
  window.showToast?.('已保存');

  allEntries = await getAllEntries();
  renderEntryList();
  renderSidebarStats();

  // Highlight the active item
  const items = document.querySelectorAll('.entry-item');
  items.forEach(el => {
    el.classList.toggle('active', el.dataset.id === activeEntryId);
  });
}

function loadEntry(entry) {
  activeEntryId = entry.id;
  isDirty = false;

  const textarea = $('#editor-content');
  textarea.value = entry.content || '';
  updateWordCount();
  updateEditorDate(entry.date);

  document.querySelectorAll('.entry-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === entry.id);
  });

  // Immediately compute reflections for loaded entry
  computeAndRenderReflection(entry.content);
}

// ── Rendering ──

function renderEntryList() {
  const list = $('#entry-list');
  if (allEntries.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">✍️</div>还没有记录<br>写下第一条吧</div>`;
    return;
  }

  list.innerHTML = allEntries.map(e => {
    const preview = (e.content || '').replace(/\n/g, ' ').slice(0, 60);
    const tagsHtml = (e.themes || []).slice(0, 3)
      .map(t => `<span class="tag">${getThemeLabel(t)}</span>`)
      .join('');
    return `
      <div class="entry-item ${e.id === activeEntryId ? 'active' : ''}" data-id="${e.id}">
        <div class="entry-date">${formatDate(e.date)} · ${e.wordCount || 0}字</div>
        <div class="entry-preview">${preview || '（空）'}</div>
        ${tagsHtml ? `<div class="entry-tags">${tagsHtml}</div>` : ''}
      </div>`;
  }).join('');

  list.querySelectorAll('.entry-item').forEach(el => {
    el.addEventListener('click', () => {
      const entry = allEntries.find(e => e.id === el.dataset.id);
      if (entry) loadEntry(entry);
    });

    // Long press / right-click to delete
    el.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const id = el.dataset.id;
      if (confirm('删除这条记录？')) {
        deleteEntry(id).then(async () => {
          allEntries = await getAllEntries();
          renderEntryList();
          renderSidebarStats();
          if (activeEntryId === id) newEntry();
        });
      }
    });
  });
}

function renderSidebarStats() {
  // Streak
  const { current, longest } = computeStreak(allEntries);
  const streakNum = document.querySelector('.streak-num');
  const streakBar = document.querySelector('.streak-bar');
  if (streakNum) {
    streakNum.textContent = current;
    const label = streakBar?.querySelector('.streak-label');
    if (label) label.textContent = `天连续 · 最长 ${longest}`;
  }

  // Heatmap
  const heatContainer = $('#sidebar-heatmap');
  if (heatContainer) renderMiniHeatmap(heatContainer, allEntries);
}

// ── Reflection Panel ──

function scheduleReflection() {
  clearTimeout(reflectionDebounceTimer);
  reflectionDebounceTimer = setTimeout(() => {
    const content = $('#editor-content').value;
    if (content.length < 30) {
      clearReflection();
      return;
    }
    computeAndRenderReflection(content);
  }, 1200);
}

function computeAndRenderReflection(text) {
  if (!text || text.length < 20) { clearReflection(); return; }

  const themes = detectThemes(text);
  const prompts = getPrompts(text, 4);
  const pastEntries = allEntries.filter(e => e.id !== activeEntryId);
  const contradictions = findContradictions(text, pastEntries, 2);

  renderReflectionPanel(themes, prompts, contradictions);
}

function renderReflectionPanel(themes, prompts, contradictions) {
  const body = $('#reflection-body');
  if (!body) return;

  let html = '';

  // Prompts section
  if (prompts.length > 0) {
    html += `
      <div class="reflection-section fade-in">
        <div class="reflection-section-header prompts">
          <span>💭</span> 苏格拉底追问
        </div>
        <div class="reflection-section-body">
          <div class="prompt-list">
            ${prompts.map(p => `<div class="prompt-card">${p}</div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  // Contradictions section
  if (contradictions.length > 0) {
    html += `
      <div class="reflection-section fade-in">
        <div class="reflection-section-header contradictions">
          <span>⚡</span> 过去说过的
        </div>
        <div class="reflection-section-body">
          ${contradictions.map(c => `
            <div class="contradiction-card">
              <div class="contradiction-quote">「${c.quote}」</div>
              <div class="contradiction-date">${formatDate(c.date)}</div>
              <div class="contradiction-label">${c.reason}</div>
            </div>`).join('')}
        </div>
      </div>`;
  }

  // Themes section
  if (themes.length > 0) {
    html += `
      <div class="reflection-section fade-in">
        <div class="reflection-section-header themes">
          <span>🏷</span> 今天触及的主题
        </div>
        <div class="reflection-section-body">
          <div class="theme-list">
            ${themes.slice(0, 6).map(t => `
              <div class="theme-pill">
                ${getThemeLabel(t)}
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  if (!html) {
    html = `<div class="empty-state"><div class="empty-icon">🪞</div>继续写……<br>镜子会开始反应</div>`;
  }

  body.innerHTML = html;

  // Clicking a prompt copies it to the end of the editor (nudge to respond)
  body.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const textarea = $('#editor-content');
      const q = card.textContent.trim();
      textarea.value += `\n\n→ ${q}\n`;
      textarea.focus();
      textarea.scrollTop = textarea.scrollHeight;
      isDirty = true;
      updateWordCount();
    });
  });
}

function clearReflection() {
  const body = $('#reflection-body');
  if (body) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">🪞</div>开始写……<br>反思会在你写作时出现</div>`;
  }
}

// ── Helpers ──

function countWords(text) {
  const cjk = (text.match(/[一-鿿぀-ヿ]/g) || []).length;
  const latin = (text.trim().split(/\s+/).filter(w => w.match(/[a-zA-Z0-9]/)) || []).length;
  return cjk + latin;
}

function updateWordCount() {
  const text = $('#editor-content')?.value || '';
  const el = $('#word-count');
  if (el) el.textContent = `${countWords(text)} 字`;
}

function updateEditorDate(dateISO) {
  const el = document.querySelector('.editor-date');
  if (el) el.textContent = formatDate(dateISO);
}

export function getAllEntriesSnapshot() {
  return allEntries;
}
