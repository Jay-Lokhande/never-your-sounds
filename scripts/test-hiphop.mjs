import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {NOTEBOOK_KEY,LESSON_IDS,ALBUM_IDS,emptyNotebook,parseNotebook,notebookText,nonEmptyLines,matchesEntry,readFilter} from '../docs/assets/js/hiphop-core.js';
const data=JSON.parse(readFileSync(new URL('../data/hiphop.json',import.meta.url),'utf8'));
test('hip-hop content references resolve to real sections, terms, albums, and HTTPS sources',()=>{
  assert.equal(data.version,1);
  for (const [name,minimum] of Object.entries({sections:6,history:8,elements:5,styles:36,scenes:8,albums:10,lessons:8,dictionary:38})) {
    assert.ok(data[name].length>=minimum,name);
    if(name!=='elements') {
      assert.equal(new Set(data[name].map(item=>item.id)).size,data[name].length,name);
      data[name].forEach(item=>assert.match(item.id,/^[a-z0-9]+(?:-[a-z0-9]+)*$/));
    }
    data[name].forEach(item=>assert.ok(item.title.length>0 && item.title.length<150));
  }
  for(const source of Object.values(data.sources)) {const url=new URL(source.url);assert.equal(url.protocol,'https:');assert.equal(url.username,'');assert.equal(url.password,'');assert.ok(source.title);}
  for(const section of data.sections) assert.ok(existsSync(new URL(`../docs/hiphop/${section.id}.html`,import.meta.url)));
  for(const name of ['history','styles','scenes','albums','lessons']) for(const item of data[name]) {
    for(const source of item.sources) assert.ok(data.sources[source],`${item.id}: ${source}`);
    if(name!=='lessons') assert.ok(item.sources.length,`${item.id} needs a source`);
    if(item.album) assert.ok(data.albums.some(album=>album.id===item.album));
    if(item.terms) item.terms.forEach(id=>assert.ok(data.dictionary.some(term=>term.id===id)));
    if(name==='albums') {assert.ok(item.year>=1970 && item.year<=2026);assert.equal(item.questions.length,3);}
  }
  assert.deepEqual(data.lessons.map(item=>item.id),LESSON_IDS);
  assert.deepEqual(data.albums.map(item=>item.id),ALBUM_IDS);
});
test('genre explorer preserves old anchors and supplies grounded listening and connected entries',()=>{
  const ids=new Set(data.styles.map(item=>item.id));
  for(const id of ['boom-bap','jazz-rap','electro','southern','trap','drill','experimental','melodic','conscious','grime']) assert.ok(ids.has(id));
  assert.equal(new Set(data.styles.map(item=>item.group)).size,6);
  const kinds=['Era','Style / subgenre','Regional umbrella','Lyrical approach','Production approach','Technique','Crossover / neighbour'];
  for(const entry of data.styles) {
    assert.ok(kinds.includes(entry.kind),`${entry.id}: entry type`);
    assert.ok(entry.origin.length>15 && entry.origin.length<250,`${entry.id}: roots/context`);
    assert.equal(entry.cues.length,3);
    assert.ok(entry.artists.length>0);
    assert.ok(entry.listening.title && entry.listening.artist && entry.listening.format && entry.listening.prompt);
    assert.ok(data.sources[entry.listening.source],`${entry.id}: listening source`);
    assert.ok(entry.related.length>=2);
    assert.equal(new Set(entry.related).size,entry.related.length);
    for(const id of entry.related) assert.ok(ids.has(id) && id!==entry.id,`${entry.id}: related ${id}`);
    assert.ok(entry.aliases.every(alias=>typeof alias==='string' && alias.length<80));
  }
  assert.equal(data.styles.find(item=>item.id==='grime').kind,'Crossover / neighbour');
  assert.equal(data.styles.find(item=>item.id==='chopped-screwed').kind,'Technique');
});
test('genre family and type combine with text; unknown URL filters cannot hide all entries',()=>{
  assert.ok(matchesEntry('G-funk Warren G bass','Regional traditions','warren bass','Regional traditions','Style / subgenre','Style / subgenre'));
  assert.ok(!matchesEntry('G-funk Warren G bass','Regional traditions','bass','','Style / subgenre','Era'));
  assert.deepEqual(readFilter('?q=bass&group=bogus&kind=bogus',['Regional traditions'],['Era']),{query:'bass',group:'',kind:''});
  assert.deepEqual(readFilter('?kind=Era',['Foundations'],['Era']),{query:'',group:'',kind:'Era'});
});
test('search combines case/accent-insensitive terms and exact category; URL state is bounded',()=>{
  assert.ok(matchesEntry('Emicida, São Paulo, Portuguese','Americas','sao portuguese','Americas'));
  assert.ok(!matchesEntry('Emicida, São Paulo','Americas','sao','Asia'));
  assert.ok(!matchesEntry('São Paulo','Americas','sao delhi',''));
  assert.deepEqual(readFilter('?q=%3Cscript%3E&group=unknown',['Asia']),{query:'<script>',group:''});
  assert.equal(readFilter('?q='+'x'.repeat(300),[]).query.length,120);
});
test('notebook round-trips original text and exports draft, notes and progress',()=>{
  const data=emptyNotebook();data.draft={title:'My <verse>',text:'One line\n\nAnother line'};data.completed=['pulse'];data.notes.bayaan='Notice the voices.';
  assert.deepEqual(parseNotebook(JSON.stringify(data)),data);
  assert.equal(nonEmptyLines(data.draft.text),2);
  const exported=notebookText(data);assert.match(exported,/My <verse>/);assert.match(exported,/Notice the voices/);assert.match(exported,/pulse/);
  assert.equal(NOTEBOOK_KEY,'nys-hiphop-v1');
  const second=emptyNotebook();second.completed.push('rhyme');assert.equal(emptyNotebook().completed.length,0);
});
test('unreadable, future-version, oversized and unknown notebook data is rejected',()=>{
  for(const raw of ['{bad','null','[]','"text"','x'.repeat(100001)]) assert.throws(()=>parseNotebook(raw));
  const valid=emptyNotebook();
  for(const data of [{...valid,version:2},{...valid,completed:['other']},{...valid,completed:['pulse','pulse']},{...valid,notes:{unknown:'text'}},{...valid,notes:{bayaan:'x'.repeat(1501)}},{...valid,draft:{title:'t',text:'x'.repeat(16001)}},{...valid,draft:{title:'x'.repeat(121),text:''}},{...valid,notes:[]},{...valid,completed:null}]) assert.throws(()=>parseNotebook(JSON.stringify(data)));
  const proto=JSON.parse('{"version":1,"completed":[],"draft":{"title":"","text":""},"notes":{"__proto__":"bad"}}');assert.throws(()=>parseNotebook(JSON.stringify(proto)));
});
