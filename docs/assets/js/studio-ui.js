import {studioStore as store} from './studio-store.mjs';

export function el(tag, className = '', text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(text, action, className = 'btn btn-ghost') {
  const node = el('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
export function sourceLink(url, text) {
  const node = el('a', 'text-link', text);
  node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer';
  node.setAttribute('aria-label', `${text} (opens in a new tab)`);
  return node;
}
export function announce(message) {
  const status = document.getElementById('studio-status');
  if (status) status.textContent = message;
}
export function attempt(action) {
  try { return action(); } catch (error) { announce(error.message); return null; }
}
export function exportBackup() {
  const blob = new Blob([store.export()], {type:'application/json'}), url = URL.createObjectURL(blob);
  const link = el('a'); link.href = url; link.download = 'never-your-sounds-studio.json'; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  announce('Backup download started. Keep it to restore your collections and notes.');
}
export function resourceActions(item) {
  const actions = el('div', 'studio-resource-actions');
  const save = button('Save', () => openSaveDialog(item, save));
  save.dataset.studioSave = item.url;
  save.setAttribute('aria-label', `Save ${item.name} to a collection`);
  const compare = button('Compare', () => attempt(() => {
    store.toggleCompare(item);
    announce(`${item.name} ${store.snapshot().compare.some(r => r.url === item.url) ? 'added to' : 'removed from'} comparison.`);
  }));
  compare.dataset.studioCompare = item.url;
  compare.setAttribute('aria-label', `Compare ${item.name}`);
  compare.setAttribute('aria-pressed', 'false');
  actions.append(save, compare);
  return actions;
}

let dialog, dialogItem, dialogOpener;
function prepareDialog() {
  if (dialog) return;
  dialog = el('dialog', 'studio-dialog');
  dialog.setAttribute('aria-labelledby', 'save-dialog-title');
  const form = el('form');
  const top = el('div', 'studio-toolbar');
  const title = el('h2', '', 'Save to My Studio'); title.id = 'save-dialog-title';
  top.append(title, button('Close', () => dialog.close()));
  const resource = el('p', 'studio-dialog-resource'); resource.id = 'save-dialog-resource';
  const label = el('label', '', 'Collection'); label.htmlFor = 'save-collection';
  const select = el('select'); select.id = 'save-collection';
  const newField = el('div', 'studio-field'); newField.id = 'save-new-field';
  const newLabel = el('label', '', 'New collection name'); newLabel.htmlFor = 'save-new-name';
  const newName = el('input'); newName.id = 'save-new-name'; newName.maxLength = 80; newName.placeholder = 'e.g. First EP';
  newField.append(newLabel, newName);
  select.addEventListener('change', () => { newField.hidden = select.value !== '__new'; newName.required = !newField.hidden; });
  const help = el('p', 'small muted', 'Saved in this browser on this device. Export a backup from My Studio to keep a portable copy.');
  const error = el('p', 'studio-message'); error.id = 'save-error'; error.setAttribute('role', 'alert');
  const submit = el('button', 'btn btn-primary', 'Save resource'); submit.type = 'submit';
  form.append(top, resource, label, select, newField, help, error, submit);
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = store.save(dialogItem, select.value, select.value === '__new' ? newName.value.trim() : '');
      dialog.close();
      announce(`${dialogItem.name} ${result.existed ? 'is already in' : 'saved to'} ${result.name}. ${store.status().warning ? 'Saving is temporary; export before leaving.' : ''}`);
    } catch (e) { error.textContent = e.message; }
  });
  dialog.addEventListener('close', () => {
    const target = dialogOpener?.isConnected ? dialogOpener : [...document.querySelectorAll('[data-studio-save]')].find(n => n.dataset.studioSave === dialogItem.url);
    target?.focus();
  });
  dialog.append(form); document.body.append(dialog);
}
export function openSaveDialog(item, opener) {
  prepareDialog(); dialogItem = item; dialogOpener = opener;
  document.getElementById('save-dialog-resource').textContent = item.name;
  const select = document.getElementById('save-collection'); select.replaceChildren();
  store.snapshot().collections.forEach(collection => {
    const option = el('option', '', collection.name + (collection.resources.some(r => r.url === item.url) ? ' (already saved)' : ''));
    option.value = collection.id; select.append(option);
  });
  const option = el('option', '', '+ New collection'); option.value = '__new'; select.append(option);
  document.getElementById('save-new-name').value = '';
  document.getElementById('save-error').textContent = '';
  select.dispatchEvent(new Event('change'));
  dialog.showModal();
  (select.value === '__new' ? document.getElementById('save-new-name') : select).focus();
}

export function syncResourceActions() {
  const state = store.snapshot();
  document.querySelectorAll('[data-studio-save]').forEach(node => {
    const saved = state.collections.some(c => c.resources.some(r => r.url === node.dataset.studioSave));
    node.textContent = saved ? 'Saved ✓' : '+ Save';
    node.dataset.saved = String(saved);
  });
  document.querySelectorAll('[data-studio-compare]').forEach(node => {
    const selected = state.compare.some(r => r.url === node.dataset.studioCompare);
    node.setAttribute('aria-pressed', String(selected));
    node.textContent = selected ? 'Comparing ✓' : 'Compare';
  });
}
export function mountStudioUI() {
  const update = () => {
    syncResourceActions();
    const warning = store.status().warning;
    document.querySelectorAll('[data-studio-warning]').forEach(node => {
      node.hidden = !warning; node.textContent = warning;
      let recovery = node.nextElementSibling;
      if (!recovery?.hasAttribute('data-studio-recovery')) {
        recovery = button('Export this page’s changes ↓', () => attempt(exportBackup));
        recovery.setAttribute('data-studio-recovery', ''); node.after(recovery);
      }
      recovery.hidden = !warning;
    });
    const tray = document.getElementById('compare-tray');
    if (tray) {
      const state = store.snapshot();
      tray.hidden = !state.compare.length;
      document.getElementById('compare-count').textContent = `${state.compare.length} / 3 selected`;
      const list = document.getElementById('compare-picks');
      const focusedUrl = list.contains(document.activeElement) ? document.activeElement.dataset.removeCompare : null;
      list.replaceChildren(...state.compare.map(item => {
        const chip = el('li');
        const remove = button(`${item.name} ×`, () => attempt(() => { store.toggleCompare(item); announce(`${item.name} removed from comparison.`); }), 'compare-chip');
        remove.setAttribute('aria-label', `Remove ${item.name} from comparison`); remove.dataset.removeCompare = item.url;
        chip.append(remove); return chip;
      }));
      if (focusedUrl) {
        const target = [...list.querySelectorAll('button')].find(b => b.dataset.removeCompare === focusedUrl) || list.querySelector('button') || document.getElementById('browse-q');
        target?.focus();
      }
    }
  };
  store.subscribe(update); update();
}
