export const NOTEBOOK_KEY = 'nys-hiphop-v1';
export const LESSON_IDS = ['pulse','speech','rhyme','inside','pocket','story','delivery','revise'];
export const ALBUM_IDS = ['all-hail','low-end-theory','supa-dupa-fly','miseducation','aquemini','madvillainy','modal-soul','bayaan','amarelo','introvert'];
export const SONG_IDS = ['lose-yourself','stan','dna','duckworth','dear-mama','changes'];
const NOTE_IDS = [...ALBUM_IDS,...SONG_IDS];
export const LIMITS = {title:120, draft:16000, note:1500};

export function emptyNotebook() {
  return {version:1, completed:[], draft:{title:'',text:''}, notes:{}};
}

export function normalizeSearch(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en').trim();
}

export function matchesEntry(text, group, query, selected, kind='', selectedKind='') {
  return (!selected || group === selected) && (!selectedKind || kind === selectedKind) && normalizeSearch(query).split(/\s+/).every(word => normalizeSearch(text).includes(word));
}

export function readFilter(search, groups, kinds=[]) {
  const params = new URLSearchParams(search);
  const group = params.get('group') || '';
  const kind=params.get('kind') || '';
  return {query:(params.get('q') || '').slice(0,120),group:groups.includes(group) ? group : '',...(kinds.length ? {kind:kinds.includes(kind) ? kind : ''}:{})};
}

function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function bounded(value, max) { return typeof value === 'string' && value.length <= max; }

// Never silently replace a saved notebook that cannot be read in this version.
export function parseNotebook(raw) {
  if (typeof raw !== 'string' || raw.length > 100000) throw new Error('Invalid notebook');
  const data = JSON.parse(raw);
  if (!object(data) || data.version !== 1 || !Array.isArray(data.completed) ||
      data.completed.some(id => !LESSON_IDS.includes(id)) || new Set(data.completed).size !== data.completed.length ||
      !object(data.draft) || !bounded(data.draft.title,LIMITS.title) || !bounded(data.draft.text,LIMITS.draft) ||
      !object(data.notes) || Object.entries(data.notes).some(([id,note]) => !NOTE_IDS.includes(id) || !bounded(note,LIMITS.note))) {
    throw new Error('Invalid notebook');
  }
  return {version:1,completed:[...data.completed],draft:{title:data.draft.title,text:data.draft.text},notes:{...data.notes}};
}

export function notebookText(data) {
  const notes = Object.entries(data.notes).filter(([,text])=>text.trim()).map(([id,text])=>`${id}\n${text}`).join('\n\n');
  return ['NEVER YOUR SOUNDS / HIP-HOP NOTEBOOK',
    `Lessons tried: ${data.completed.length ? data.completed.join(', ') : 'None yet'}`,
    'VERSE DRAFT',data.draft.title || 'Untitled',data.draft.text || '(No draft yet)',
    'LISTENING NOTES',notes || '(No listening notes yet)'].join('\n\n')+'\n';
}

export function nonEmptyLines(text) { return text.split(/\r?\n/).filter(line=>line.trim()).length; }
