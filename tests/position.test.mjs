import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as api from '../dist/esm/index.js';

const options = {
  target: { top: 100, left: 200, width: 100, height: 50 },
  panel: { width: 200, height: 100 },
  viewport: { width: 800, height: 600 },
};

test('ESM and CJS expose identical public symbols', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  assert.deepEqual(Object.keys(cjs).sort(), Object.keys(api).sort());
});

test('positions below a target with centered alignment and default spacing', () => {
  assert.deepEqual(api.calculatePosition(options), {
    left: 150,
    top: 162,
    placement: 'bottom',
  });
});

test('flips to the opposite side when it has more room', () => {
  const result = api.calculatePosition({
    ...options,
    target: { ...options.target, top: 550 },
  });
  assert.equal(result.placement, 'top');
  assert.equal(result.top, 438);
});

test('clamps to viewport padding and supports horizontal placement', () => {
  const result = api.calculatePosition({
    ...options,
    placement: 'left',
    target: { ...options.target, left: 0 },
  });
  assert.equal(result.placement, 'right');
  assert.equal(result.left, 112);
  const clipped = api.calculatePosition({
    ...options,
    target: { ...options.target, left: -500 },
  });
  assert.equal(clipped.left, 12);
});

test('rejects nonfinite, negative and invalid geometry', () => {
  assert.throws(() => api.calculatePosition({ ...options, gap: -1 }), RangeError);
  assert.throws(() => api.calculatePosition({ ...options, padding: NaN }), RangeError);
  assert.throws(() => api.calculatePosition({ ...options, placement: 'center' }), RangeError);
});
