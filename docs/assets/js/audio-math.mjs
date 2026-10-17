/** Pure music helpers. BPM always means quarter notes per minute. */
export function signature(value) {
  if (typeof value !== 'string' || !/^\d+\/(2|4|8|16)$/.test(value)) throw new RangeError('Choose a valid time signature.');
  const [numerator, denominator] = value.split('/').map(Number);
  if (numerator < 1 || numerator > 16) throw new RangeError('The numerator must be between 1 and 16.');
  return { numerator, denominator };
}

export function beatSeconds(bpm, meter = '4/4') {
  if (!Number.isFinite(bpm) || bpm < 20 || bpm > 300) throw new RangeError('Enter a tempo from 20 to 300 BPM.');
  return (60 / bpm) * (4 / signature(meter).denominator);
}

export function durationFromBars(bars, beats, bpm, meter) {
  if (!Number.isFinite(bars) || !Number.isInteger(bars) || bars < 0 || bars > 100000) throw new RangeError('Enter a whole number of bars from 0 to 100,000.');
  if (!Number.isFinite(beats) || beats < 0 || beats > 100000) throw new RangeError('Enter additional beats from 0 to 100,000.');
  const totalBeats = bars * signature(meter).numerator + beats;
  return { totalBeats, seconds: totalBeats * beatSeconds(bpm, meter) };
}

export function barsFromDuration(seconds, bpm, meter) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400) throw new RangeError('Enter a duration from 0 to 86,400 seconds.');
  const totalBeats = seconds / beatSeconds(bpm, meter);
  const beatsInBar = signature(meter).numerator;
  const bars = Math.floor((totalBeats + 1e-9) / beatsInBar);
  return { bars, beats: Math.max(0, totalBeats - bars * beatsInBar), totalBeats };
}

export function tapTempo(timestamps) {
  if (!Array.isArray(timestamps) || timestamps.length < 2 || timestamps.some((time) => !Number.isFinite(time))) return null;
  const intervals = timestamps.slice(1).map((time, index) => time - timestamps[index]);
  if (intervals.some((interval) => interval <= 0)) return null;
  return 60000 / (intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length);
}

export const SCALES = Object.freeze({
  major: { name: 'Major', steps: [0, 2, 4, 5, 7, 9, 11], degrees: [0, 1, 2, 3, 4, 5, 6], formula: '1 · 2 · 3 · 4 · 5 · 6 · 7' },
  minor: { name: 'Natural minor', steps: [0, 2, 3, 5, 7, 8, 10], degrees: [0, 1, 2, 3, 4, 5, 6], formula: '1 · 2 · ♭3 · 4 · 5 · ♭6 · ♭7' },
  dorian: { name: 'Dorian', steps: [0, 2, 3, 5, 7, 9, 10], degrees: [0, 1, 2, 3, 4, 5, 6], formula: '1 · 2 · ♭3 · 4 · 5 · 6 · ♭7' },
  mixolydian: { name: 'Mixolydian', steps: [0, 2, 4, 5, 7, 9, 10], degrees: [0, 1, 2, 3, 4, 5, 6], formula: '1 · 2 · 3 · 4 · 5 · 6 · ♭7' },
  majorPentatonic: { name: 'Major pentatonic', steps: [0, 2, 4, 7, 9], degrees: [0, 1, 2, 4, 5], formula: '1 · 2 · 3 · 5 · 6' },
  minorPentatonic: { name: 'Minor pentatonic', steps: [0, 3, 5, 7, 10], degrees: [0, 2, 3, 4, 6], formula: '1 · ♭3 · 4 · 5 · ♭7' }
});

export function scaleNotes(root, type) {
  if (!/^[A-G](#|b)?$/.test(root) || !Object.hasOwn(SCALES, type)) throw new RangeError('Choose a valid root and scale.');
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const natural = [0, 2, 4, 5, 7, 9, 11];
  const rootIndex = letters.indexOf(root[0]);
  const rootPitch = natural[rootIndex] + (root[1] === '#' ? 1 : root[1] === 'b' ? -1 : 0);
  return SCALES[type].steps.map((step, index) => {
    const letterIndex = (rootIndex + SCALES[type].degrees[index]) % 7;
    const pitch = (rootPitch + step + 12) % 12;
    let alteration = (pitch - natural[letterIndex] + 12) % 12;
    if (alteration > 6) alteration -= 12;
    return { name: letters[letterIndex] + (alteration > 0 ? '♯'.repeat(alteration) : '♭'.repeat(-alteration)), pitch };
  });
}
