// Run against a real built site: BASE_URL=http://127.0.0.1:4173/never-your-sounds/ npm run test:browser
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:4173/never-your-sounds/';
const output = process.env.TEST_OUTPUT || 'test-results';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_CHANNEL ? {channel:process.env.BROWSER_CHANNEL} : {})});
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; }
const errors = [];
const contexts = [];
async function context(options = {}) {
  const ctx = await browser.newContext(options); contexts.push(ctx);
  ctx.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return ctx;
}
try {
  const ctx = await context({viewport:{width:1440,height:1000}});
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  await page.goto(base);
  check(await page.locator('h1').count() === 1, 'homepage has one heading');
  await page.screenshot({path:`${output}/home-desktop.png`,fullPage:true});
  await page.locator('#home-q').fill('Audacity');
  await page.locator('#home-q').press('Enter');
  await page.waitForURL('**/browse.html?q=Audacity');
  await page.waitForFunction(() => document.querySelector('#browse-meta').textContent === '1 of 60 resources');
  check(await page.locator('.resource-card h2').textContent() === 'Audacity', 'homepage search reaches actual catalogue');
  await page.locator('.resource-details summary').focus(); await page.keyboard.press('Enter');
  check(await page.locator('.resource-details').getAttribute('open') !== null, 'resource detail opens by keyboard');
  await page.locator('#browse-reset').click();
  check(await page.locator('.resource-card').count() === 60, 'reset restores all records');
  await page.locator('#browse-category').selectOption('daw');
  await page.locator('#browse-cost').selectOption('free');
  await page.locator('#browse-platform').selectOption('linux');
  check((await page.locator('.resource-card h2').allTextContents()).includes('LMMS'), 'compound filters include matching resource');
  check((await page.locator('.resource-card .resource-cost').allTextContents()).every(c=>c==='Free'), 'cost filter is applied');
  check(page.url().includes('cat=daw') && page.url().includes('platform=linux'), 'filters are shareable in the URL');
  const filtered = await page.locator('.resource-card h2').allTextContents();
  await page.reload(); await page.waitForFunction(()=>!document.querySelector('#browse-sort').disabled);
  assert.deepEqual(await page.locator('.resource-card h2').allTextContents(), filtered); checks++;
  await page.locator('#browse-sort').selectOption('name-desc');
  assert.deepEqual(await page.locator('.resource-card h2').allTextContents(), [...filtered].reverse()); checks++;
  await page.locator('#browse-q').fill('zzzz-no-match');
  await page.waitForFunction(()=>document.querySelector('#browse-meta').textContent.startsWith('0 of'));
  check(await page.locator('#browse-empty-reset').isVisible(), 'empty state offers a real reset');
  await page.locator('#browse-empty-reset').click();
  await page.screenshot({path:`${output}/discover-desktop.png`,fullPage:false});

  await page.goto(`${base}learn.html#first-beat`);
  await page.locator('#save-learning').waitFor({state:'visible'});
  check(await page.locator('.journey:visible').getAttribute('id') === 'first-beat', 'deep link selects pathway');
  await page.locator('#save-learning').check();
  await page.locator('#first-beat [data-step-check]').first().check();
  check((await page.locator('#first-beat [data-next-text]').textContent()).startsWith('Step 2:'), 'learning next action advances');
  await page.reload(); await page.locator('#save-learning').waitFor({state:'visible'});
  check(await page.locator('#first-beat [data-step-check]').first().isChecked(), 'opted-in progress survives reload');
  await page.locator('[data-journey-link="artist"]').click();
  await page.locator('#artist [data-step-check]').first().check();
  await page.locator('#artist [data-reset-journey]').click();
  await page.locator('[data-journey-link="first-beat"]').click();
  check(await page.locator('#first-beat [data-step-check]').first().isChecked(), 'pathway reset preserves other paths');
  await page.locator('#reset-all-learning').click();
  check(!await page.locator('#first-beat [data-step-check]').first().isChecked(), 'reset all clears all progress');
  await page.locator('#first-beat [data-step-check]').first().check();
  await page.locator('#save-learning').uncheck();
  await page.reload(); await page.locator('#save-learning').waitFor({state:'visible'});
  check(!await page.locator('#first-beat [data-step-check]').first().isChecked(), 'opting out removes persisted progress');
  await page.screenshot({path:`${output}/learn-desktop.png`,fullPage:false});

  // Instrument the real browser Web Audio implementation; no audio API mocks.
  await page.addInitScript(() => {
    window.audioAudit = {contexts:[],clicks:[]};
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) { super(...args); window.audioAudit.contexts.push(this); }
      createOscillator() {
        const node=super.createOscillator(), start=node.start.bind(node);
        node.start=time=>{window.audioAudit.clicks.push({time,frequency:node.frequency.value}); return start(time);};
        return node;
      }
    };
  });
  await page.goto(`${base}create.html`);
  await page.waitForFunction(()=>document.querySelector('#beat-lights').children.length === 4);
  check(await page.evaluate(()=>audioAudit.contexts.length === 0), 'audio is not started on page load');
  await page.locator('#tap-button').click(); await page.waitForTimeout(500);
  await page.locator('#tap-button').click(); await page.waitForTimeout(500);
  await page.locator('#tap-button').click();
  const measuredTempo = Number(await page.locator('#tap-bpm').textContent());
  check(measuredTempo > 90 && measuredTempo < 130, 'tap tempo measures actual intervals, allowing browser automation overhead');
  await page.locator('#tap-use').click();
  check(Number(await page.locator('#metro-bpm').inputValue())===Math.round(measuredTempo), 'tap tempo transfers to metronome');
  await page.reload(); await page.waitForFunction(()=>document.querySelector('#beat-lights').children.length === 4);
  // A fresh page gives the audio audit its own context lifecycle.
  await page.close();
  const studio = await ctx.newPage(); studio.setDefaultTimeout(10000);
  await studio.addInitScript(() => {
    window.audioAudit={contexts:[],clicks:[]}; const Native=window.AudioContext;
    window.AudioContext=class extends Native {
      constructor(...args){super(...args);audioAudit.contexts.push(this);}
      createOscillator(){const n=super.createOscillator(),s=n.start.bind(n),set=n.frequency.setValueAtTime.bind(n.frequency);let frequency;n.frequency.setValueAtTime=(value,time)=>{frequency=value;return set(value,time);};n.start=t=>{audioAudit.clicks.push({time:t,frequency});return s(t);};return n;}
    };
  });
  await studio.goto(`${base}create.html`);
  await studio.locator('#metro-meter').selectOption('6/8');
  await studio.locator('#metro-toggle').click();
  await studio.waitForFunction(()=>window.audioAudit.clicks.length>=3);
  check(await studio.locator('#metro-toggle').getAttribute('aria-pressed') === 'true', 'metronome starts from a gesture');
  const clicks=await studio.evaluate(()=>audioAudit.clicks.slice(0,3));
  check(Math.abs(clicks[1].time-clicks[0].time-.25)<.001, 'real audio events use eighth-note spacing in 6/8 at 120 BPM');
  check(clicks[0].frequency===1200 && clicks[1].frequency===800, 'first beat is accented');
  await studio.locator('#metro-toggle').click();
  await studio.waitForFunction(()=>audioAudit.contexts.every(c=>c.state==='closed'));
  check(await studio.locator('#metro-toggle').getAttribute('aria-pressed') === 'false', 'stop closes the audio context');
  await studio.locator('#metro-toggle').click();
  await studio.waitForFunction(()=>document.querySelector('#metro-toggle').getAttribute('aria-pressed')==='true');
  await studio.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  check(await studio.locator('#metro-toggle').getAttribute('aria-pressed') === 'false', 'hidden-page event stops playback');
  await studio.evaluate(()=>delete document.hidden);
  await studio.locator('#metro-bpm').fill('0'); await studio.locator('#metro-toggle').click();
  check((await studio.locator('#metro-status').textContent()).includes('20'), 'invalid tempo gets a useful error');
  await studio.locator('#time-meter').selectOption('6/8'); await studio.locator('#time-bars').fill('8');
  check(await studio.locator('#time-result').textContent() === '12 seconds', 'calculator handles compound meter');
  await studio.locator('#time-direction').selectOption('seconds'); await studio.locator('#time-seconds').fill('12');
  check(await studio.locator('#time-result').textContent() === '8 bars + 0 beats', 'seconds convert back into bars');
  await studio.locator('#time-bpm').fill('');
  check(await studio.locator('#time-result').textContent() === 'Check your values', 'empty input does not become zero');
  await studio.locator('#scale-root').selectOption('F#');
  check((await studio.locator('#scale-notes li').allTextContents()).includes('E♯'), 'scale spelling respects key degrees');
  await studio.locator('#license-project').fill('Test single');
  await studio.locator('#licensing [data-check]').first().check();
  await studio.reload();
  check(await studio.locator('#licensing [data-check]').first().isChecked(), 'checklist progress persists');
  check(await studio.locator('#license-project').inputValue()==='Test single', 'checklist project name persists');
  await studio.locator('#licensing [data-reset]').click(); await studio.locator('#licensing [data-reset]').click();
  check(!await studio.locator('#licensing [data-check]').first().isChecked(), 'checklist reset works');
  await studio.evaluate(()=>{window.print=()=>{window.printRequested=true;};});
  await studio.locator('#print-checklists').click();
  check(await studio.evaluate(()=>window.printRequested===true), 'print action invokes browser print');
  await studio.emulateMedia({media:'print'});
  check(await studio.locator('#licensing').isVisible() && !await studio.locator('#tempo').isVisible(), 'print layout isolates useful checklists');
  await studio.emulateMedia({media:'screen'});
  await studio.screenshot({path:`${output}/create-desktop.png`,fullPage:false});

  // Load failures, malformed data and injection attempts are exercised through fetch.
  for (const body of ['{}','[]','{broken']) {
    const failure = await ctx.newPage();
    await failure.route('**/site/data/sound-resources.json',route=>route.fulfill({contentType:'application/json',body}));
    await failure.goto(`${base}browse.html`); await failure.locator('#browse-retry').waitFor({state:'visible'});
    check(await failure.locator('#browse-meta').textContent()==='Catalogue unavailable', 'malformed/empty data gives recoverable state');
    await failure.unroute('**/site/data/sound-resources.json'); await failure.locator('#browse-retry').click();
    await failure.waitForFunction(()=>document.querySelectorAll('.resource-card').length===60);
    check(await failure.locator('#browse-q').evaluate(el=>el===document.activeElement), 'retry restores usable results and focus');
    await failure.close();
  }
  const malicious=await ctx.newPage();
  await malicious.route('**/site/data/sound-resources.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{name:'<img src=x onerror=alert(1)>',url:'https://example.com',category:'daw'},{name:'Bad',url:'javascript:alert(1)',category:'daw'}])}));
  await malicious.goto(`${base}browse.html`);await malicious.waitForFunction(()=>document.querySelectorAll('.resource-card').length===1);
  check(await malicious.locator('.resource-card img').count()===0, 'untrusted text cannot inject HTML');
  check(await malicious.locator('#browse-notice').isVisible(), 'invalid record is omitted with a notice');
  const offline=await ctx.newPage();
  await offline.route('**/site/data/sound-resources.json',r=>r.fulfill({status:503,body:'Unavailable'}));
  await offline.goto(`${base}browse.html`);await offline.locator('#browse-retry').waitFor({state:'visible'});
  check(await offline.locator('#browse-meta').textContent()==='Catalogue unavailable','HTTP failure produces an actionable retry');

  const blocked=await context();
  await blocked.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});
  const b=await blocked.newPage();await b.goto(`${base}learn.html`);await b.locator('#learning-preferences').waitFor({state:'visible'});
  await b.locator('.journey:visible [data-step-check]').first().check();
  check((await b.locator('#learning-storage-note').textContent()).includes('unavailable'), 'learning remains usable with blocked storage');
  await b.goto(`${base}create.html`);await b.locator('#licensing [data-check]').first().check();
  check((await b.locator('#checklist-storage').textContent()).includes('unavailable'), 'checklists remain usable with blocked storage');
  const noAudio=await context();await noAudio.addInitScript(()=>{window.AudioContext=undefined;window.webkitAudioContext=undefined;});
  const silent=await noAudio.newPage();await silent.goto(`${base}create.html`);await silent.locator('#metro-toggle').click();
  check((await silent.locator('#metro-status').textContent()).includes('unavailable'),'unsupported audio API is explained');
  const corrupt=await ctx.newPage();await corrupt.goto(`${base}learn.html`);
  await corrupt.evaluate(()=>localStorage.setItem('nys-learning-v1','{bad'));await corrupt.reload();
  check((await corrupt.locator('#learning-status').textContent()).includes('could not be read'), 'corrupt saved progress is explained');

  const mobile=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const m=await mobile.newPage();
  for(const route of ['', 'browse.html', 'create.html', 'learn.html', 'trust.html', 'site/guides/production.html']) {
    await m.goto(base+route);
    if(route==='browse.html') await m.waitForFunction(()=>document.querySelectorAll('.resource-card').length===60);
    check(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1), `no horizontal overflow at mobile width: ${route}`);
    check(await m.locator('main').count()===1, `main landmark: ${route}`);
    if(!route) {await m.screenshot({path:`${output}/home-mobile.png`,fullPage:true});await m.locator('.nav-toggle').click();check(await m.locator('.nav-main').isVisible(),'mobile menu opens');await m.keyboard.press('Escape');check(!await m.locator('.nav-main').isVisible(),'Escape closes menu');}
    if(route==='create.html') await m.screenshot({path:`${output}/create-mobile.png`,fullPage:false});
  }
  for (const width of [320,768,1024]) {
    await m.setViewportSize({width,height:900});
    for(const route of ['', 'browse.html', 'create.html', 'learn.html']) {
      await m.goto(base+route);
      if(route==='browse.html')await m.waitForFunction(()=>document.querySelectorAll('.resource-card').length===60);
      check(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`layout fits at ${width}px: ${route}`);
    }
  }
  const nojs=await context({javaScriptEnabled:false,viewport:{width:390,height:844}});
  const n=await nojs.newPage();await n.goto(`${base}learn.html`);
  check(await n.locator('.journey:visible').count()===8,'all learning guides available without JavaScript');
  check(await n.locator('.nav-main').isVisible(),'navigation available without JavaScript');
  await n.goto(`${base}browse.html`);check(await n.locator('.catalogue-noscript').isVisible(),'catalogue has no-JS fallback');
  check(errors.length===0, `no uncaught JS errors: ${errors.join('; ')}`);
  console.log(`Browser checks passed: ${checks} assertions; desktop/mobile, controls, Web Audio scheduling, storage, errors and no-JS.`);
} finally { await browser.close(); }
