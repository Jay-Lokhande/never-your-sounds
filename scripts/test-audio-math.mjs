import test from 'node:test';
import assert from 'node:assert/strict';
import { signature, beatSeconds, durationFromBars, barsFromDuration, tapTempo, scaleNotes, SCALES } from '../docs/assets/js/audio-math.mjs';

test('quarter-note BPM respects the denominator in simple and compound meters', () => {
  assert.equal(beatSeconds(120, '4/4'), 0.5);
  assert.equal(beatSeconds(120, '6/8'), 0.25);
  assert.equal(durationFromBars(8, 0, 120, '4/4').seconds, 16);
  assert.equal(durationFromBars(8, 0, 120, '6/8').seconds, 12);
  assert.equal(durationFromBars(1, 0.5, 60, '7/8').seconds, 3.75);
  assert.equal(beatSeconds(60, '2/2'), 2);
});

test('duration conversion handles zero, exact boundaries, and fractional beats', () => {
  assert.deepEqual(barsFromDuration(0, 120, '4/4'), { bars: 0, beats: 0, totalBeats: 0 });
  assert.deepEqual(barsFromDuration(12, 120, '6/8'), { bars: 8, beats: 0, totalBeats: 48 });
  assert.deepEqual(barsFromDuration(2.75, 120, '4/4'), { bars: 1, beats: 1.5, totalBeats: 5.5 });
  for (const meter of ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8']) {
    const forward = durationFromBars(11, 0.25, 137, meter);
    const backward = barsFromDuration(forward.seconds, 137, meter);
    assert.equal(backward.bars, 11);
    assert.ok(Math.abs(backward.beats - 0.25) < 1e-9);
  }
});

test('invalid values fail with actionable range errors', () => {
  for (const bpm of [0, -1, 19, 301, NaN, Infinity]) assert.throws(() => beatSeconds(bpm), RangeError);
  for (const meter of ['0/4', '4/0', '4/3', '4/4junk', '17/4', null]) assert.throws(() => signature(meter), RangeError);
  assert.throws(() => durationFromBars(1.5, 0, 120, '4/4'), RangeError);
  assert.throws(() => durationFromBars(1, -1, 120, '4/4'), RangeError);
  assert.throws(() => barsFromDuration(NaN, 120, '4/4'), RangeError);
  assert.throws(() => barsFromDuration(86401, 120, '4/4'), RangeError);
});

test('tap tempo averages real intervals and rejects invalid sequences', () => {
  assert.equal(tapTempo([0, 500, 1000, 1500]), 120);
  assert.equal(tapTempo([100, 600, 1120, 1600]), 120);
  assert.equal(tapTempo([0, 1000, 2000]), 60);
  for (const taps of [[], [0], [0, 0], [500, 0], [0, NaN]]) assert.equal(tapTempo(taps), null);
});

test('scales retain correct diatonic spelling rather than flattening pitch classes', () => {
  const names = (root, scale) => scaleNotes(root, scale).map((note) => note.name);
  assert.deepEqual(names('F#', 'major'), ['F♯', 'G♯', 'A♯', 'B', 'C♯', 'D♯', 'E♯']);
  assert.deepEqual(names('Gb', 'major'), ['G♭', 'A♭', 'B♭', 'C♭', 'D♭', 'E♭', 'F']);
  assert.deepEqual(names('C#', 'major'), ['C♯', 'D♯', 'E♯', 'F♯', 'G♯', 'A♯', 'B♯']);
  assert.deepEqual(names('C', 'minorPentatonic'), ['C', 'E♭', 'F', 'G', 'B♭']);
  assert.deepEqual(names('A', 'minor'), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  assert.deepEqual(names('D', 'dorian'), ['D', 'E', 'F', 'G', 'A', 'B', 'C']);
  for (const root of ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']) {
    for (const [type, scale] of Object.entries(SCALES)) {
      const notes = scaleNotes(root, type);
      assert.equal(notes.length, scale.steps.length);
      assert.equal(new Set(notes.map((note) => note.pitch)).size, notes.length);
      assert.ok(notes.every((note) => note.pitch >= 0 && note.pitch < 12));
    }
  }
  assert.throws(() => scaleNotes('H', 'major'), RangeError);
  assert.throws(() => scaleNotes('C', '__proto__'), RangeError);
});
