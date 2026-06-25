/* store.js — localStorage data layer for 反方日记 */
const Store = (() => {
  const KEY = 'ff_v1';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
    catch { return []; }
  }

  function saveAll(entries) {
    localStorage.setItem(KEY, JSON.stringify(entries));
  }

  function get(id) {
    return getAll().find(e => e.id === id) || null;
  }

  function autoTitle(body) {
    const s = body.trim().split(/[.。!！?？\n]/)[0].trim();
    return s.length > 52 ? s.slice(0, 52) + '…' : s || '无题';
  }

  function uid() {
    // timestamp + random suffix — fully deterministic-safe in browser
    return new Date().toISOString().replace(/\D/g, '').slice(2, 14) +
      Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  }

  function create({ title, body, challenges }) {
    const now = new Date().toISOString();
    const entry = {
      id: uid(),
      createdAt: now,
      updatedAt: now,
      title: (title || '').trim() || autoTitle(body),
      body: body.trim(),
      challenges,
      resilience: null,
    };
    const all = getAll();
    all.unshift(entry);
    saveAll(all);
    return entry;
  }

  function update(id, patch) {
    const all = getAll();
    const i = all.findIndex(e => e.id === id);
    if (i === -1) return null;
    all[i] = { ...all[i], ...patch, updatedAt: new Date().toISOString() };
    saveAll(all);
    return all[i];
  }

  function remove(id) {
    saveAll(getAll().filter(e => e.id !== id));
  }

  return { getAll, get, create, update, remove };
})();
