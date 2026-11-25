import type { Parcelle } from '../dossier';
import { outerRings, type Polygon } from './geometry';
import { findBuildingsInBox, findParcelsInBox, type ParcelleFeature } from './ign';

export const toParcelle = (f: ParcelleFeature): Parcelle => ({
  idu: f.idu,
  prefixe: f.prefixe,
  section: f.section,
  numero: f.numero,
  contenance: f.contenance,
  geometry: f.geometry,
});

/** Emprise (lon/lat) des parcelles, élargie d'environ `marginM` mètres. */
export function parcelsBox(parcelles: Parcelle[], marginM = 60): number[] {
  const pts = parcelles.flatMap((p) => outerRings(p.geometry).flat());
  const lons = pts.map((p) => p[0]), lats = pts.map((p) => p[1]);
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = marginM / 110574, dLon = marginM / (111320 * Math.cos((lat * Math.PI) / 180));
  return [Math.min(...lons) - dLon, Math.min(...lats) - dLat, Math.max(...lons) + dLon, Math.max(...lats) + dLat];
}

/** Parcelles voisines et bâtiments existants autour du terrain (échecs tolérés). */
export async function loadSurroundings(parcelles: Parcelle[]): Promise<{ voisines: Parcelle[]; batiments: Polygon[] }> {
  if (!parcelles.length) return { voisines: [], batiments: [] };
  const box = parcelsBox(parcelles);
  const own = new Set(parcelles.map((p) => p.idu));
  const [voisines, batiments] = await Promise.all([
    findParcelsInBox(box)
      .then((all) => all.filter((p) => !own.has(p.idu)).map(toParcelle))
      .catch(() => []),
    findBuildingsInBox(box).catch(() => []),
  ]);
  return { voisines, batiments };
}
