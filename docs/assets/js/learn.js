/* Progressive enhancement: pathways and guide links are rendered by Jekyll. */
(() => {
  'use strict';
  const root = document.querySelector('.learn-page');
  if (!root) return;
  const journeys = Array.from(root.querySelectorAll('[data-journey]'));
  if (!journeys.length) return;
  const links = Array.from(root.querySelectorAll('[data-journey-link]'));
  const saveToggle = root.querySelector('#save-learning');
  const storageNote = root.querySelector('#learning-storage-note');
  const status = root.querySelector('#learning-status');
  const storageKey = 'nys-learning-v1';
  const completed = new Set();
  const validKeys = new Set();
  let remember = false;
  let storageAvailable = true;
  let selected = journeys[0];
  const keyFor = (journey, step) => `${journey.dataset.journey}:${step.dataset.step}`;
  journeys.forEach(journey => {
    journey.querySelectorAll('[data-step]').forEach(step => validKeys.add(keyFor(journey, step)));
  });
  const announce = message => { status.textContent = message; };
  const updateStorageNote = () => {
    saveToggle.checked = remember;
    saveToggle.disabled = !storageAvailable;
    storageNote.textContent = !storageAvailable
      ? 'Browser storage is unavailable. Your progress works in this tab but may not survive a reload.'
      : remember
        ? 'Saved only in this browser. Turn this off to remove saved pathway progress; this tab keeps your current checks.'
        : 'Progress stays in this tab until you opt in. No account or cloud sync.';
  };
  const persist = () => {
    if (!storageAvailable) return;
    try {
      if (remember) localStorage.setItem(storageKey, JSON.stringify({ version: 1, completed: [...completed] }));
      else localStorage.removeItem(storageKey);
    } catch (_) {
      storageAvailable = false;
      remember = false;
      updateStorageNote();
      announce('Progress is available in this tab. This browser could not update saved progress.');
    }
  };
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      try {
        const saved = JSON.parse(raw);
        if (!saved || saved.version !== 1 || !Array.isArray(saved.completed) || saved.completed.some(key => typeof key !== 'string')) {
          throw new Error('Invalid saved progress');
        }
        saved.completed.filter(key => validKeys.has(key)).forEach(key => completed.add(key));
        remember = true;
      } catch (_) {
        localStorage.removeItem(storageKey);
        announce('Saved pathway progress could not be read. You can start fresh and choose to save again.');
      }
    }
  } catch (_) {
    storageAvailable = false;
  }
  const render = journey => {
    const steps = Array.from(journey.querySelectorAll('[data-step]'));
    let count = 0;
    let next = null;
    steps.forEach(step => {
      const done = completed.has(keyFor(journey, step));
      if (done) count += 1;
      else if (!next) next = step;
      step.classList.toggle('is-complete', done);
      step.querySelector('[data-step-check]').checked = done;
      step.classList.remove('is-next');
    });
    if (next) next.classList.add('is-next');
    const percent = Math.round(count / steps.length * 100);
    journey.querySelector('progress').value = count;
    journey.querySelector('[data-progress-text]').textContent = `${count} of ${steps.length} steps complete`;
    journey.querySelector('[data-progress-percent]').textContent = `${percent}%`;
    const summary = links.find(link => link.dataset.journeyLink === journey.dataset.journey)?.querySelector('[data-path-summary]');
    if (summary) summary.textContent = count === steps.length ? 'Pathway complete' : `${count} / ${steps.length} steps complete`;
    const nextLink = journey.querySelector('[data-next-link]');
    nextLink.hidden = !next;
    if (next) {
      const heading = next.querySelector('h3').textContent;
      journey.querySelector('[data-next-text]').textContent = `Step ${Number(next.dataset.step) + 1}: ${heading}`;
      nextLink.href = next.querySelector('[data-step-guide]').href;
      nextLink.setAttribute('aria-label', `Open guide for ${heading}`);
    } else {
      journey.querySelector('[data-next-text]').textContent = 'Every step checked. Revisit a guide, apply these habits to your next project, or choose another pathway.';
    }
  };
  const selectJourney = (id, focus = false) => {
    selected = journeys.find(journey => journey.dataset.journey === id) || journeys[0];
    journeys.forEach(journey => { journey.hidden = journey !== selected; });
    links.forEach(link => {
      if (link.dataset.journeyLink === selected.dataset.journey) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
    if (focus) selected.querySelector('h2').focus({ preventScroll: true });
  };
  const hashId = () => {
    try { return decodeURIComponent(location.hash.slice(1)); }
    catch (_) { return ''; }
  };
  links.forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    const id = link.dataset.journeyLink;
    if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
    selectJourney(id, true);
    if (matchMedia('(max-width: 680px)').matches) selected.scrollIntoView({ block: 'start' });
  }));
  addEventListener('hashchange', () => selectJourney(hashId()));
  addEventListener('popstate', () => selectJourney(hashId()));
  journeys.forEach(journey => {
    journey.querySelectorAll('.step-check, .journey-progress, .journey-next, [data-reset-journey]').forEach(el => { el.hidden = false; });
    journey.querySelectorAll('[data-step-check]').forEach(checkbox => checkbox.addEventListener('change', () => {
      const step = checkbox.closest('[data-step]');
      const key = keyFor(journey, step);
      if (checkbox.checked) completed.add(key);
      else completed.delete(key);
      render(journey);
      announce(`${journey.querySelector('h2').textContent}: ${journey.querySelector('[data-progress-text]').textContent}.`);
      persist();
    }));
    journey.querySelector('[data-reset-journey]').addEventListener('click', () => {
      journey.querySelectorAll('[data-step]').forEach(step => completed.delete(keyFor(journey, step)));
      render(journey);
      announce(`Progress reset for ${journey.querySelector('h2').textContent}. Other pathways are unchanged.`);
      persist();
    });
    render(journey);
  });
  root.querySelector('#reset-all-learning').addEventListener('click', () => {
    completed.clear();
    journeys.forEach(render);
    announce('Progress reset for all pathways. Your save preference is unchanged.');
    persist();
  });
  saveToggle.addEventListener('change', () => {
    remember = saveToggle.checked;
    updateStorageNote();
    announce(remember ? 'Pathway progress will be saved in this browser.' : 'Saved pathway progress removed. Current checks remain in this tab.');
    persist();
  });
  root.querySelector('#learning-preferences').hidden = false;
  updateStorageNote();
  selectJourney(hashId());
})();
