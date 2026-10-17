import {studioStore as store, MAX_IMPORT_BYTES} from './studio-store.mjs';
import {normalizeCatalogue, categoryLabels, costLabels, platformLabels} from './browse.js';
import {el, button, sourceLink, resourceActions, announce, attempt, mountStudioUI, syncResourceActions, exportBackup} from './studio-ui.js';

const studio = document.getElementById('studio-app');
const comparison = document.getElementById('compare-app');
const root = studio || comparison;
let catalogue = new Map();
let catalogueState = 'loading';
let selected = decodeURIComponentSafe(location.hash.slice(1));
function decodeURIComponentSafe(value) { try { return decodeURIComponent(value); } catch { return ''; } }
function localLink(path, text, className = 'btn btn-primary') {
  const link = el('a', className, text); link.href = path; return link;
}
function empty(title, message) {
  const panel = el('div', 'panel studio-empty');
  const mark = el('span', 'empty-mark', '＋'); mark.setAttribute('aria-hidden', 'true');
  panel.append(mark, el('h2', '', title), el('p', '', message), localLink('browse.html', 'Explore the catalogue →'));
  return panel;
}
function field(label, id, value, max, multiline = false) {
  const group = el('div', 'studio-field');
  const caption = el('label', '', label); caption.htmlFor = id;
  const input = el(multiline ? 'textarea' : 'input'); input.id = id; input.defaultValue = value; input.value = value; input.maxLength = max;
  if (!multiline) input.required = true;
  group.append(caption, input); return {group, input};
}
function renderCollection() {
  const state = store.snapshot();
  if (!state.collections.some(c => c.id === selected)) selected = state.collections[0]?.id || '';
  const count = state.collections.reduce((n, c) => n + c.resources.length, 0);
  document.getElementById('studio-count').textContent = `${state.collections.length} collections · ${count} saved ${count === 1 ? 'tool' : 'tools'}`;
  const nav = document.getElementById('collection-list'); nav.replaceChildren();
  for (const collection of state.collections) {
    const li = el('li');
    const select = button('', () => {
      selected = collection.id;
      try { history.replaceState(null, '', `#${encodeURIComponent(selected)}`); } catch { /* Selection still works. */ }
      renderCollection(); document.getElementById('collection-title')?.focus();
    });
    select.append(el('span', '', collection.name), el('span', 'collection-number', String(collection.resources.length)));
    select.dataset.collectionId = collection.id;
    if (selected === collection.id) select.setAttribute('aria-current', 'true');
    li.append(select); nav.append(li);
  }
  const detail = document.getElementById('collection-detail'); detail.replaceChildren();
  const collection = state.collections.find(c => c.id === selected);
  if (!collection) {
    detail.append(empty('Your next project starts here.', 'Create a collection or use Save on any catalogue resource. Try “First EP”, “Podcast setup”, or “Sound design”.'));
    return;
  }
  const heading = el('div', 'studio-toolbar');
  const title = el('h2', '', collection.name); title.id = 'collection-title'; title.tabIndex = -1;
  heading.append(title, localLink('browse.html', '+ Add tools', 'btn btn-ghost'));
  detail.append(heading);
  if (collection.notes) detail.append(el('p', 'collection-description', collection.notes));
  const edit = el('details', 'collection-edit'); edit.append(el('summary', '', 'Edit collection & project notes'));
  const form = el('form');
  const name = field('Collection name', 'collection-name', collection.name, 80);
  const notes = field('Project notes', 'collection-notes', collection.notes, 4000, true);
  const submit = el('button', 'btn btn-primary', 'Save changes'); submit.type = 'submit';
  const deleteButton = button('Delete collection', () => {
    if (!window.confirm(`Delete “${collection.name}” and its notes? Other collections will stay unchanged.`)) return;
    attempt(() => { store.removeCollection(collection.id); announce('Collection deleted.'); document.getElementById('collection-new-name').focus(); });
  }, 'studio-danger');
  const actions = el('div', 'studio-toolbar'); actions.append(submit, deleteButton);
  form.append(name.group, notes.group, actions);
  form.addEventListener('submit', event => {
    event.preventDefault();
    attempt(() => { store.updateCollection(collection.id, name.input.value, notes.input.value); announce('Collection updated.'); document.getElementById('collection-title')?.focus(); });
  });
  edit.append(form); detail.append(edit);
  if (!collection.resources.length) {
    detail.append(empty('Room for your next discovery.', 'Use Save in the catalogue to add a tool to this collection. You can keep the same resource in more than one collection.'));
  } else {
    const list = el('ul', 'studio-resource-list');
    for (const resource of collection.resources) {
      const item = catalogue.get(resource.url);
      const card = el('li', 'studio-resource');
      const row = el('div', 'studio-toolbar');
      row.append(el('h3', '', item?.name || resource.name), sourceLink(resource.url, 'Visit source ↗'));
      card.append(row);
      card.append(el('p', 'resource-context', item ? `${categoryLabels[item.category]} · ${costLabels[item.cost]}` : catalogueState === 'loading' ? 'Loading catalogue details…' : catalogueState === 'error' ? 'Catalogue unavailable. Your saved link and notes are still here.' : 'Not in the current catalogue. Your saved link and notes are still here.'));
      if (item?.description) card.append(el('p', 'resource-summary', item.description));
      card.append(resourceActions(item || resource));
      const details = el('details', 'studio-note');
      details.dataset.noteUrl = resource.url;
      details.append(el('summary', '', resource.note ? 'Your note · edit' : 'Add a note'));
      if (resource.note) { const preview = el('p', 'collection-description', resource.note); card.append(preview); }
      const noteForm = el('form', 'studio-field');
      const noteField = field(`Note for ${resource.name}`, `note-${collection.resources.indexOf(resource)}`, resource.note, 2000, true);
      noteField.input.dataset.draftUrl = resource.url;
      const noteSave = el('button', 'btn btn-ghost', 'Save note'); noteSave.type = 'submit';
      noteForm.append(noteField.group, noteSave);
      noteForm.addEventListener('submit', event => {
        event.preventDefault();
        attempt(() => {
          store.note(collection.id, resource.url, noteField.input.value);
          announce(`Note saved for ${resource.name}.`);
          [...document.querySelectorAll('[data-note-url]')].find(n => n.dataset.noteUrl === resource.url)?.querySelector('summary').focus();
        });
      });
      details.append(noteForm); card.append(details);
      const remove = button('Remove from collection', () => {
        if (resource.note && !window.confirm(`Remove ${resource.name} and its note from this collection?`)) return;
        attempt(() => { store.remove(collection.id, resource.url); announce(`${resource.name} removed from this collection.`); document.getElementById('collection-title')?.focus(); });
      }, 'studio-danger');
      remove.setAttribute('aria-label', `Remove ${resource.name} from collection`); card.append(remove); list.append(card);
    }
    detail.append(list);
  }
  syncResourceActions();
}

function renderComparison() {
  const {compare} = store.snapshot();
  document.getElementById('comparison-count').textContent = `${compare.length} / 3 tools selected`;
  document.getElementById('comparison-clear').disabled = !compare.length;
  const content = document.getElementById('comparison-content'); content.replaceChildren();
  if (!compare.length) { content.append(empty('Give your shortlist a listen.', 'Choose Compare on up to three catalogue resources, then return here to see their details side by side.')); return; }
  if (compare.length === 1) content.append(el('p', 'muted', 'One tool selected. Add another from Discover for a side-by-side comparison.'));
  const scroll = el('div', 'comparison-scroll'); scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Tool comparison table. Scroll horizontally on smaller screens.');
  const table = el('table', 'comparison-table');
  table.append(el('caption', '', 'Recorded details · Scroll horizontally on smaller screens'));
  const thead = el('thead'), header = el('tr');
  const corner = el('th', '', 'Your shortlist'); corner.scope = 'col'; header.append(corner);
  for (const resource of compare) {
    const th = el('th'); th.scope = 'col';
    th.append(el('span', 'comparison-name', catalogue.get(resource.url)?.name || resource.name));
    const remove = button('Remove ×', () => attempt(() => { store.toggleCompare(resource); announce(`${resource.name} removed from comparison.`); document.querySelector('.comparison-scroll')?.focus(); }));
    remove.setAttribute('aria-label', `Remove ${resource.name} from comparison`); th.append(remove); header.append(th);
  }
  thead.append(header); table.append(thead);
  const body = el('tbody');
  const fields = [
    ['Main use', item => item.description || 'Not recorded.'],
    ['Category', item => categoryLabels[item.category]],
    ['Cost model', item => costLabels[item.cost]],
    ['Listed platforms', item => item.platform.map(p => platformLabels[p]).join(' · ') || 'Not recorded.'],
    ['Cost & access limits', item => item.pricing_notes || 'No specific limits recorded. Check the current offering at the source.'],
    ['License notes', item => item.license_notes || 'No specific license notes recorded. Check the source terms for your intended use.'],
    ['Tags', item => item.tags.join(', ') || 'Not recorded.'],
    ['Offline support', () => 'Not recorded. Check the exact product and edition.'],
    ['Recorded review', item => item.reviewed || 'No review date recorded.']
  ];
  for (const [label, value] of fields) {
    const row = el('tr'); const heading = el('th', '', label); heading.scope = 'row'; row.append(heading);
    for (const resource of compare) {
      const item = catalogue.get(resource.url);
      row.append(el('td', '', item ? value(item) : catalogueState === 'loading' ? 'Loading…' : catalogueState === 'error' ? 'Catalogue unavailable.' : 'Not in the current catalogue.'));
    }
    body.append(row);
  }
  const links = el('tr'); const label = el('th', '', 'Explore & save'); label.scope = 'row'; links.append(label);
  for (const resource of compare) {
    const td = el('td'); td.append(sourceLink(resource.url, 'Visit source ↗'));
    const item = catalogue.get(resource.url);
    if (item?.source_url && item.source_url !== item.url) { const p = el('p'); p.append(sourceLink(item.source_url, 'Source for notes ↗')); td.append(p); }
    td.append(resourceActions(item || resource)); links.append(td);
  }
  body.append(links); table.append(body); scroll.append(table); content.append(scroll); syncResourceActions();
}

// Keep unsaved text and keyboard position when another tab or catalogue load refreshes the view.
function refresh() {
  const active = document.activeElement;
  const compareUrl = active?.dataset.studioCompare;
  const restoreCompareFocus = () => {
    if (compareUrl) [...document.querySelectorAll('[data-studio-compare]')].find(n => n.dataset.studioCompare === compareUrl)?.focus();
  };
  if (!studio) { renderComparison(); restoreCompareFocus(); return; }
  const previous = selected;
  const focus = {id: active?.id, start: active?.selectionStart, end: active?.selectionEnd};
  const inputs = [...document.querySelectorAll('#collection-detail input, #collection-detail textarea')].filter(n => n.value !== n.defaultValue).map(n => ({id:n.id, url:n.dataset.draftUrl, value:n.value}));
  const open = [...document.querySelectorAll('#collection-detail details')].filter(n => n.open).map(n => n.dataset.noteUrl || 'collection');
  renderCollection();
  if (selected !== previous) return;
  inputs.forEach(({id, url, value}) => {
    const node = url ? [...document.querySelectorAll('[data-draft-url]')].find(n => n.dataset.draftUrl === url) : document.getElementById(id);
    if (node) node.value = value;
  });
  document.querySelectorAll('#collection-detail details').forEach(n => { n.open = open.includes(n.dataset.noteUrl || 'collection'); });
  const target = focus.id && document.getElementById(focus.id);
  if (target) { target.focus(); if (typeof focus.start === 'number') target.setSelectionRange?.(focus.start, focus.end); }
  restoreCompareFocus();
}

async function loadCatalogue() {
  catalogueState = 'loading';
  const message = document.getElementById('compare-load-message');
  const retry = document.getElementById('compare-retry');
  if (message) { message.hidden = false; message.textContent = 'Loading catalogue details…'; retry.hidden = true; }
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(root.dataset.source, {signal:controller.signal});
    if (!response.ok) throw new Error('Catalogue unavailable');
    const {items, rejected} = normalizeCatalogue(await response.json());
    if (!items.length) throw new Error('Empty catalogue');
    catalogue = new Map(items.map(item => [item.url, item])); catalogueState = 'ready';
    if (message) { message.textContent = rejected ? `${rejected} malformed entries were omitted.` : ''; message.hidden = !rejected; }
  } catch {
    catalogueState = 'error';
    if (message) { message.textContent = 'Catalogue details could not be loaded. Saved links and selections are still available.'; retry.hidden = false; }
  } finally { clearTimeout(timer); refresh(); }
}

if (root) {
  root.hidden = false;
  mountStudioUI();
  if (studio) {
    renderCollection();
    document.getElementById('collection-create').addEventListener('submit', event => {
      event.preventDefault();
      attempt(() => {
        const input = document.getElementById('collection-new-name'); selected = store.create(input.value); input.value = '';
        renderCollection(); announce('Collection created. Add tools from Discover.'); document.getElementById('collection-title').focus();
      });
    });
    document.getElementById('studio-export').addEventListener('click', () => attempt(exportBackup));
    document.getElementById('studio-import').addEventListener('change', async event => {
      const input = event.target, file = input.files[0]; if (!file) return;
      try {
        if (file.size > MAX_IMPORT_BYTES) throw new Error('Choose a JSON backup smaller than 1 MB.');
        const added = store.import(await file.text());
        renderCollection(); announce(`Imported ${added} ${added === 1 ? 'collection' : 'collections'}. Existing collections and notes were kept; identical copies were skipped.`);
      } catch (error) { announce(error.message); }
      input.value = '';
    });
    document.getElementById('studio-reset').addEventListener('click', () => {
      if (!window.confirm('Reset all My Studio collections, notes, and comparison choices on this device? Export a backup first if you want to keep them. Learning progress and creator checklists will stay unchanged.')) return;
      store.reset(); selected = ''; renderCollection(); announce('My Studio reset.'); document.getElementById('collection-new-name').focus();
    });
    window.addEventListener('hashchange', () => { selected = decodeURIComponentSafe(location.hash.slice(1)); renderCollection(); });
  } else {
    renderComparison();
    document.getElementById('comparison-clear').addEventListener('click', () => { store.clearCompare(); announce('Comparison cleared.'); });
    document.getElementById('compare-retry').addEventListener('click', loadCatalogue);
  }
  store.subscribe(refresh);
  loadCatalogue();
}
