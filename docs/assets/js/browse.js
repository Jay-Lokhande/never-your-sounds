/* Small, dependency-free catalogue. Pure functions are exported for validation. */
export const categoryLabels = Object.freeze({
  daw: 'DAWs & recording', edu: 'Education offers', notation: 'Notation',
  samples: 'Samples & sound effects', plugin: 'Instruments & effects', utility: 'Audio utilities',
  'game-audio': 'Game audio', podcast: 'Podcast & streaming', hardware: 'Hardware',
  distribution: 'Release & distribution', learn: 'Learning & AI audio', community: 'Community',
  video: 'Film & video', live: 'Live & DJ'
});
export const costLabels = Object.freeze({free: 'Free', freemium: 'Freemium', paid: 'Paid', edu: 'Education', varies: 'Varies', unknown: 'Unknown'});
export const platformLabels = Object.freeze({web: 'Browser', win: 'Windows', mac: 'macOS', linux: 'Linux', ios: 'iOS', android: 'Android'});
const categoryMarks = {daw: 'DAW', edu: 'EDU', notation: 'NOTE', samples: 'SFX', plugin: 'FX', utility: 'UTIL', 'game-audio': 'GAME', podcast: 'MIC', hardware: 'I/O', distribution: 'OUT', learn: 'LEARN', community: 'JAM', video: 'FILM', live: 'LIVE'};
const costNotes = {
  free: 'Free access is listed in the catalogue. Check the current offering, restrictions, and any optional charges.',
  freemium: 'A free tier and paid offerings are listed. Check feature limits, upgrade costs, and export restrictions.',
  paid: 'A paid offering is listed. A trial, when offered, does not replace a license.',
  edu: 'Education offers may require eligibility checks. Confirm availability, region, and renewal terms.',
  varies: 'Availability and costs vary. Check the source before choosing a version or service.',
  unknown: 'No cost model is recorded. Check the source for current pricing.'
};
const text = value => typeof value === 'string' ? value.trim() : '';
const fold = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const validReview = value => {
  if (!/^\d{4}-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?$/.test(value)) return false;
  const fullDate = value.length === 7 ? `${value}-01` : value;
  const date = new Date(`${fullDate}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === fullDate;
};

export function safeHttpsUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/.test(value)) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

export function normalizeCatalogue(data) {
  if (!Array.isArray(data)) throw new TypeError('The catalogue must contain an array of resources.');
  const items = [];
  const seen = new Set();
  for (const row of data) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const name = text(row.name);
    const category = text(row.category);
    const url = safeHttpsUrl(row.url);
    if (!name || name.length > 200 || !Object.hasOwn(categoryLabels, category) || !url || seen.has(fold(name))) continue;
    seen.add(fold(name));
    const platform = Array.isArray(row.platform) ? [...new Set(row.platform.filter(p => typeof p === 'string' && Object.hasOwn(platformLabels, p)))] : [];
    const tags = Array.isArray(row.tags) ? [...new Set(row.tags.filter(t => typeof t === 'string' && t.trim()).map(t => t.trim().slice(0, 60)))].slice(0, 30) : [];
    const cost = text(row.cost);
    const item = {
      name, category, url, platform, tags,
      cost: Object.hasOwn(costLabels, cost) ? cost : 'unknown',
      description: text(row.description).slice(0, 1600),
      pricing_notes: text(row.pricing_notes).slice(0, 2400),
      license_notes: text(row.license_notes).slice(0, 2400),
      reviewed: validReview(text(row.reviewed)) ? text(row.reviewed) : '',
      source_url: safeHttpsUrl(row.source_url)
    };
    const aliases = [tags.includes('foss') ? 'free open source open-source software' : '', platform.includes('web') ? 'web browser online' : '', tags.includes('tts') ? 'text to speech' : '', tags.includes('sfx') ? 'sound effects' : ''];
    item.searchText = fold([name, category, categoryLabels[category], item.cost, costLabels[item.cost], ...platform, ...platform.map(p => platformLabels[p]), ...tags, item.description, item.pricing_notes, item.license_notes, ...aliases].join(' '));
    items.push(item);
  }
  return {items, rejected: data.length - items.length};
}

export function filterResources(items, {q = '', category = '', cost = '', platform = '', sort = 'name'} = {}) {
  const words = fold(q).trim().split(/\s+/).filter(Boolean);
  const matches = items.filter(item => (!category || item.category === category) && (!cost || item.cost === cost) && (!platform || item.platform.includes(platform)) && words.every(word => item.searchText.includes(word)));
  const byName = (a, b) => a.name.localeCompare(b.name, 'en', {sensitivity: 'base'});
  const costOrder = {free: 0, freemium: 1, edu: 2, paid: 3, varies: 4, unknown: 5};
  return matches.sort((a, b) => {
    if (sort === 'name-desc') return byName(b, a);
    if (sort === 'category') return categoryLabels[a.category].localeCompare(categoryLabels[b.category]) || byName(a, b);
    if (sort === 'free-first') return costOrder[a.cost] - costOrder[b.cost] || byName(a, b);
    if (sort === 'reviewed') return b.reviewed.localeCompare(a.reviewed) || byName(a, b);
    return byName(a, b);
  });
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function externalLink(url, label, className, accessibleLabel = '') {
  const link = element('a', className, label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', `${accessibleLabel || label} (opens in a new tab)`);
  return link;
}

function detailParagraph(label, body) {
  const p = element('p');
  p.append(element('strong', '', `${label} `), document.createTextNode(body));
  return p;
}

function resourceCard(item) {
  const card = element('li', 'resource-card');
  const top = element('div', 'resource-card-top');
  const mark = element('span', 'resource-mark', categoryMarks[item.category]);
  mark.setAttribute('aria-hidden', 'true');
  const badge = element('span', 'resource-cost', costLabels[item.cost]);
  badge.dataset.cost = item.cost;
  top.append(mark, badge);
  const description = item.description || `Catalogue summary: ${categoryLabels[item.category].toLowerCase()} resource${item.tags.length ? ` tagged ${item.tags.join(', ')}` : ''}. Explore the source for full details.`;
  card.append(top, element('h2', '', item.name), element('p', 'resource-category', categoryLabels[item.category]), element('p', 'resource-description', description));
  const platforms = element('p', 'resource-platforms');
  platforms.append(element('span', '', 'Listed platforms: '), document.createTextNode(item.platform.map(p => platformLabels[p]).join(' / ') || 'Not recorded'));
  card.append(platforms);
  if (item.tags.length) {
    const tags = element('ul', 'resource-tags');
    tags.setAttribute('aria-label', 'Tags');
    item.tags.forEach(tag => tags.append(element('li', '', tag)));
    card.append(tags);
  }
  const link = externalLink(item.url, 'Official site', 'resource-link', `${item.name}: official site`);
  const arrow = element('span', '', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  link.append(arrow);
  card.append(link);
  const details = element('details', 'resource-details');
  const summary = element('summary', '', 'Details & things to check');
  summary.setAttribute('aria-label', `${item.name}: details and things to check`);
  details.append(summary, detailParagraph('Cost & access.', item.pricing_notes || costNotes[item.cost]));
  details.append(detailParagraph('License.', item.license_notes || (item.category === 'samples' ? 'Check the license for each file or pack, including commercial use, attribution, redistribution, and share-alike requirements. Keep a copy with your project.' : 'Read the current license or service terms at the source. A listing or free tier is not permission for every use.')));
  if (item.category === 'hardware') details.append(detailParagraph('Compatibility.', 'Platform tags are broad catalogue labels. Check the exact hardware model, drivers, and operating system version with the manufacturer.'));
  if (item.reviewed) {
    const recorded = item.reviewed.length === 7 ? `${item.reviewed}-01` : item.reviewed;
    const date = new Date(`${recorded}T12:00:00Z`).toLocaleDateString('en', {month: 'long', year: 'numeric', ...(item.reviewed.length === 10 ? {day: 'numeric'} : {}), timeZone: 'UTC'});
    details.append(detailParagraph('Recorded review.', `${date}. This date was supplied by the existing catalogue; its scope is not recorded and it does not certify current prices or terms.`));
  } else {
    details.append(detailParagraph('Review status.', 'No review date recorded. Current terms have not been certified by this directory.'));
  }
  if (item.source_url) details.append(externalLink(item.source_url, 'Source for these notes ↗', 'resource-source'));
  card.append(details);
  return card;
}

function mountCatalogue(root) {
  const $ = id => document.getElementById(id);
  const q = $('browse-q');
  const category = $('browse-category');
  const cost = $('browse-cost');
  const platform = $('browse-platform');
  const sort = $('browse-sort');
  const results = $('browse-results');
  const meta = $('browse-meta');
  const list = $('browse-list');
  const stateBox = $('browse-state');
  const retry = $('browse-retry');
  const emptyReset = $('browse-empty-reset');
  let items = [];
  let ready = false;
  let debounce;
  let request;
  const controls = [category, cost, platform, sort];
  const state = () => ({q: q.value, category: category.value, cost: cost.value, platform: platform.value, sort: sort.value});
  q.value = (new URLSearchParams(window.location.search).get('q') || '').slice(0, 200);

  function showState(title, message, mode) {
    stateBox.hidden = false;
    stateBox.dataset.loading = String(mode === 'loading');
    $('browse-state-title').textContent = title;
    $('browse-state-message').textContent = message;
    retry.hidden = mode !== 'error';
    emptyReset.hidden = mode !== 'empty';
  }

  function syncUrl() {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries({q: q.value.trim(), cat: category.value, cost: cost.value, platform: platform.value, sort: sort.value === 'name' ? '' : sort.value})) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    try { window.history.replaceState(null, '', url); } catch { /* Filtering still works where history is unavailable. */ }
  }

  function restoreUrl(updateQuery = true) {
    const params = new URLSearchParams(window.location.search);
    if (updateQuery) q.value = (params.get('q') || '').slice(0, 200);
    for (const [key, control] of [['cat', category], ['cost', cost], ['platform', platform], ['sort', sort]]) {
      const value = params.get(key) || (key === 'sort' ? 'name' : '');
      control.value = [...control.options].some(option => option.value === value) ? value : (key === 'sort' ? 'name' : '');
    }
  }

  function render(updateUrl = true) {
    if (!ready) return;
    const filtered = filterResources(items, state());
    list.replaceChildren(...filtered.map(resourceCard));
    meta.textContent = `${filtered.length} of ${items.length} resources`;
    if (filtered.length) stateBox.hidden = true;
    else showState('No matches yet', 'Try a broader search, choose another platform, or clear your filters to explore the whole library.', 'empty');
    if (updateUrl) syncUrl();
  }

  function fillSelect(select, labels, field) {
    const current = select.value;
    while (select.options.length > 1) select.remove(1);
    const counts = new Map();
    items.forEach(item => (Array.isArray(item[field]) ? item[field] : [item[field]]).forEach(value => counts.set(value, (counts.get(value) || 0) + 1)));
    [...counts].sort((a, b) => labels[a[0]].localeCompare(labels[b[0]])).forEach(([value, count]) => {
      const option = element('option', '', `${labels[value]} (${count})`);
      option.value = value;
      select.append(option);
    });
    select.value = current;
  }

  async function load() {
    const retryHadFocus = document.activeElement === retry;
    if (request) request.abort();
    request = new AbortController();
    const controller = request;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    ready = false;
    controls.forEach(control => { control.disabled = true; });
    results.setAttribute('aria-busy', 'true');
    meta.textContent = 'Loading the catalogue…';
    list.replaceChildren();
    $('browse-notice').hidden = true;
    showState('Getting the library ready', "Loading resource information from this site's catalogue.", 'loading');
    try {
      const response = await fetch(root.dataset.source, {signal: controller.signal, headers: {Accept: 'application/json'}});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const catalogue = normalizeCatalogue(await response.json());
      if (!catalogue.items.length) throw new Error('No usable resources in catalogue');
      items = catalogue.items;
      fillSelect(category, categoryLabels, 'category');
      fillSelect(cost, costLabels, 'cost');
      fillSelect(platform, platformLabels, 'platform');
      restoreUrl(false);
      if (catalogue.rejected) {
        $('browse-notice').textContent = `${catalogue.rejected} malformed or duplicate ${catalogue.rejected === 1 ? 'entry was' : 'entries were'} omitted. The remaining resources are available below.`;
        $('browse-notice').hidden = false;
      }
      controls.forEach(control => { control.disabled = false; });
      ready = true;
      render(false);
      if (retryHadFocus) q.focus();
    } catch {
      meta.textContent = 'Catalogue unavailable';
      showState('The library could not be loaded', 'The connection may have failed, or the catalogue may be empty or malformed. Try again, or use the catalogue data link below.', 'error');
      if (retryHadFocus) retry.focus();
    } finally {
      window.clearTimeout(timeout);
      results.setAttribute('aria-busy', 'false');
    }
  }

  function reset() {
    window.clearTimeout(debounce);
    q.value = ''; category.value = ''; cost.value = ''; platform.value = ''; sort.value = 'name';
    render();
    q.focus();
  }
  $('browse-form').addEventListener('submit', event => { event.preventDefault(); window.clearTimeout(debounce); render(); });
  q.addEventListener('input', () => { window.clearTimeout(debounce); debounce = window.setTimeout(render, 120); });
  controls.forEach(control => control.addEventListener('change', () => { window.clearTimeout(debounce); render(); }));
  $('browse-reset').addEventListener('click', reset);
  emptyReset.addEventListener('click', reset);
  retry.addEventListener('click', load);
  window.addEventListener('popstate', () => { restoreUrl(); render(false); });
  load();
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('catalogue');
  if (root) mountCatalogue(root);
}
