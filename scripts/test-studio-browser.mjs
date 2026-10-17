// Browser checks against the rendered Jekyll site; no frontend production dependencies.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir, readFile} from 'node:fs/promises';
const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173/never-your-sounds/';
const output = process.env.TEST_OUTPUT || 'test-results';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
let checks=0; const errors=[];
const check=(value,message)=>{assert.ok(value,message);checks++;};
async function context(options={}) {
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},...options});
  ctx.on('page',page=>{page.setDefaultTimeout(10000);page.on('pageerror',error=>errors.push(error.message));}); return ctx;
}
async function ready(page) { await page.waitForFunction(()=>document.querySelector('#browse-meta')?.textContent==='60 of 60 resources'); }
try {
  const ctx=await context(), page=await ctx.newPage();
  await page.goto(`${base}browse.html`); await ready(page);
  const save=page.getByRole('button',{name:'Save Audacity to a collection',exact:true});
  await save.click(); await page.locator('#save-new-name').fill('First EP'); await page.getByRole('button',{name:'Save resource',exact:true}).click();
  check(await save.textContent()==='Saved ✓','catalogue save shows saved state');
  check(await save.evaluate(n=>document.activeElement===n),'save dialog restores keyboard focus');
  await save.click(); await page.getByRole('button',{name:'Save resource',exact:true}).click();
  check((await page.locator('#studio-status').textContent()).includes('already in'),'duplicate save is explained');
  check(await page.evaluate(()=>JSON.parse(localStorage.getItem('nys-studio-v1')).collections[0].resources.length)===1,'duplicate save does not duplicate resource');
  await save.click(); await page.keyboard.press('Escape'); check(!await page.locator('dialog').isVisible(),'Escape closes save dialog');
  await page.getByRole('button',{name:'Save Reaper to a collection',exact:true}).click();
  await page.locator('#save-collection').selectOption('__new'); await page.locator('#save-new-name').fill('Podcast setup');
  await page.getByRole('button',{name:'Save resource',exact:true}).click();
  for(const name of ['Audacity','Reaper','LMMS']) await page.getByRole('button',{name:`Compare ${name}`,exact:true}).click();
  check(await page.locator('#compare-count').textContent()==='3 / 3 selected','three selections appear in tray');
  await page.getByRole('button',{name:'Compare GarageBand',exact:true}).click();
  check((await page.locator('#studio-status').textContent()).includes('up to 3'),'fourth tool gets useful limit message');
  await page.locator('#browse-q').fill('audacity');
  await page.waitForFunction(()=>document.querySelector('#browse-meta').textContent==='1 of 60 resources');
  check(await page.locator('#compare-picks li').count()===3,'filtering preserves comparison choices');
  await page.locator('#compare-tray a').click(); await page.waitForFunction(()=>document.querySelector('#compare-load-message').hidden);
  check(await page.locator('.comparison-table thead th').count()===4,'comparison has three tool columns');
  check((await page.getByRole('row',{name:/Cost model/}).textContent()).includes('Paid'),'comparison includes recorded paid cost');
  check((await page.getByRole('row',{name:/Offline support/}).textContent()).includes('Not recorded'),'offline support is not inferred from OS tags');
  await page.reload(); await page.locator('.comparison-table').waitFor();
  check(await page.locator('.comparison-name').count()===3,'comparison survives reload');
  await page.screenshot({path:`${output}/compare-desktop.png`,fullPage:true});
  await page.getByRole('button',{name:'Remove LMMS from comparison',exact:true}).click();
  check(await page.locator('.comparison-name').count()===2,'comparison remove updates table');

  await page.goto(`${base}studio.html`); await page.locator('#collection-title').waitFor();
  check(await page.locator('#collection-list li').count()===2,'saved collections appear in studio');
  await page.getByText('Edit collection & project notes',{exact:true}).click();
  await page.locator('#collection-name').fill('First EP — demos'); await page.locator('#collection-notes').fill('Record ideas before mixing.');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  check(await page.locator('#collection-title').textContent()==='First EP — demos','collection rename is applied');
  await page.getByText('Add a note',{exact:true}).click(); await page.locator('[data-draft-url]').fill('Use for editing field recordings.');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  check((await page.locator('.studio-resource').textContent()).includes('Use for editing field recordings.'),'resource note is shown');
  await page.reload(); await page.locator('#collection-title').waitFor();
  check((await page.locator('.studio-resource').textContent()).includes('Use for editing field recordings.'),'notes survive reload');
  await page.getByText('Your note · edit',{exact:true}).click(); await page.locator('[data-draft-url]').fill('Unsaved draft');
  await page.getByRole('button',{name:'Compare Audacity',exact:true}).click();
  check(await page.locator('[data-draft-url]').inputValue()==='Unsaved draft','comparison toggle preserves unsaved notes');
  check(await page.getByRole('button',{name:'Compare Audacity',exact:true}).evaluate(n=>document.activeElement===n),'comparison toggle retains focus after studio rerender');
  await page.getByRole('button',{name:'Save note',exact:true}).click();
  await page.locator('#collection-new-name').fill('Sound design'); await page.getByRole('button',{name:/Create collection/}).click();
  check(await page.locator('#collection-title').textContent()==='Sound design','empty collections can be created');
  await page.locator('#collection-list button').first().click();
  await page.screenshot({path:`${output}/studio-desktop.png`,fullPage:true});
  const other=await ctx.newPage(); await other.goto(`${base}studio.html`); await other.locator('#collection-title').waitFor();
  await page.getByText('Edit collection & project notes',{exact:true}).click();
  await page.locator('#collection-notes').fill('An unsaved project note');
  await other.locator('#collection-new-name').fill('Cross-tab collection'); await other.getByRole('button',{name:/Create collection/}).click();
  await page.waitForFunction(()=>document.querySelectorAll('#collection-list li').length===4);
  check(await page.locator('#collection-notes').inputValue()==='An unsaved project note','cross-tab refresh retains dirty project note');
  check(await page.locator('#collection-notes').evaluate(n=>document.activeElement===n),'cross-tab refresh retains textarea focus');
  await page.getByRole('button',{name:'Save changes',exact:true}).click();
  const downloadPromise=page.waitForEvent('download'); await page.locator('#studio-export').click();
  const download=await downloadPromise; const backup=JSON.parse(await readFile(await download.path(),'utf8'));
  check(backup.collections.length===4 && backup.collections[0].notes==='An unsaved project note','download contains actual collections and notes');

  const restoreCtx=await context(), restored=await restoreCtx.newPage(); await restored.goto(`${base}studio.html`);
  await restored.locator('#studio-app').waitFor({state:'visible'});
  const file={name:'studio.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))};
  await restored.locator('#studio-import').setInputFiles(file);
  await restored.waitForFunction(()=>document.querySelectorAll('#collection-list li').length===4);
  check((await restored.locator('#studio-status').textContent()).includes('Imported 4'),'backup imports on a new device context');
  await restored.locator('#studio-import').setInputFiles(file); await restored.waitForFunction(()=>document.querySelector('#studio-status').textContent.includes('Imported 0'));
  check(await restored.locator('#collection-list li').count()===4,'repeat import skips identical collections');
  const before=await restored.evaluate(()=>localStorage.getItem('nys-studio-v1'));
  await restored.locator('#studio-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{bad')});
  await restored.waitForFunction(()=>document.querySelector('#studio-status').textContent.includes('not valid JSON'));
  check(await restored.evaluate(()=>localStorage.getItem('nys-studio-v1'))===before,'malformed file leaves stored backup intact');
  const malicious={version:1,collections:[{id:'unsafe-text',name:'<img src=x onerror=alert(1)>',notes:'<script>alert(1)</script>',resources:[{name:'<svg onload=alert(1)>',url:'https://example.com/unknown',note:'<img src=x onerror=alert(1)>'}]}],compare:[]};
  await restored.locator('#studio-import').setInputFiles({name:'text.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(malicious))});
  await restored.locator('[data-collection-id="unsafe-text"]').click();
  check(await restored.locator('#collection-detail img, #collection-detail svg, #collection-detail script').count()===0,'imported markup renders only as text');
  check((await restored.locator('#collection-detail').textContent()).includes('Not in the current catalogue'),'unknown saved resources remain available with honest status');
  restored.once('dialog',d=>d.dismiss()); await restored.locator('#studio-reset').click();
  check(await restored.locator('#collection-list li').count()===5,'cancel reset preserves data');
  restored.once('dialog',d=>d.accept()); await restored.locator('#studio-reset').click();
  check(await restored.locator('#collection-list li').count()===0,'confirmed reset removes studio data');

  await page.goto(`${base}compare.html`); await page.locator('.comparison-table').waitFor();
  for (const width of [320,390,768,1024]) {
    await page.setViewportSize({width,height:900});
    for(const path of ['studio.html','compare.html','browse.html']) {
      await page.goto(`${base}${path}`); await page.waitForFunction(()=>document.querySelector('.nav-toggle'));
      check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path} has no document overflow at ${width}px`);
      if (width===320 && path==='browse.html') {
        await ready(page); await page.evaluate(()=>scrollTo(0,0));
        const tray=await page.locator('#compare-tray').boundingBox();
        check(tray && tray.y>=0 && tray.y+tray.height<=901,'mobile comparison controls stay visible without scrolling through all resources');
      }
    }
  }
  await page.setViewportSize({width:390,height:844}); await page.goto(`${base}studio.html`); await page.locator('#collection-title').waitFor();
  await page.screenshot({path:`${output}/studio-mobile.png`,fullPage:true});
  await page.goto(`${base}compare.html`); await page.locator('.comparison-table').waitFor();
  await page.screenshot({path:`${output}/compare-mobile.png`,fullPage:true});
  check(await page.locator('.comparison-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),'small-screen comparison scrolls inside its region');

  const offlineCtx=await context(); await offlineCtx.addInitScript(()=>{
    if (location.protocol === 'http:') localStorage.setItem('nys-studio-v1',JSON.stringify({version:1,collections:[],compare:[{name:'Audacity',url:'https://www.audacityteam.org/'}]}));
  });
  const failed=await offlineCtx.newPage(); let reject=true;
  await failed.route('**/sound-resources.json',route=>reject ? route.fulfill({status:503,body:'unavailable'}) : route.continue());
  await failed.goto(`${base}compare.html`); await failed.locator('#compare-retry').waitFor({state:'visible'});
  check(await failed.getByRole('link',{name:'Visit source ↗ (opens in a new tab)',exact:true}).count()===1,'catalogue failure preserves saved source link');
  reject=false; await failed.locator('#compare-retry').click(); await failed.waitForFunction(()=>document.querySelector('#compare-load-message').hidden);
  check((await failed.getByRole('row',{name:/Main use/}).textContent()).includes('recording'),'retry restores actual catalogue details');

  const blockedCtx=await context(); await blockedCtx.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Blocked');}}));
  const blocked=await blockedCtx.newPage(); await blocked.goto(`${base}browse.html`); await ready(blocked);
  check(await blocked.locator('[data-studio-warning]').isVisible(),'blocked storage is explained');
  await blocked.getByRole('button',{name:'Save Audacity to a collection',exact:true}).click(); await blocked.locator('#save-new-name').fill('Temporary');
  await blocked.getByRole('button',{name:'Save resource',exact:true}).click();
  check((await blocked.locator('#studio-status').textContent()).includes('temporary'),'blocked storage save is honestly temporary');
  const recoveryDownload = blocked.waitForEvent('download'); await blocked.locator('[data-studio-recovery]').click();
  const recovered = JSON.parse(await readFile(await (await recoveryDownload).path(),'utf8'));
  check(recovered.collections[0].resources[0].name==='Audacity','temporary catalogue saves can be exported without navigating away');

  const corruptCtx=await context(); await corruptCtx.addInitScript(()=>{ if (location.protocol === 'http:') localStorage.setItem('nys-studio-v1','broken'); });
  const corrupt=await corruptCtx.newPage(); await corrupt.goto(`${base}studio.html`); await corrupt.locator('#studio-app').waitFor({state:'visible'});
  check(await corrupt.locator('[data-studio-warning]').isVisible(),'corrupt saved data gets recovery guidance');
  await corrupt.locator('#collection-new-name').fill('Temporary'); await corrupt.getByRole('button',{name:/Create collection/}).click();
  check(await corrupt.evaluate(()=>localStorage.getItem('nys-studio-v1'))==='broken','corrupt original remains untouched until explicit reset');

  const noJs=await context({javaScriptEnabled:false}), plain=await noJs.newPage();
  for(const path of ['studio.html','compare.html']) {
    await plain.goto(`${base}${path}`); check(await plain.locator('noscript').isVisible(),`${path} has useful no-JavaScript fallback`);
  }
  assert.deepEqual(errors,[]); checks++;
  console.log(`Passed ${checks} My Studio and comparison browser assertions.`);
} finally { await browser.close(); }
