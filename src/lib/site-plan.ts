import type { Dossier, Parcelle, PhotoViewpoint } from './dossier';
import {
  boundaryDistances, bounds, centroid, edgeBearing, localProjection, mergeCollinearEdges, orientedRect,
  outerRings, rectInside, ringArea, type BoundaryDistance, type Vec,
} from './geo/geometry';
import { MODULE } from './module';

export interface LocalParcel {
  parcelle: Parcelle;
  rings: Vec[][];
  area: number;
  labelAt: Vec;
}

export interface SitePlanModel {
  origin: { lat: number; lon: number };
  toLonLat: (v: Vec) => [number, number];
  parcels: LocalParcel[];
  neighbours: LocalParcel[];
  buildings: Vec[][];
  module: Vec[];
  center: Vec;
  rotation: number;
  inside: boolean;
  distances: BoundaryDistance[];
  viewpoints: { id: 'dp7' | 'dp8'; label: string; vp: PhotoViewpoint }[];
  /** Cadre du dessin (m), repère local. */
  frame: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

const toLocalParcel = (p: Parcelle, toLocal: (q: [number, number]) => Vec): LocalParcel => {
  const rings = outerRings(p.geometry).map((r) => r.map(toLocal));
  const main = rings.reduce((a, b) => (ringArea(b) > ringArea(a) ? b : a));
  return { parcelle: p, rings, area: rings.reduce((s, r) => s + ringArea(r), 0), labelAt: centroid(main) };
};

/** Origine du repère local : centre des parcelles du projet. */
export function planOrigin(d: Dossier): { lat: number; lon: number } | null {
  const pts = d.terrain.parcelles.flatMap((p) => outerRings(p.geometry).flat());
  if (!pts.length) return d.terrain.location;
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  return { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 };
}

export function buildSitePlan(d: Dossier, margin = 6): SitePlanModel | null {
  const origin = planOrigin(d);
  if (!origin || !d.terrain.parcelles.length) return null;
  const { toLocal, toLonLat } = localProjection(origin);
  const parcels = d.terrain.parcelles.map((p) => toLocalParcel(p, toLocal));
  const allRings = parcels.flatMap((p) => p.rings);
  const b = bounds(allRings.flat());
  const frame = {
    minX: b.minX - margin, minY: b.minY - margin, maxX: b.maxX + margin, maxY: b.maxY + margin,
    width: b.width + 2 * margin, height: b.height + 2 * margin,
  };
  const inFrame = (rings: Vec[][]) =>
    rings.some((r) => r.some((p) => p.x > frame.minX && p.x < frame.maxX && p.y > frame.minY && p.y < frame.maxY));

  const imp = d.implantation;
  const center = imp.placed ? { x: imp.x, y: imp.y } : centroid(allRings.reduce((a, r) => (ringArea(r) > ringArea(a) ? r : a)));
  const rotation = imp.placed ? imp.rotation : suggestedRotation(allRings);
  const rect = orientedRect(center, MODULE.length, MODULE.width, rotation);
  const mainRing = allRings.reduce((a, r) => (ringArea(r) > ringArea(a) ? r : a));

  return {
    origin,
    toLonLat,
    parcels,
    neighbours: d.terrain.voisines.map((p) => toLocalParcel(p, toLocal)).filter((p) => inFrame(p.rings)),
    buildings: d.terrain.batiments.map((g) => g.coordinates[0].map(toLocal)).filter((r) => inFrame([r])),
    module: rect,
    center,
    rotation,
    inside: rectInside(rect, allRings),
    distances: boundaryDistances(rect, mainRing, 4),
    viewpoints: (['dp7', 'dp8'] as const).flatMap((id) => {
      const vp = imp.viewpoints[id];
      return vp ? [{ id, label: id.toUpperCase(), vp }] : [];
    }),
    frame,
  };
}

/** Rotation alignant la longueur du module sur le plus long côté de la parcelle. */
export function suggestedRotation(rings: Vec[][]): number {
  const edges = rings.flatMap((r) => mergeCollinearEdges(r));
  if (!edges.length) return 0;
  const [a, b] = edges.reduce((m, e) => (len(e) > len(m) ? e : m));
  return normalizeRotation(edgeBearing(a, b) - 90);
}

/** Rotation qui rend le module parallèle à la limite la plus proche. */
export function alignToNearestBoundary(model: SitePlanModel): number {
  const mainRing = model.parcels.flatMap((p) => p.rings).reduce((a, r) => (ringArea(r) > ringArea(a) ? r : a));
  const edges = mergeCollinearEdges(mainRing);
  const nearest = model.distances[0];
  if (!nearest) return model.rotation;
  const [a, b] = edges[nearest.edgeIndex];
  const base = edgeBearing(a, b) - 90;
  // Parmi les 4 orientations parallèles, garder la plus proche de l'actuelle.
  const options = [0, 90, 180, 270].map((k) => normalizeRotation(base + k)).filter((_, k) => k % 2 === 0);
  return options.reduce((best, r) => (angleDiff(r, model.rotation) < angleDiff(best, model.rotation) ? r : best));
}

const len = ([a, b]: [Vec, Vec]) => Math.hypot(b.x - a.x, b.y - a.y);
export const normalizeRotation = (r: number) => ((Math.round(r * 10) / 10) % 360 + 360) % 360;
const angleDiff = (a: number, b: number) => Math.min(Math.abs(a - b) % 360, 360 - (Math.abs(a - b) % 360));

export const STANDARD_SCALES = [100, 200, 250, 300, 400, 500, 750, 1000, 2000, 2500, 5000];

/** Plus grande échelle standard qui fait tenir le cadre dans la zone de dessin (mm). */
export function fitScale(widthM: number, heightM: number, areaMm: { width: number; height: number }): number {
  return STANDARD_SCALES.find((s) => (widthM * 1000) / s <= areaMm.width && (heightM * 1000) / s <= areaMm.height) ?? 5000;
}
