// IndexedDB wrapper for Mirror journal entries
// Falls back to localStorage if IndexedDB is unavailable

const DB_NAME = 'mirror-journal';
const DB_VERSION = 1;
const STORE = 'entries';

let db = null;

export async function openDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const store = d.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('date', 'date');
        store.createIndex('updatedAt', 'updatedAt');
      }
    };

    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

// Entry shape: { id, date, content, wordCount, themes, createdAt, updatedAt }

export async function saveEntry(entry) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve(entry);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getEntry(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllEntries() {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).index('updatedAt').getAll();
    req.onsuccess = () => resolve((req.result || []).reverse());
    req.onerror = () => reject(req.error);
  });
}

export async function deleteEntry(id) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function generateId() {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, day] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
}

export function formatDateTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(todayISO())} ${h}:${min}`;
}
