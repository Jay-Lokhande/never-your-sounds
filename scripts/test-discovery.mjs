import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCatalogue, filterResources, safeHttpsUrl } from '../docs/assets/js/browse.js';
const data = JSON.parse(await readFile(new URL('../data/sound-resources.json', import.meta.url)));
const { items, rejected } = normalizeCatalogue(data);
test('the full catalogue survives normalization with recorded reviews preserved', () => {
  assert.equal(items.length, data.length); assert.equal(rejected, 0);
  assert.equal(items.filter(i => i.reviewed).length, 5);
  assert.ok(items.every(i => i.description));
});
test('search covers aliases, real descriptions, tags and platforms', () => {
  assert.ok(filterResources(items, { q: 'audacity windows' }).some(i => i.name === 'Audacity'));
  assert.ok(filterResources(items, { q: 'open source linux' }).some(i => i.name === 'LMMS'));
  assert.ok(filterResources(items, { q: 'browser' }).every(i => i.searchText.includes('browser')));
  assert.equal(filterResources(items, { q: 'no-such-resource-zzzz' }).length, 0);
});
test('filters compose and sorting does not mutate the catalogue', () => {
  const original = items.map(i => i.name);
  const results = filterResources(items, { category: 'daw', cost: 'free', platform: 'linux' });
  assert.ok(results.length > 0);
  assert.ok(results.every(i => i.category === 'daw' && i.cost === 'free' && i.platform.includes('linux')));
  const reverse = filterResources(items, { sort: 'name-desc' });
  assert.deepEqual(reverse.map(i => i.name), [...filterResources(items)].reverse().map(i => i.name));
  assert.deepEqual(items.map(i => i.name), original);
  assert.equal(filterResources(items, { sort: 'free-first' })[0].cost, 'free');
  assert.ok(filterResources(items, { sort: 'reviewed' })[0].reviewed);
});
test('unsafe URLs and malformed rows are excluded without losing valid records', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'https://example.com/" onerror="x', 'https://example.com\\evil']) assert.equal(safeHttpsUrl(url), '');
  assert.equal(safeHttpsUrl('https://example.com/path'), 'https://example.com/path');
  assert.throws(() => normalizeCatalogue({}), TypeError);
  const normalized = normalizeCatalogue([null, [], {}, { ...data[0], url: 'javascript:x' }, data[0], data[0]]);
  assert.equal(normalized.items.length, 1); assert.equal(normalized.rejected, 5);
  assert.equal(normalizeCatalogue([{...data[0], reviewed: '2026-02-30'}]).items[0].reviewed, '');
  assert.equal(normalizeCatalogue([{...data[0], cost: null, tags: 'wrong', platform: null}]).items[0].cost, 'unknown');
});
