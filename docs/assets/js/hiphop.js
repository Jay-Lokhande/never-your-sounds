import {NOTEBOOK_KEY,LESSON_IDS,emptyNotebook,parseNotebook,notebookText,nonEmptyLines,matchesEntry,readFilter} from './hiphop-core.js';

function mountFilters() {
  const form = document.querySelector('[data-filter]');
  if (!form) return;
  const query = form.querySelector('#hh-q'), select = form.querySelector('#hh-group');
  const groups = [...select.options].map(option=>option.value);
  // Cache editorial text before people begin writing their own listening notes.
  const entries = [...document.querySelectorAll('[data-entry]')].map(node=>({node,text:node.textContent,group:node.dataset.group}));
  const indexes = [...document.querySelectorAll('[data-term-index]')];
  const count = document.querySelector('#hh-count'), empty = document.querySelector('#hh-empty');
  function render() {
    let visible = 0;
    for (const entry of entries) {
      entry.node.hidden = !matchesEntry(entry.text,entry.group,query.value,select.value);
      if (!entry.node.hidden) visible++;
    }
    for (const link of indexes) link.hidden = document.getElementById(link.dataset.termIndex).hidden;
    count.textContent = `${visible} of ${entries.length} entries`;
    empty.hidden = visible !== 0;
  }
  function updateURL(push = false) {
    const url = new URL(location.href);
    url.searchParams.delete('q'); url.searchParams.delete('group');
    if (query.value.trim()) url.searchParams.set('q',query.value.trim());
    if (select.value) url.searchParams.set('group',select.value);
    url.hash = '';
    if (url.href !== location.href) history[push ? 'pushState':'replaceState'](null,'',url);
  }
  function reset(push = true) {query.value='';select.value='';render();updateURL(push);}
  function followAnchor() {
    let id; try {id=decodeURIComponent(location.hash.slice(1));} catch {return;}
    const entry=entries.find(item=>item.node.id===id);
    if (entry?.node.hidden) {
      query.value=''; select.value=''; render();
      const url=new URL(location.href);url.searchParams.delete('q');url.searchParams.delete('group');history.replaceState(null,'',url);
      entry.node.scrollIntoView();
    }
  }
  function restore() {
    const state=readFilter(location.search,groups);query.value=state.query;select.value=state.group;render();followAnchor();
  }
  form.hidden=false;restore();
  form.addEventListener('submit',event=>{event.preventDefault();render();updateURL(true);});
  query.addEventListener('input',()=>{render();updateURL();});
  select.addEventListener('change',()=>{render();updateURL(true);});
  form.addEventListener('reset',event=>{event.preventDefault();reset();query.focus();});
  document.querySelector('[data-clear-filter]').addEventListener('click',()=>{reset();query.focus();});
  window.addEventListener('popstate',restore);
  window.addEventListener('hashchange',followAnchor);
}

function mountNotebook() {
  const panel=document.querySelector('#hiphop-notebook');
  if (!panel) return;
  const save=document.querySelector('#hh-save'), status=document.querySelector('#hh-status'), note=document.querySelector('#hh-storage-note');
  const draftTitle=document.querySelector('#hh-draft-title'), draft=document.querySelector('#hh-draft');
  const completions=[...document.querySelectorAll('[data-lesson]')], notes=[...document.querySelectorAll('[data-album-note]')];
  let state=emptyNotebook(), saving=false, fault=false;
  function say(message, warning=false) {status.textContent=message;panel.toggleAttribute('data-warning',warning);}
  function preferences() {
    save.checked=saving;save.disabled=fault;
    note.textContent=saving && !fault ? 'Saved in this browser only. Download a copy to keep outside this device. No account or cloud sync.' : 'Edits last only on this page. Download the notebook before leaving or reloading.';
  }
  function fail(message) {fault=true;preferences();say(message,true);}
  try {
    const raw=localStorage.getItem(NOTEBOOK_KEY);
    if (raw !== null) {state=parseNotebook(raw);saving=true;}
  } catch {
    fail('Saved notebook unavailable or unreadable. Existing storage has not been replaced. Work here temporarily, download your edits, or use Reset notebook to start fresh.');
  }
  function progress() {
    const meter=document.querySelector('#hh-progress');
    if (meter) {meter.value=state.completed.length;document.querySelector('#hh-progress-text').textContent=`${state.completed.length} of ${LESSON_IDS.length} lessons complete`;}
    for (const checkbox of completions) checkbox.closest('.hh-lesson').toggleAttribute('data-complete',checkbox.checked);
    if (draft) document.querySelector('#hh-line-count').textContent=`${nonEmptyLines(draft.value)} non-empty lines · ${draft.value.length.toLocaleString('en')} / 16,000 characters`;
  }
  function render() {
    for (const checkbox of completions) checkbox.checked=state.completed.includes(checkbox.dataset.lesson);
    for (const textarea of notes) textarea.value=state.notes[textarea.dataset.albumNote] || '';
    if (draft) {draft.value=state.draft.text;draftTitle.value=state.draft.title;}
    progress();preferences();
  }
  function persist() {
    progress();
    if (!saving || fault) return;
    try {localStorage.setItem(NOTEBOOK_KEY,JSON.stringify(state));say('Notebook saved on this device.');}
    catch {fail('Your latest edits could not be saved. They remain on this page. Download the notebook before leaving; the last saved copy may be older.');}
  }
  for (const checkbox of completions) checkbox.addEventListener('change',()=>{
    state.completed=LESSON_IDS.filter(id=>id===checkbox.dataset.lesson ? checkbox.checked : state.completed.includes(id));persist();
  });
  for (const textarea of notes) textarea.addEventListener('input',()=>{state.notes[textarea.dataset.albumNote]=textarea.value;persist();});
  if (draft) {
    draft.addEventListener('input',()=>{state.draft.text=draft.value;persist();});
    draftTitle.addEventListener('input',()=>{state.draft.title=draftTitle.value;persist();});
    const prompts=['Tell a small story using a sound, a colour, and an unexpected detail.','Write from the viewpoint of an object you use every day.','Describe a journey without naming the destination until the last line.','Write about a change you noticed in your neighbourhood.','Start with a place you know. Describe one detail only you would notice.'];
    let promptIndex=0;
    document.querySelector('#hh-prompt-button').addEventListener('click',()=>{document.querySelector('#hh-writing-prompt').textContent=prompts[promptIndex++ % prompts.length];});
  }
  save.addEventListener('change',()=>{
    if (save.checked) {saving=true;persist();preferences();}
    else {
      try {localStorage.removeItem(NOTEBOOK_KEY);saving=false;preferences();say('Device copy removed. Your current notebook remains on this page until you leave.');}
      catch {fail('The saved copy could not be removed. Browser settings can clear it. Current edits remain here; download them before leaving.');}
    }
  });
  document.querySelector('#hh-export').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([notebookText(state)],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='never-your-sounds-hiphop-notebook.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    if (!fault) say('Notebook download prepared. Keep the file as your own copy.');
  });
  document.querySelector('#hh-reset').addEventListener('click',()=>{
    if (!confirm('Reset the hip-hop notebook? This clears its verse draft, listening notes, saved copy, and lesson progress. Other tools and My Studio are unchanged. Download a copy first if you need it.')) return;
    try {localStorage.removeItem(NOTEBOOK_KEY);state=emptyNotebook();saving=false;fault=false;render();say('Hip-hop notebook reset. Device saving is off.');}
    catch {fail('Reset could not remove the saved copy. Your current notebook has been kept. Use browser storage settings to remove it.');}
  });
  window.addEventListener('storage',event=>{
    if ((event.key===NOTEBOOK_KEY || event.key===null) && !fault) fail('The saved notebook changed in another tab. Your current edits are kept here and saving is paused. Download them, then reload to read the other copy.');
  });
  render();
  document.querySelectorAll('[data-enhance]').forEach(node=>{node.hidden=false;});
}

mountFilters();
mountNotebook();
