/** Géométrie plane et projection locale pour le plan de masse. */

export type Position = [number, number];
export interface Polygon {
  type: 'Polygon';
  coordinates: Position[][];
}
export interface MultiPolygon {
  type: 'MultiPolygon';
  coordinates: Position[][][];
}
export type Vec = { x: number; y: number };

const EARTH_RADIUS = 6378137;
const RAD = Math.PI / 180;

/**
 * Projection équirectangulaire centrée sur `origin` : x vers l'Est, y vers le Nord, en mètres.
 * Erreur < 1 cm sur quelques centaines de mètres, largement suffisant pour un plan de masse.
 */
export function localProjection(origin: { lat: number; lon: number }) {
  const k = Math.cos(origin.lat * RAD) * EARTH_RADIUS * RAD;
  const ky = EARTH_RADIUS * RAD;
  return {
    toLocal: ([lon, lat]: Position): Vec => ({ x: (lon - origin.lon) * k, y: (lat - origin.lat) * ky }),
    toLonLat: ({ x, y }: Vec): Position => [origin.lon + x / k, origin.lat + y / ky],
  };
}

/** Anneaux extérieurs d'un Polygon ou MultiPolygon. */
export function outerRings(g: Polygon | MultiPolygon): Position[][] {
  return g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0]);
}

export function ringArea(ring: Vec[]): number {
  let a = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

export function centroid(ring: Vec[]): Vec {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) return ring.reduce((s, p) => ({ x: s.x + p.x / ring.length, y: s.y + p.y / ring.length }), { x: 0, y: 0 });
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

export function bounds(points: Vec[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export function pointInRing(p: Vec, ring: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Rectangle orienté (coins dans l'ordre horaire depuis l'angle « avant-gauche »). */
export function orientedRect(center: Vec, length: number, width: number, bearingDeg: number): Vec[] {
  // bearing 0 : le côté « avant » (largeur `length`) regarde le Nord.
  const t = bearingDeg * RAD;
  const ux = { x: Math.cos(t), y: -Math.sin(t) }; // axe longueur (vers l'Est quand t = 0)
  const uy = { x: Math.sin(t), y: Math.cos(t) }; // normale avant (vers le Nord quand t = 0)
  const hl = length / 2, hw = width / 2;
  const at = (a: number, b: number) => ({ x: center.x + ux.x * a + uy.x * b, y: center.y + ux.y * a + uy.y * b });
  return [at(-hl, hw), at(hl, hw), at(hl, -hw), at(-hl, -hw)];
}

export function closestPointOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

/** Couple de points les plus proches entre deux segments (non sécants). */
export function closestBetweenSegments(a: Vec, b: Vec, c: Vec, d: Vec): { from: Vec; to: Vec; distance: number } {
  const candidates = [
    { from: a, to: closestPointOnSegment(a, c, d) },
    { from: b, to: closestPointOnSegment(b, c, d) },
    { from: closestPointOnSegment(c, a, b), to: c },
    { from: closestPointOnSegment(d, a, b), to: d },
  ];
  return candidates.map((x) => ({ ...x, distance: dist(x.from, x.to) })).sort((m, n) => m.distance - n.distance)[0];
}

export interface BoundaryDistance {
  from: Vec;
  to: Vec;
  distance: number;
  edgeIndex: number;
}

/**
 * Distance du module à chaque limite séparative (un côté du polygone de parcelle).
 * Les côtés colinéaires consécutifs sont fusionnés pour éviter les doublons de cotes.
 * Renvoie les `max` limites les plus proches.
 */
export function boundaryDistances(module: Vec[], parcel: Vec[], max = 4): BoundaryDistance[] {
  const edges = mergeCollinearEdges(parcel);
  const result: BoundaryDistance[] = edges.map(([c, d], edgeIndex) => {
    let best = { from: module[0], to: c, distance: Infinity };
    for (let i = 0; i < module.length; i++) {
      const r = closestBetweenSegments(module[i], module[(i + 1) % module.length], c, d);
      if (r.distance < best.distance) best = r;
    }
    return { ...best, edgeIndex };
  });
  return result.sort((a, b) => a.distance - b.distance).slice(0, max);
}

export function mergeCollinearEdges(ring: Vec[], toleranceDeg = 8): [Vec, Vec][] {
  const pts = ring.length > 1 && dist(ring[0], ring[ring.length - 1]) < 1e-6 ? ring.slice(0, -1) : ring;
  const n = pts.length;
  if (n < 3) return [];
  const angle = (a: Vec, b: Vec) => Math.atan2(b.y - a.y, b.x - a.x);
  const turn = (i: number) => {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
    let d = Math.abs(angle(prev, cur) - angle(cur, next)) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  };
  const corners = pts.map((_, i) => i).filter((i) => turn(i) > toleranceDeg * RAD);
  if (corners.length < 3) return pts.map((p, i) => [p, pts[(i + 1) % n]]);
  return corners.map((c, k) => [pts[c], pts[corners[(k + 1) % corners.length]]]);
}

/** Le module est-il entièrement contenu dans l'un des anneaux de parcelle ? */
export function rectInside(rect: Vec[], rings: Vec[][]): boolean {
  return rings.some((ring) => rect.every((p) => pointInRing(p, ring)));
}

/** Orientation d'un côté de parcelle (degrés, 0 = Nord, sens horaire) — pour l'alignement. */
export function edgeBearing(a: Vec, b: Vec): number {
  return ((Math.atan2(b.x - a.x, b.y - a.y) / RAD) + 360) % 360;
}

const CARDINALS = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
export function cardinal(bearingDeg: number): string {
  return CARDINALS[Math.round((((bearingDeg % 360) + 360) % 360) / 45) % 8];
}
