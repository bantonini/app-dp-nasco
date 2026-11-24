import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundaryDistances, cardinal, mergeCollinearEdges, orientedRect, rectInside, ringArea, localProjection } from './geometry.ts';

const square = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 30 }, { x: 0, y: 30 }];

test('orientedRect keeps the module footprint', () => {
  const r = orientedRect({ x: 10, y: 10 }, 8, 2.5, 37);
  assert.ok(Math.abs(ringArea(r) - 20) < 1e-9);
});

test('rotation 0 puts the entrance façade to the North', () => {
  const [fl, fr] = orientedRect({ x: 0, y: 0 }, 8, 2.5, 0);
  assert.equal(fl.y, 1.25);
  assert.equal(fr.y, 1.25);
  assert.ok(fl.x < fr.x);
});

test('boundary distances to a square parcel', () => {
  const rect = orientedRect({ x: 6, y: 15 }, 8, 2.5, 0); // x 2..10, y 13.75..16.25
  const d = boundaryDistances(rect, square, 4);
  assert.deepEqual(d.map((x) => Math.round(x.distance * 100) / 100), [2, 10, 13.75, 13.75]);
});

test('collinear edges are merged', () => {
  const ring = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0.1 }, { x: 20, y: 30 }, { x: 0, y: 30 }];
  assert.equal(mergeCollinearEdges(ring).length, 4);
});

test('rectInside detects overflow', () => {
  assert.equal(rectInside(orientedRect({ x: 6, y: 15 }, 8, 2.5, 0), [square]), true);
  assert.equal(rectInside(orientedRect({ x: 1, y: 15 }, 8, 2.5, 0), [square]), false);
});

test('local projection round-trips', () => {
  const p = localProjection({ lat: 43.5, lon: 5.4 });
  const v = p.toLocal([5.401, 43.5005]);
  const [lon, lat] = p.toLonLat(v);
  assert.ok(Math.abs(lon - 5.401) < 1e-12 && Math.abs(lat - 43.5005) < 1e-12);
  assert.ok(Math.abs(v.x - 80.7) < 0.5);
});

test('cardinal names', () => {
  assert.equal(cardinal(0), 'Nord');
  assert.equal(cardinal(181), 'Sud');
  assert.equal(cardinal(-90), 'Ouest');
});
