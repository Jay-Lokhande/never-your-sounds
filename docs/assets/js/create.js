import { signature, beatSeconds, durationFromBars, barsFromDuration, tapTempo, scaleNotes, SCALES } from './audio-math.mjs';

const $ = (id) => document.getElementById(id);
const format = (value, digits = 3) => Number(value.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits });
const numeric = (input) => input.value.trim() === '' ? NaN : Number(input.value);

// Tap tempo is a rolling mean. A pause begins a new phrase instead of skewing it.
let taps = [];
let tappedBpm = null;
$('tap-button').addEventListener('keydown', (event) => {
  if (event.repeat && (event.code === 'Space' || event.code === 'Enter')) event.preventDefault();
});
$('tap-button').addEventListener('click', () => {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 4000) taps = [];
  if (taps.length && now - taps[taps.length - 1] < 100) return;
  taps.push(now);
  taps = taps.slice(-9);
  tappedBpm = tapTempo(taps);
  $('tap-bpm').textContent = tappedBpm ? format(tappedBpm, 1) : '—';
  $('tap-use').disabled = !tappedBpm || tappedBpm < 20 || tappedBpm > 300;
  $('tap-status').textContent = !tappedBpm ? 'First beat set. Keep tapping.' : tappedBpm < 20 || tappedBpm > 300 ? 'Outside the metronome range of 20–300 BPM. Reset and tap the quarter-note pulse.' : `${taps.length} taps · ${format(tappedBpm, 1)} BPM. Pause more than 4 seconds to begin again.`;
});
$('tap-reset').addEventListener('click', () => {
  taps = [];
  tappedBpm = null;
  $('tap-bpm').textContent = '—';
  $('tap-use').disabled = true;
  $('tap-status').textContent = 'Tempo cleared. Tap to start again.';
});
$('tap-use').addEventListener('click', () => {
  if (!tappedBpm || tappedBpm < 20 || tappedBpm > 300) return;
  $('metro-bpm').value = Math.round(tappedBpm);
  updateTempo();
  $('metro-status').textContent = `${Math.round(tappedBpm)} BPM copied from tap tempo. ${running ? 'Playing.' : 'Press Start when ready.'}`;
});

// Web Audio schedules clicks against the audio clock, not the UI timer.
// Contexts exist only while playing and are closed on stop, hide, or navigation.
let audioContext = null;
let running = false;
let starting = false;
let generation = 0;
let scheduler = null;
let frame = null;
let nextTime = 0;
let nextBeat = 0;
let visualQueue = [];
const activeNodes = new Set();

function renderBeatLights() {
  const { numerator } = signature($('metro-meter').value);
  $('beat-lights').replaceChildren(...Array.from({ length: numerator }, (_, index) => {
    const light = document.createElement('span');
    light.textContent = index + 1;
    return light;
  }));
}

function stopMetronome(message = 'Stopped. Press Start to play again.') {
  generation += 1;
  running = false;
  starting = false;
  clearInterval(scheduler);
  cancelAnimationFrame(frame);
  scheduler = null;
  frame = null;
  visualQueue = [];
  const previousContext = audioContext;
  audioContext = null;
  if (previousContext) previousContext.onstatechange = null;
  for (const { oscillator, gain } of activeNodes) {
    try { oscillator.stop(); } catch { /* The click may already have ended. */ }
    oscillator.disconnect();
    gain.disconnect();
  }
  activeNodes.clear();
  if (previousContext && previousContext.state !== 'closed') previousContext.close().catch(() => {});
  $('metro-toggle').textContent = 'Start metronome';
  $('metro-toggle').setAttribute('aria-pressed', 'false');
  $('metro-status').textContent = message;
  $('beat-lights').querySelectorAll('span').forEach((light) => light.classList.remove('active', 'accented'));
}

function scheduleClick(time, beat) {
  const context = audioContext;
  const accented = beat === 0 && $('metro-accent').checked;
  visualQueue.push({ time, beat, accented });
  const level = Number($('metro-volume').value) / 100 * (accented ? 0.35 : 0.22);
  if (level === 0) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const nodes = { oscillator, gain };
  activeNodes.add(nodes);
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(accented ? 1200 : 800, time);
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(level, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
  gain.gain.setValueAtTime(0, time + 0.05);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.onended = () => {
    oscillator.disconnect();
    gain.disconnect();
    activeNodes.delete(nodes);
  };
  oscillator.start(time);
  oscillator.stop(time + 0.055);
}

function schedule() {
  if (!running || !audioContext) return;
  try {
    const beatLength = beatSeconds(numeric($('metro-bpm')), $('metro-meter').value);
    const { numerator } = signature($('metro-meter').value);
    // After a long main-thread stall, restart the bar instead of bunching old clicks.
    if (nextTime < audioContext.currentTime - 0.1) {
      nextTime = audioContext.currentTime + 0.03;
      nextBeat = 0;
      visualQueue = [];
    }
    while (nextTime < audioContext.currentTime + 0.1) {
      scheduleClick(nextTime, nextBeat);
      nextTime += beatLength;
      nextBeat = (nextBeat + 1) % numerator;
    }
  } catch (error) {
    stopMetronome(error instanceof RangeError ? error.message : 'Audio playback failed. Stop other audio apps and try Start again.');
  }
}

function drawBeat() {
  if (!running || !audioContext) return;
  let current;
  while (visualQueue.length && visualQueue[0].time <= audioContext.currentTime) current = visualQueue.shift();
  if (current) $('beat-lights').querySelectorAll('span').forEach((light, index) => {
    light.classList.toggle('active', index === current.beat);
    light.classList.toggle('accented', index === current.beat && current.accented);
  });
  frame = requestAnimationFrame(drawBeat);
}

async function startMetronome() {
  try { beatSeconds(numeric($('metro-bpm')), $('metro-meter').value); }
  catch (error) { $('metro-status').textContent = error.message; $('metro-bpm').focus(); return; }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) { $('metro-status').textContent = 'Web Audio is unavailable in this browser. Try a current browser with audio support.'; return; }
  const token = ++generation;
  starting = true;
  $('metro-toggle').textContent = 'Cancel audio start';
  $('metro-status').textContent = 'Starting audio…';
  let context;
  try {
    context = new AudioContext();
    audioContext = context;
    let resumeTimer;
    try {
      await Promise.race([
        context.resume(),
        new Promise((_, reject) => { resumeTimer = setTimeout(() => reject(new Error('Audio startup timed out.')), 5000); })
      ]);
    } finally { clearTimeout(resumeTimer); }
    if (token !== generation || document.hidden) {
      if (context.state !== 'closed') context.close().catch(() => {});
      return;
    }
    if (context.state !== 'running') throw new Error('Audio is suspended.');
    starting = false;
    running = true;
    nextTime = context.currentTime + 0.05;
    nextBeat = 0;
    $('metro-toggle').textContent = 'Stop metronome';
    $('metro-toggle').setAttribute('aria-pressed', 'true');
    $('metro-status').textContent = `Playing at ${$('metro-bpm').value} quarter-note BPM in ${$('metro-meter').value}.`;
    context.onstatechange = () => {
      if (running && context.state !== 'running') stopMetronome('Audio was interrupted. Press Start to resume.');
    };
    schedule();
    if (!running) return;
    scheduler = setInterval(schedule, 25);
    frame = requestAnimationFrame(drawBeat);
  } catch {
    if (token === generation) stopMetronome('Audio could not start. Check browser audio permissions and press Start to try again.');
  }
}

$('metro-toggle').addEventListener('click', () => running || starting ? stopMetronome() : startMetronome());
function updateTempo() {
  const value = numeric($('metro-bpm'));
  try { beatSeconds(value); }
  catch (error) {
    if (running || starting) stopMetronome(error.message);
    else $('metro-status').textContent = error.message;
    return;
  }
  $('metro-range').value = value;
  $('metro-range-value').textContent = `${format(value, 1)} BPM`;
  $('metro-status').textContent = running ? `Playing at ${format(value, 1)} quarter-note BPM in ${$('metro-meter').value}.` : `Ready at ${format(value, 1)} quarter-note BPM.`;
}
$('metro-bpm').addEventListener('input', updateTempo);
$('metro-range').addEventListener('input', () => { $('metro-bpm').value = $('metro-range').value; updateTempo(); });
$('metro-meter').addEventListener('change', () => {
  // A meter change restarts only on a new explicit user gesture.
  if (running || starting) stopMetronome('Time signature changed. Press Start to begin a new bar.');
  renderBeatLights();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (running || starting)) stopMetronome('Paused because the page was hidden. Press Start to resume.');
});
window.addEventListener('pagehide', () => stopMetronome());
renderBeatLights();

function calculateTime() {
  const bpm = numeric($('time-bpm'));
  const meter = $('time-meter').value;
  try {
    const beat = beatSeconds(bpm, meter);
    if ($('time-direction').value === 'bars') {
      const bars = numeric($('time-bars'));
      const beats = numeric($('time-beats'));
      const result = durationFromBars(bars, beats, bpm, meter);
      $('time-result').textContent = `${format(result.seconds)} seconds`;
      $('time-detail').textContent = `${format(result.totalBeats)} denominator-note beats × ${format(beat, 6)} seconds per beat. ${format(result.seconds / 60)} minutes total.`;
    } else {
      const result = barsFromDuration(numeric($('time-seconds')), bpm, meter);
      $('time-result').textContent = `${format(result.bars)} bars + ${format(result.beats)} beats`;
      $('time-detail').textContent = `${format(result.totalBeats)} denominator-note beats at ${format(beat, 6)} seconds per beat. Rounded to 3 decimals.`;
    }
  } catch (error) {
    $('time-result').textContent = 'Check your values';
    $('time-detail').textContent = error.message;
  }
}
$('time-form').addEventListener('submit', (event) => { event.preventDefault(); calculateTime(); });
$('time-direction').addEventListener('change', () => {
  const seconds = $('time-direction').value === 'seconds';
  $('time-bars-fields').hidden = seconds;
  $('time-seconds-field').hidden = !seconds;
  $('time-bars').disabled = seconds;
  $('time-beats').disabled = seconds;
  $('time-seconds').disabled = !seconds;
  $('time-form').querySelector('[type="submit"]').textContent = seconds ? 'Calculate bars + beats' : 'Calculate duration';
  calculateTime();
});
$('time-form').addEventListener('input', calculateTime);
calculateTime();

function renderScale() {
  const root = $('scale-root').value;
  const type = $('scale-type').value;
  const notes = scaleNotes(root, type);
  $('scale-title').textContent = `${root.replace('#', '♯').replace('b', '♭')} ${SCALES[type].name.toLowerCase()}`;
  $('scale-notes').replaceChildren(...notes.map(({ name }) => {
    const note = document.createElement('li');
    note.textContent = name;
    return note;
  }));
  $('scale-formula').textContent = SCALES[type].formula;
}
$('scale-root').addEventListener('change', renderScale);
$('scale-type').addEventListener('change', renderScale);
renderScale();

const STORAGE_KEY = 'nys.creator.checklists.v1';
let saved = {};
let storageFailed = false;
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.version !== 1 || !parsed.lists || typeof parsed.lists !== 'object' || Array.isArray(parsed.lists)) throw new Error('Invalid checklist data');
    saved = parsed.lists;
  }
} catch {
  storageFailed = true;
  $('checklist-storage').textContent = 'Saved checklists could not be loaded. You can still use and print them in this session. Changes will attempt to save again.';
}

function saveChecklists(message = 'Checklist progress saved on this browser.') {
  const lists = {};
  document.querySelectorAll('[data-checklist]').forEach((panel) => {
    lists[panel.dataset.checklist] = {
      project: panel.querySelector('[data-project]').value,
      checked: [...panel.querySelectorAll('[data-check]:checked')].map((checkbox) => checkbox.dataset.check)
    };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, lists }));
    storageFailed = false;
    $('checklist-storage').textContent = message;
  } catch {
    storageFailed = true;
    $('checklist-storage').textContent = 'Browser storage is unavailable. Your changes work for this session only; print to keep a copy.';
  }
}

function updateChecklist(panel) {
  const all = [...panel.querySelectorAll('[data-check]')];
  const count = all.filter((checkbox) => checkbox.checked).length;
  panel.querySelector('progress').value = count;
  panel.querySelector('[data-progress-label]').textContent = `${count} of ${all.length} checked${count === all.length ? ' · Review complete' : ''}`;
}

document.querySelectorAll('[data-checklist]').forEach((panel) => {
  const previous = saved[panel.dataset.checklist];
  if (previous && typeof previous === 'object' && !Array.isArray(previous)) {
    panel.querySelector('[data-project]').value = typeof previous.project === 'string' ? previous.project.slice(0, 120) : '';
    const checked = Array.isArray(previous.checked) ? previous.checked.filter((item) => typeof item === 'string') : [];
    panel.querySelectorAll('[data-check]').forEach((checkbox) => { checkbox.checked = checked.includes(checkbox.dataset.check); });
  }
  updateChecklist(panel);
  panel.querySelectorAll('[data-check]').forEach((checkbox) => checkbox.addEventListener('change', () => { updateChecklist(panel); saveChecklists(); }));
  panel.querySelector('[data-project]').addEventListener('input', () => saveChecklists('Project name saved on this browser.'));
  const reset = panel.querySelector('[data-reset]');
  const resetText = reset.textContent;
  let resetTimeout;
  reset.addEventListener('click', () => {
    if (reset.dataset.confirm !== 'yes') {
      reset.dataset.confirm = 'yes';
      reset.textContent = 'Confirm reset';
      $('checklist-storage').textContent = 'Press Confirm reset within 5 seconds to clear these checkmarks. The project name will be kept.';
      resetTimeout = setTimeout(() => { delete reset.dataset.confirm; reset.textContent = resetText; $('checklist-storage').textContent = storageFailed ? 'Changes are available for this session only. Print to keep a copy.' : 'Reset cancelled. Your checkmarks are unchanged.'; }, 5000);
      return;
    }
    clearTimeout(resetTimeout);
    delete reset.dataset.confirm;
    reset.textContent = resetText;
    panel.querySelectorAll('[data-check]').forEach((checkbox) => { checkbox.checked = false; });
    updateChecklist(panel);
    saveChecklists('Checklist reset. The project name was kept.');
  });
});

$('print-checklists').addEventListener('click', () => window.print());
