import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioStore, STUDIO_KEY, emptyStudio, validateStudio, parseBackup, mergeBackup, MAX_IMPORT_BYTES} from '../docs/assets/js/studio-store.mjs';
const audacity = {name:'Audacity', url:'https://www.audacityteam.org/'};
const tool = n => ({name:`Tool ${n}`, url:`https://example.com/${n}`});
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {getItem:k=>data.get(k) ?? null, setItem:(k,v)=>data.set(k,v), removeItem:k=>data.delete(k)};
}
function setup() { const disk = storage(); return {disk, store:createStudioStore(()=>disk)}; }

test('collections, per-resource notes and comparison survive a reload', () => {
  const {disk, store} = setup(), id = store.create('First EP');
  store.save(audacity, id); store.note(id, audacity.url, 'Edit the field recordings');
  store.updateCollection(id, 'Debut EP', 'Export stems before mixing'); store.toggleCompare(audacity);
  const reloaded = createStudioStore(()=>disk);
  assert.deepEqual(reloaded.snapshot(), store.snapshot());
  assert.equal(reloaded.snapshot().collections[0].resources[0].note, 'Edit the field recordings');
  assert.equal(reloaded.status().persistent, true);
});
test('saving is idempotent within a collection and independent across collections', () => {
  const {store} = setup(), a = store.create('A'), b = store.create('B');
  store.save(audacity,a); store.note(a,audacity.url,'Keep this');
  assert.equal(store.save(audacity,a).existed,true); store.save(audacity,b);
  assert.equal(store.snapshot().collections[0].resources.length,1);
  assert.equal(store.snapshot().collections[0].resources[0].note,'Keep this');
  store.remove(a,audacity.url);
  assert.equal(store.snapshot().collections[1].resources.length,1);
});
test('comparison caps at three and removing one permits another', () => {
  const {store} = setup(); [1,2,3].forEach(n=>store.toggleCompare(tool(n)));
  assert.throws(()=>store.toggleCompare(tool(4)),/up to 3/);
  assert.equal(store.snapshot().compare.length,3);
  store.toggleCompare(tool(2)); store.toggleCompare(tool(4));
  assert.deepEqual(store.snapshot().compare.map(r=>r.name),['Tool 1','Tool 3','Tool 4']);
});
test('backup roundtrip and merge preserve notes and avoid duplicate imports', () => {
  const {store} = setup(), id=store.create('Project'); store.save(audacity,id); store.toggleCompare(audacity);
  const backup=store.export(); assert.deepEqual(parseBackup(backup),store.snapshot());
  assert.equal(store.import(backup),0);
  const changed=parseBackup(backup); changed.collections[0].notes='A different copy';
  const merged=mergeBackup(store.snapshot(),changed,()=> 'new-id');
  assert.equal(merged.added,1); assert.equal(merged.state.collections[1].id,'new-id');
  assert.equal(merged.state.collections[0].notes,'');
  const fresh=setup().store; fresh.import(backup); assert.deepEqual(fresh.snapshot(),store.snapshot());
  fresh.toggleCompare(audacity); fresh.toggleCompare(tool(2)); fresh.import(backup);
  assert.equal(fresh.snapshot().compare[0].name,'Tool 2');
});
test('malformed, oversized, unsafe and duplicate imports leave existing data intact', () => {
  const {store} = setup(); store.create('Keep me'); const before=store.export();
  const base={version:1,collections:[{id:'a',name:'A',notes:'',resources:[audacity]}],compare:[]};
  const bad=[null,{}, {...base,version:2}, {...base,compare:[audacity,audacity]}, {...base,collections:[base.collections[0],base.collections[0]]}];
  for(const url of ['javascript:alert(1)','http://example.com','https://user:pass@example.com','https://example.com\\evil']) bad.push({...base,compare:[{name:'Unsafe',url}]});
  for (const value of bad) assert.throws(()=>store.import(JSON.stringify(value)));
  assert.throws(()=>store.import('{broken'),/valid JSON/);
  assert.throws(()=>store.import(' '.repeat(MAX_IMPORT_BYTES+1)),/1 MB/);
  assert.equal(store.export(),before);
});
test('text is preserved as text, unknown imported fields are not retained', () => {
  const input={version:1,collections:[{id:'safe',name:'<img onerror=alert(1)>',notes:'<script>x</script>',resources:[{...audacity,note:'<svg onload=x>',html:'bad'}]}],compare:[],untrusted:'discard'};
  const result=validateStudio(input);
  assert.equal(result.collections[0].notes,'<script>x</script>');
  assert.equal(result.untrusted,undefined); assert.equal(result.collections[0].resources[0].html,undefined);
});
test('collection, note and aggregate size limits reject changes atomically', () => {
  const {store}=setup(); const id=store.create('Project'), before=store.export();
  assert.throws(()=>store.updateCollection(id,'','notes'));
  assert.throws(()=>store.updateCollection(id,'Project','x'.repeat(4001)));
  assert.equal(store.export(),before);
  const large={version:1,collections:Array.from({length:30},(_,n)=>({id:`c${n}`,name:`C${n}`,notes:'x'.repeat(4000),resources:Array.from({length:150},(_,r)=>({...tool(r),note:'x'.repeat(2000)}))})),compare:[]};
  assert.throws(()=>validateStudio(large),/1 MB/);
});
test('corrupt storage is not overwritten and explicit reset recovers saving', () => {
  const disk=storage({[STUDIO_KEY]:'broken','nys-learning-v1':'keep'}), store=createStudioStore(()=>disk);
  assert.ok(store.status().warning); store.create('Temporary');
  assert.equal(disk.getItem(STUDIO_KEY),'broken'); assert.equal(store.snapshot().collections.length,1);
  store.reset(); store.create('Recovered');
  assert.equal(store.status().warning,''); assert.equal(disk.getItem('nys-learning-v1'),'keep');
  assert.equal(JSON.parse(disk.getItem(STUDIO_KEY)).collections[0].name,'Recovered');
});
test('quota failures keep current edits exportable without claiming persistence', () => {
  const disk=storage(), store=createStudioStore(()=>disk); store.create('Saved');
  disk.setItem=()=>{throw new Error('Quota');}; store.create('Temporary');
  assert.equal(store.status().persistent,false); assert.match(store.status().warning,/full or blocked/);
  assert.equal(parseBackup(store.export()).collections.length,2);
  assert.equal(JSON.parse(disk.getItem(STUDIO_KEY)).collections.length,1);
});
test('storage denial remains usable and reset reports inability to delete', () => {
  const store=createStudioStore(()=>{throw new Error('Denied');});
  store.create('Temporary'); assert.equal(store.snapshot().collections.length,1);
  store.reset(); assert.deepEqual(store.snapshot(),emptyStudio()); assert.match(store.status().warning,/could not be cleared/);
});
test('sequential edits from separate tabs merge with the latest stored version', () => {
  const disk=storage(), a=createStudioStore(()=>disk), b=createStudioStore(()=>disk);
  a.create('A'); b.create('B'); a.create('C');
  assert.deepEqual(a.snapshot().collections.map(c=>c.name),['A','B','C']);
});
