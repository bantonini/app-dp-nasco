import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointInQuad, squareToQuad, type Quad4 } from './homography.ts';

const quad: Quad4 = [[10, 20], [110, 30], [120, 90], [5, 100]];

test('maps the unit square corners onto the quad', () => {
  const m = squareToQuad(quad);
  const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(close(m(0, 0), quad[0]));
  assert.ok(close(m(1, 0), quad[1]));
  assert.ok(close(m(1, 1), quad[2]));
  assert.ok(close(m(0, 1), quad[3]));
});

test('an affine quad maps the centre to the centroid', () => {
  const m = squareToQuad([[0, 0], [10, 0], [10, 5], [0, 5]]);
  assert.deepEqual(m(0.5, 0.5), [5, 2.5]);
});

test('pointInQuad', () => {
  assert.equal(pointInQuad([60, 60], quad), true);
  assert.equal(pointInQuad([0, 0], quad), false);
});
