const test = require('node:test');
const assert = require('node:assert/strict');
const { score, summarize } = require('../tools/sus-score.cjs');
// Synthetic unit-test inputs, not results from NOVAX participants.
test('SUS scoring respects polarity and the full 0–100 range', () => {
  assert.equal(score([5,1,5,1,5,1,5,1,5,1]), 100);
  assert.equal(score([1,5,1,5,1,5,1,5,1,5]), 0);
  assert.equal(score(Array(10).fill(3)), 50);
});
test('SUS rejects missing, out-of-range, nonnumeric and fractional responses', () => {
  for (const input of [[], Array(9).fill(3), Array(11).fill(3), Array(10).fill('3'), Array(10).fill(0), Array(10).fill(6), Array(10).fill(2.5), null]) assert.throws(() => score(input));
});
test('SUS reports sample size and dispersion without inventing missing participants', () => {
  const result = summarize([{ participant: 'P01', responses: [5,1,5,1,5,1,5,1,5,1] }, { participant: 'P02', responses: [1,5,1,5,1,5,1,5,1,5] }]);
  assert.equal(result.n, 2); assert.equal(result.mean, 50); assert.equal(result.median, 50);
  assert.equal(summarize([{ participant: 'P01', responses: Array(10).fill(3) }]).sample_standard_deviation, null);
  assert.throws(() => summarize([]));
  assert.throws(() => summarize([{ participant: 'Real Name', responses: Array(10).fill(3) }]));
  assert.throws(() => summarize([{ participant: 'P01', responses: Array(10).fill(3) }, { participant: 'P01', responses: Array(10).fill(3) }]));
});
