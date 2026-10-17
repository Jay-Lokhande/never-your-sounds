import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base=process.env.BASE_URL || 'http://127.0.0.1:4173/never-your-sounds/';
const output=process.env.TEST_OUTPUT || 'test-results';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL}: {})});
let checks=0;const errors=[];
function check(value,message) {assert.ok(value,message);checks++;}
async function context(options={}) {
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},...options});
  ctx.on('page',page=>{page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));});return ctx;
}
const sections=['history','styles','scenes','listening','rap','dictionary'];
const content=JSON.parse(await readFile(new URL('../data/hiphop.json',import.meta.url),'utf8'));
const styleCount=content.styles.length;
const writingCount=content.styles.filter(entry=>entry.group==='Writing & delivery').length;
async function visit(page,section) {await page.goto(`${base}hiphop/${section}.html`);}
async function ready(page) {await page.locator('#hiphop-notebook').waitFor({state:'visible'});}
try {
  const ctx=await context(),page=await ctx.newPage();
  await page.goto(`${base}hiphop.html`);
  check(await page.locator('.hh-portal').count()===6,'Hub has six entry cards');
  check(await page.locator('.nav-main a[aria-current]').textContent()==='Hip-Hop Hub','main navigation identifies the Hub');
  await page.screenshot({path:`${output}/hiphop-desktop.png`,fullPage:true});
  for(const section of sections) {
    await visit(page,section);
    check(await page.locator('h1').count()===1,`${section} has one page heading`);
    check(await page.locator('.hh-nav a[aria-current]').count()===1,`${section} has one current subsection`);
  }
  await visit(page,'styles');await page.locator('[data-filter]').waitFor();
  await page.locator('#hh-group').selectOption('Writing & delivery');
  check(await page.locator('[data-entry]:visible').count()===writingCount,'style category works');
  await page.reload();await page.locator('[data-filter]').waitFor();
  check(await page.locator('#hh-group').inputValue()==='Writing & delivery','category survives reload');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  check(await page.locator('[data-entry]:visible').count()===styleCount,'clear restores all styles');
  await page.goBack();await page.waitForFunction(()=>document.querySelector('#hh-group').value==='Writing & delivery');
  check(await page.locator('[data-entry]:visible').count()===writingCount,'back restores category state');
  await page.goto(`${base}hiphop/styles.html?group=Writing%20%26%20delivery#boom-bap`);
  await page.locator('[data-filter]').waitFor();
  check(await page.locator('#boom-bap').isVisible(),'deep link reveals a filtered entry');
  check(!new URL(page.url()).searchParams.has('group'),'deep-link restoration updates URL');
  check(await page.locator('#boom-bap [data-style-details]').getAttribute('open')!==null,'style anchor opens its details');
  check(await page.locator('#boom-bap h2').evaluate(node=>node===document.activeElement),'style anchor moves keyboard focus to its heading');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.locator('#hh-kind').selectOption('Regional umbrella');
  check(await page.locator('[data-entry]:visible').count()===content.styles.filter(entry=>entry.kind==='Regional umbrella').length,'entry type filter works');
  await page.locator('#hh-group').selectOption('Foundations');
  check(await page.locator('#hh-empty').isVisible(),'family and type filters combine');
  await page.getByRole('button',{name:'Show everything',exact:true}).click();
  check(await page.locator('#hh-kind').inputValue()==='','reset also clears entry type');
  await page.locator('#hh-q').fill('DJ Premier');
  check(await page.locator('#boom-bap').isVisible(),'artist search finds a matching style');
  check(await page.locator('[data-entry]:visible').count()<styleCount,'artist search narrows the directory');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.locator('#hh-q').fill('gfunk');
  check(await page.locator('#g-funk').isVisible(),'alias search works without displaying aliases as genre names');
  await page.locator('#g-funk summary').focus();await page.keyboard.press('Enter');
  check(await page.locator('#g-funk .hh-style-listening').isVisible(),'style details work with the keyboard');
  check((await page.locator('#g-funk .hh-style-listening a').getAttribute('href')).startsWith('https://music.apple.com/'),'listening route uses a verified provider URL');
  await page.locator('#g-funk [data-related-style][href="#melodic"]').click();
  check(await page.locator('#melodic').isVisible(),'related style reveals an entry excluded by search');
  check(await page.locator('#melodic [data-style-details]').getAttribute('open')!==null,'related style opens its learning details');
  check(await page.locator('#hh-q').inputValue()==='','related style clears conflicting search');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.locator('#hh-kind').selectOption('Era');await page.reload();await page.locator('[data-filter]').waitFor();
  check(await page.locator('#hh-kind').inputValue()==='Era','entry type survives reload');
  await page.locator('#hh-kind').selectOption('Technique');await page.goBack();
  await page.waitForFunction(()=>document.querySelector('#hh-kind').value==='Era');
  check(await page.locator('[data-entry]:visible').count()===2,'back navigation restores the previous entry type');
  await page.goto(`${base}hiphop/styles.html?kind=not-a-type&q=none#hyphy`);await page.locator('[data-filter]').waitFor();
  check(await page.locator('#hyphy .hh-style-listening').isVisible(),'direct anchor takes priority over invalid or conflicting filters');
  check(await page.locator('.hh-style-details .hh-sources a').count()>=styleCount,'each style includes sources');
  await page.screenshot({path:`${output}/styles-desktop.png`,fullPage:false});
  await visit(page,'scenes');await page.locator('[data-filter]').waitFor();
  await page.locator('#hh-q').fill('sao paulo');
  check(await page.locator('[data-entry]:visible').count()===1,'accent-insensitive scene search');
  check(await page.locator('#sao-paulo').isVisible(),'São Paulo is the search match');
  await page.locator('#hh-group').selectOption('Asia');
  check(await page.locator('#hh-empty').isVisible(),'combined search and category show useful empty state');
  await page.getByRole('button',{name:'Show everything',exact:true}).click();
  check(await page.locator('[data-entry]:visible').count()===8,'empty-state reset restores scenes');
  check(await page.locator('#hh-q').evaluate(node=>node===document.activeElement),'reset restores search keyboard focus');
  await page.goto(`${base}hiphop/dictionary.html?q=%3Cimg%20src=x%20onerror=alert(1)%3E&group=bogus`);await page.locator('[data-filter]').waitFor();
  check(await page.locator('#hh-q').inputValue()==='<img src=x onerror=alert(1)>','query is preserved as literal text');
  check(await page.locator('.hh-page img').count()===0,'query cannot inject markup');
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();
  await page.locator('#hh-q').fill('pocket');
  check(await page.locator('#pocket').isVisible(),'dictionary search includes the requested term');
  await page.reload();await page.locator('[data-filter]').waitFor();
  check(await page.locator('#hh-q').inputValue()==='pocket','search persists in URL');
  await page.locator('.hh-alphabet a[href="#pocket"]').click();
  check(new URL(page.url()).hash==='#pocket','dictionary provides shareable term anchors');

  await visit(page,'rap');await ready(page);
  check(!await page.locator('#hh-save').isChecked(),'notebook saving is opt-in');
  await page.locator('#hh-draft-title').fill('First verse');
  await page.locator('#hh-draft').fill('One original line\n\nAnother line');
  await page.locator('[data-lesson="pulse"]').check();
  check(await page.evaluate(()=>localStorage.getItem('nys-hiphop-v1'))===null,'temporary edits do not write storage');
  check((await page.locator('#hh-line-count').textContent()).startsWith('2 non-empty lines'),'line count excludes blank lines and does not call them bars');
  const prompt=await page.locator('#hh-writing-prompt').textContent();await page.locator('#hh-prompt-button').click();
  check(await page.locator('#hh-writing-prompt').textContent()!==prompt,'prompt button offers a new exercise');
  check((await page.locator('#hh-draft').inputValue()).includes('original'),'new prompt preserves draft');
  await page.locator('#hh-save').check();await page.reload();await ready(page);
  check(await page.locator('#hh-draft-title').inputValue()==='First verse','title persists after opting in');
  check(await page.locator('[data-lesson="pulse"]').isChecked(),'lesson progress persists');
  check(await page.locator('#hh-progress').getAttribute('value')==='1','progress meter reflects completed lesson');
  await visit(page,'listening');await ready(page);
  await page.locator('#bayaan summary').focus();await page.keyboard.press('Enter');
  check(await page.locator('#note-bayaan').isVisible(),'listening questions open with keyboard');
  await page.locator('#note-bayaan').fill('The voices answer each other. <script> stays as text.');
  await page.locator('#hh-q').fill('Hindi');
  check(await page.locator('#bayaan').isVisible(),'listening search supports language');
  await page.reload();await ready(page);await page.locator('#bayaan summary').click();
  check((await page.locator('#note-bayaan').inputValue()).includes('<script>'),'listening notes persist as plain text');
  const downloadWait=page.waitForEvent('download');await page.locator('#hh-export').click();
  const download=await downloadWait, exported=await readFile(await download.path(),'utf8');
  check(exported.includes('First verse') && exported.includes('The voices answer') && exported.includes('pulse'),'download includes both rap and listening work');
  check((await page.locator('#bayaan .hh-sources a').getAttribute('href')).startsWith('https://azadirecords.com/'),'album link points to release source');
  await page.screenshot({path:`${output}/hiphop-listening.png`,fullPage:true});

  const other=await ctx.newPage();await visit(other,'rap');await ready(other);await other.locator('#hh-draft').fill('Newer work from another tab');
  await page.waitForFunction(()=>document.querySelector('#hh-save').disabled);
  check((await page.locator('#hh-status').textContent()).includes('another tab'),'cross-tab changes pause saving with an explanation');
  check((await page.locator('#note-bayaan').inputValue()).includes('The voices'),'cross-tab event keeps current edits');
  await page.reload();await ready(page);await page.locator('#hh-save').uncheck();
  check(await page.evaluate(()=>localStorage.getItem('nys-hiphop-v1'))===null,'opt-out removes saved notebook');
  await page.locator('#bayaan summary').click();
  check((await page.locator('#note-bayaan').inputValue()).includes('The voices'),'opt-out keeps current page edits');
  await page.evaluate(()=>localStorage.setItem('unrelated-test','keep'));
  page.once('dialog',dialog=>dialog.dismiss());await page.locator('#hh-reset').click();
  check((await page.locator('#note-bayaan').inputValue()).includes('The voices'),'cancel reset keeps edits');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#hh-reset').click();
  check(await page.locator('#note-bayaan').inputValue()==='','confirmed reset clears notes');
  check(await page.evaluate(()=>localStorage.getItem('unrelated-test'))==='keep','reset leaves other feature data intact');
  await other.close();

  const broken=await context();const brokenPage=await broken.newPage();
  await broken.addInitScript(()=>{if(location.protocol.startsWith('http')) localStorage.setItem('nys-hiphop-v1','{corrupt');});
  await visit(brokenPage,'rap');await ready(brokenPage);
  check(await brokenPage.locator('#hh-save').isDisabled(),'corrupt saved data disables overwriting');
  await brokenPage.locator('#hh-draft').fill('A recoverable draft');
  check(await brokenPage.evaluate(()=>localStorage.getItem('nys-hiphop-v1'))==='{corrupt','corrupt saved value is preserved');
  brokenPage.once('dialog',dialog=>dialog.accept());await brokenPage.locator('#hh-reset').click();
  check(!await brokenPage.locator('#hh-save').isDisabled(),'explicit reset recovers notebook saving');
  await broken.close();
  const denied=await context();await denied.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError');}});});
  const deniedPage=await denied.newPage();await visit(deniedPage,'rap');await ready(deniedPage);
  await deniedPage.locator('#hh-draft').fill('Still able to write');
  check((await deniedPage.locator('#hh-status').textContent()).includes('unavailable'),'blocked storage has a visible recovery message');
  const deniedDownload=deniedPage.waitForEvent('download');await deniedPage.locator('#hh-export').click();
  check((await readFile(await (await deniedDownload).path(),'utf8')).includes('Still able to write'),'blocked storage work remains downloadable');
  await denied.close();
  const quota=await context();await quota.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
  const quotaPage=await quota.newPage();await visit(quotaPage,'rap');await ready(quotaPage);await quotaPage.locator('#hh-draft').fill('Keep the new draft');await quotaPage.locator('#hh-save').check();
  check((await quotaPage.locator('#hh-status').textContent()).includes('could not be saved'),'quota failure is never presented as successful saving');
  check(await quotaPage.locator('#hh-draft').inputValue()==='Keep the new draft','quota failure preserves current draft');
  await quota.close();

  for(const width of [320,390,768,1024]) {
    await page.setViewportSize({width,height:900});
    for(const section of ['hub',...sections]) {
      if(section==='hub') await page.goto(`${base}hiphop.html`);else await visit(page,section);
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${section}: no horizontal overflow at ${width}px`);
      if(section==='hub' && width===390) await page.screenshot({path:`${output}/hiphop-mobile.png`,fullPage:true});
    }
  }
  const noJS=await context({javaScriptEnabled:false});const plain=await noJS.newPage();
  for(const [section,count] of [['history',8],['styles',styleCount],['scenes',8],['listening',10],['rap',8],['dictionary',38]]) {
    await visit(plain,section);
    const selector=section==='history'?'.hh-timeline>li':section==='rap'?'.hh-lesson':'[data-entry]';
    check(await plain.locator(selector+':visible').count()===count,`${section} editorial content works without JS`);
  }
  await visit(plain,'styles');await plain.locator('#g-funk summary').click();
  check(await plain.locator('#g-funk .hh-style-listening').isVisible(),'genre details and listening routes work without JavaScript');
  check(await plain.locator('#g-funk [data-related-style]').count()>=2,'related styles remain ordinary links without JavaScript');
  await visit(plain,'listening');await plain.locator('#bayaan summary').click();
  check(await plain.locator('#bayaan details ol').isVisible(),'listening prompts expand without JavaScript');
  check(!await plain.locator('[data-filter]').isVisible(),'nonfunctional filters stay hidden without JS');
  await noJS.close();await ctx.close();
  check(errors.length===0,`no uncaught errors: ${errors.join('; ')}`);
  console.log(`Hip-hop browser checks passed: ${checks}`);
} finally {await browser.close();}
