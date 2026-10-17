// Versioned, bounded local data. Imported strings are data, never HTML.
export const STUDIO_KEY = 'nys-studio-v1';
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const limits = Object.freeze({collections: 30, resources: 150, compare: 3});
export const emptyStudio = () => ({version: 1, collections: [], compare: []});
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => { throw new Error(message); };
const object = value => value && typeof value === 'object' && !Array.isArray(value);
function string(value, max, label, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(`Invalid ${label}.`);
  return value.trim();
}
export function resourceRef(value, withNote = false) {
  if (!object(value)) fail('Invalid saved resource.');
  const name = string(value.name, 200, 'resource name', true);
  const raw = string(value.url, 2048, 'resource URL', true);
  let url;
  try { url = new URL(raw); } catch { fail('Resource links must be valid HTTPS URLs.'); }
  if (!/^https:\/\//i.test(raw) || /[\s\\\u0000-\u001f\u007f]/.test(raw) || url.protocol !== 'https:' || !url.hostname || url.username || url.password) fail('Resource links must be valid HTTPS URLs without credentials.');
  return {name, url: url.href, ...(withNote ? {note: string(value.note ?? '', 2000, 'resource note')} : {})};
}
export function validateStudio(value) {
  if (!object(value) || value.version !== 1 || !Array.isArray(value.collections) || !Array.isArray(value.compare)) fail('Choose a version 1 My Studio JSON backup.');
  if (value.collections.length > limits.collections || value.compare.length > limits.compare) fail('Backup exceeds the collection or comparison limit.');
  const ids = new Set();
  const collections = value.collections.map(collection => {
    if (!object(collection)) fail('Invalid collection.');
    const id = string(collection.id, 100, 'collection ID', true);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) fail('Collection IDs must be unique.');
    ids.add(id);
    if (!Array.isArray(collection.resources) || collection.resources.length > limits.resources) fail('A collection can hold up to 150 resources.');
    const resources = collection.resources.map(item => resourceRef(item, true));
    if (new Set(resources.map(item => item.url)).size !== resources.length) fail('A collection contains duplicate resources.');
    return {id, name: string(collection.name, 80, 'collection name', true), notes: string(collection.notes ?? '', 4000, 'collection notes'), resources};
  });
  const compare = value.compare.map(item => resourceRef(item));
  if (new Set(compare.map(item => item.url)).size !== compare.length) fail('Comparison contains duplicate resources.');
  const state = {version: 1, collections, compare};
  if (new TextEncoder().encode(JSON.stringify(state, null, 2)).length > MAX_IMPORT_BYTES) fail('My Studio is full (1 MB). Export a backup, then remove some notes or collections.');
  return state;
}
export function parseBackup(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES) fail('Choose a JSON backup smaller than 1 MB.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { fail('This file is not valid JSON. Your collections have not changed.'); }
  return validateStudio(parsed);
}
export function makeId() {
  return globalThis.crypto?.randomUUID?.() || `collection-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function mergeBackup(current, incoming, idFactory = makeId) {
  const next = validateStudio(current);
  const imported = validateStudio(incoming);
  let added = 0;
  for (const collection of imported.collections) {
    // Re-importing the same backup is harmless; changed copies never overwrite notes.
    const content = ({name, notes, resources}) => JSON.stringify({name, notes, resources});
    if (next.collections.some(existing => content(existing) === content(collection))) continue;
    if (next.collections.some(existing => existing.id === collection.id)) collection.id = idFactory();
    next.collections.push(collection);
    added++;
  }
  if (!next.compare.length) next.compare = imported.compare;
  return {state: validateStudio(next), added};
}

export function createStudioStore(getStorage = () => globalThis.localStorage, eventTarget = globalThis.window) {
  let state = emptyStudio();
  let blocked = false;
  let warning = '';
  let persistent = false;
  const listeners = new Set();
  function read() {
    try {
      const raw = getStorage().getItem(STUDIO_KEY);
      state = raw === null ? emptyStudio() : parseBackup(raw);
      blocked = false; warning = ''; persistent = raw !== null;
    } catch {
      blocked = true; persistent = false;
      warning = 'Saved studio data is unavailable or unreadable. Changes stay on this page only. Export before navigating away or reloading; reset My Studio to try saving again.';
    }
  }
  read();
  function notify() { listeners.forEach(listener => listener()); }
  function commit(next) {
    next = validateStudio(next);
    state = next;
    if (!blocked) {
      try { getStorage().setItem(STUDIO_KEY, JSON.stringify(state)); persistent = true; warning = ''; }
      catch { persistent = false; warning = 'Browser storage is full or blocked. Your latest changes are on this page only. Export before navigating away or reloading.'; blocked = true; }
    }
    notify();
  }
  // Incorporate already-persisted changes from other tabs before editing.
  function latest() { if (!blocked) read(); return clone(state); }
  function change(fn) { const next = latest(); const result = fn(next); commit(next); return result; }
  const store = {
    snapshot: () => clone(state),
    status: () => ({warning, persistent}),
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    create(name) {
      const id = makeId();
      change(next => next.collections.push({id, name, notes: '', resources: []}));
      return id;
    },
    updateCollection(id, name, notes) { change(next => { const c = next.collections.find(c => c.id === id); if (!c) fail('Collection no longer exists.'); c.name = name; c.notes = notes; }); },
    removeCollection(id) { change(next => { next.collections = next.collections.filter(c => c.id !== id); }); },
    save(item, id, newName = '') {
      return change(next => {
        let c = next.collections.find(c => c.id === id);
        if (newName) { c = {id: makeId(), name: newName, notes: '', resources: []}; next.collections.push(c); }
        if (!c) fail('Choose a collection or create one.');
        const ref = resourceRef(item, true);
        const exists = c.resources.some(r => r.url === ref.url);
        if (!exists) c.resources.push(ref);
        return {name: c.name, existed: exists};
      });
    },
    note(id, url, note) { change(next => { const r = next.collections.find(c => c.id === id)?.resources.find(r => r.url === url); if (!r) fail('This saved resource no longer exists.'); r.note = note; }); },
    remove(id, url) { change(next => { const c = next.collections.find(c => c.id === id); if (c) c.resources = c.resources.filter(r => r.url !== url); }); },
    toggleCompare(item) {
      change(next => {
        const ref = resourceRef(item);
        if (next.compare.some(r => r.url === ref.url)) next.compare = next.compare.filter(r => r.url !== ref.url);
        else { if (next.compare.length === limits.compare) fail('You can compare up to 3 tools. Remove one from your comparison first.'); next.compare.push(ref); }
      });
    },
    clearCompare() { change(next => { next.compare = []; }); },
    import(raw) { const result = mergeBackup(latest(), parseBackup(raw)); commit(result.state); return result.added; },
    export() { return JSON.stringify(state, null, 2); },
    reset() {
      try { getStorage().removeItem(STUDIO_KEY); blocked = false; warning = ''; }
      catch { blocked = true; warning = 'Browser storage could not be cleared. This tab was reset; saved data may return when storage becomes accessible.'; }
      state = emptyStudio(); persistent = false; notify();
    }
  };
  eventTarget?.addEventListener('storage', event => {
    if ((event.key === STUDIO_KEY || event.key === null) && !blocked) { read(); notify(); }
  });
  return store;
}

export const studioStore = typeof window !== 'undefined' ? createStudioStore() : null;
