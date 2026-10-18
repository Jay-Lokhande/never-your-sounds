import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BASE_URL || 'http://127.0.0.1:4173/never-your-sounds/';
const output=process.env.TEST_OUTPUT || 'test-results';
await mkdir(output,{recursive:true});
const data=JSON.parse(await readFile(new URL('../data/hiphop.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
let checks=0;const errors=[];
function check(value,message){assert.ok(value,message);checks++;}
async function context(options={}){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options});
  ctx.on('page',page=>{page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));});return ctx;
}
const route=`${base}hiphop/breakdowns.html`;
async function ready(page){await page.locator('#hiphop-notebook').waitFor();}
async function downloadText(page){const waiting=page.waitForEvent('download');await page.locator('#hh-export').click();return readFile(await (await waiting).path(),'utf8');}
try{
  const ctx=await context(),page=await ctx.newPage();
  await page.goto(route);await ready(page);
  check(await page.locator('[data-entry]').count()===6,'six song guides rendered');
  check(await page.locator('.hh-song-jumps a').count()===6,'six ordinary jump links');
  check(await page.locator('.hh-nav [aria-current]').textContent()==='Song breakdowns','navigation identifies song section');
  check(!await page.locator('#hh-save').isChecked(),'song notes are opt-in');
  await page.locator('#hh-group').selectOption('Eminem');
  check(await page.locator('[data-entry]:visible').count()===2,'artist filter returns both Eminem songs');
  await page.locator('#hh-kind').selectOption('Storytelling');
  check(await page.locator('[data-entry]:visible').count()===1 && await page.locator('#stan').isVisible(),'artist and focus combine');
  await page.reload();await ready(page);
  check(await page.locator('#hh-kind').inputValue()==='Storytelling','learning focus survives reload');
  await page.locator('#hh-kind').selectOption('Flow & delivery');
  check(await page.locator('#hh-empty').isVisible(),'empty combined selection explained');
  await page.goBack();await page.waitForFunction(()=>document.querySelector('#hh-kind').value==='Storytelling');
  check(await page.locator('#stan').isVisible(),'browser back restores song filters');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.locator('#hh-q').fill('tupac');
  check(await page.locator('[data-entry]:visible').count()===2,'Tupac search finds both 2Pac entries');
  await page.locator('#hh-q').fill('beat switch');
  check(await page.locator('#dna').isVisible(),'technique alias search finds DNA');
  await page.goto(route+'?group=Eminem&kind=Storytelling#dna');await ready(page);
  check(await page.locator('#dna [data-song-details]').getAttribute('open')!==null,'direct link reveals and expands filtered song');
  check(!new URL(page.url()).search,'conflicting URL filters cleared');
  check(await page.locator('#dna h2').evaluate(node=>node===document.activeElement),'direct link restores heading focus');
  await page.locator('#dna > details > summary').click();
  await page.locator('#dna h2 a').click();
  check(await page.locator('#dna [data-song-details]').getAttribute('open')!==null,'current song anchor reopens a manually closed guide');
  await page.locator('#dna .hh-song-lens summary').first().focus();await page.keyboard.press('Enter');
  check(await page.locator('#dna .hh-song-lens p').first().isVisible(),'analysis opens with keyboard');
  for(const song of data.songs){
    check(await page.locator(`#${song.id} .hh-song-map li`).count()>=4,`${song.title} has section landmarks`);
    check(await page.locator(`#${song.id} .hh-craft-diagram li`).count()>=3,`${song.title} has a teaching diagram`);
    const listen=page.locator(`#${song.id} .hh-recording-link a`);
    check(await listen.getAttribute('href')===data.sources[song.recording].url && await listen.getAttribute('target')==='_blank',`${song.title} uses its named recording source`);
  }
  await page.locator('#hh-q').fill('beat switch');
  await page.locator('#dna [data-related-song][href="#lose-yourself"]').click();
  check(await page.locator('#lose-yourself [data-song-details]').getAttribute('open')!==null,'related link expands song excluded by search');
  check(await page.locator('#hh-q').inputValue()==='','related link clears conflicting query');
  await page.locator('#note-lose-yourself').fill('Temporary song observation');
  check(await page.evaluate(()=>localStorage.getItem('nys-hiphop-v1'))===null,'temporary song notes never write storage');
  check((await downloadText(page)).includes('Temporary song observation'),'temporary song notes can be downloaded');

  const legacy={version:1,completed:['story'],draft:{title:'Existing draft',text:'Original verse stays'},notes:{bayaan:'Existing album note'}};
  await page.evaluate(state=>localStorage.setItem('nys-hiphop-v1',JSON.stringify(state)),legacy);
  await page.goto(route+'#stan');await page.reload();await ready(page);
  check(await page.locator('#hh-save').isChecked(),'existing notebook loads with saving preference');
  await page.locator('#note-stan').fill('A new perspective. <script> stays plain.');
  await page.goto(`${base}hiphop/listening.html#bayaan`);await ready(page);
  await page.locator('#bayaan summary').click();
  check(await page.locator('#note-bayaan').inputValue()==='Existing album note','existing album note preserved');
  await page.locator('#note-bayaan').fill('Updated album note');
  await page.goto(`${base}hiphop/rap.html`);await ready(page);
  check(await page.locator('#hh-draft').inputValue()==='Original verse stays','existing rap draft preserved');
  check(await page.locator('[data-lesson="story"]').isChecked(),'existing progress preserved');
  await page.locator('#hh-draft').fill('Updated verse');
  await page.goto(route+'#stan');await ready(page);
  check((await page.locator('#note-stan').inputValue()).includes('<script>'),'song note survives writes from album and rap pages');
  const exported=await downloadText(page);
  check(exported.includes('Updated verse') && exported.includes('Updated album note') && exported.includes('A new perspective'),'export includes all notebook work');
  await page.locator('#hh-q').fill('UNIQUEPRIVATEWORD');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.locator('#note-stan').fill('UNIQUEPRIVATEWORD');
  await page.locator('#hh-q').fill('UNIQUEPRIVATEWORD');
  check(await page.locator('#hh-empty').isVisible(),'private note text does not become editorial search content');
  await page.getByRole('button',{name:'Show everything',exact:true}).click();
  await page.locator('#hh-save').uncheck();
  check(await page.evaluate(()=>localStorage.getItem('nys-hiphop-v1'))===null,'opt-out removes saved song notebook');
  check(await page.locator('#note-stan').inputValue()==='UNIQUEPRIVATEWORD','opt-out retains current-page song edits');
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#hh-reset').click();
  check(await page.locator('#note-stan').inputValue()==='UNIQUEPRIVATEWORD','cancelled reset preserves song notes');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#hh-reset').click();
  check(await page.locator('#note-stan').inputValue()==='','confirmed reset clears song notes');
  await page.goto(`${base}hiphop/styles.html#conscious`);
  check(await page.locator('#conscious .hh-related-songs a[href$="breakdowns.html#dear-mama"]').count()===1,'style links back to a related song');
  await page.goto(`${base}hiphop/rap.html#story`);
  check(await page.locator('#story .hh-related-songs a[href$="breakdowns.html#stan"]').count()===1,'rap lesson links back to a related song');

  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:950});
    await page.goto(route+'#lose-yourself');await ready(page);
    await page.locator('.hh-song-lens').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`expanded guide and diagrams fit ${width}px`);
  }
  const plainContext=await context({javaScriptEnabled:false}),plain=await plainContext.newPage();
  await plain.goto(route);await plain.locator('#stan > details > summary').click();
  check(await plain.locator('#stan .hh-song-map').isVisible(),'song map works without JavaScript');
  await plain.locator('#stan .hh-song-lens summary').first().click();
  check(await plain.locator('#stan .hh-song-lens p').first().isVisible(),'analysis works without JavaScript');
  check(!await plain.locator('#hh-q').isVisible() && !await plain.locator('#note-stan').isVisible(),'inactive search and notebook controls stay hidden without JS');
  await plainContext.close();
  const denied=await context();await denied.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}));
  const recovery=await denied.newPage();await recovery.goto(route+'#changes');await ready(recovery);
  await recovery.locator('#note-changes').fill('Recover this song note');
  check((await recovery.locator('#hh-status').textContent()).includes('unavailable'),'storage failure has a visible explanation');
  check((await downloadText(recovery)).includes('Recover this song note'),'song work remains downloadable when storage is blocked');
  await denied.close();await ctx.close();
  check(errors.length===0,`no uncaught song-page errors: ${errors.join('; ')}`);
  console.log(`Song breakdown browser checks passed: ${checks}`);
}finally{await browser.close();}
