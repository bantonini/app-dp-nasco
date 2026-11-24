import { createDossier, type Dossier } from './dossier';

/**
 * Dossier d'exemple pour découvrir l'application. Client et parcelle sont
 * fictifs (géométrie dessinée à la main) : ne pas déposer en mairie.
 */
export function demoDossier(id: string, sequence: number): Dossier {
  const d = createDossier(id, sequence);
  const lon0 = 5.36205, lat0 = 43.76612;
  const k = 1 / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const ky = 1 / 110574;
  const ring = (pts: [number, number][]) =>
    [...pts, pts[0]].map(([x, y]) => [lon0 + x * k, lat0 + y * ky] as [number, number]);
  const parcel = ring([[-24, -18], [21, -22], [27, 19], [-19, 24]]);
  const north = ring([[-19, 24], [27, 19], [31, 52], [-15, 56]]);
  const east = ring([[21, -22], [58, -25], [63, 15], [27, 19]]);
  const house = ring([[-14, 4], [2, 3], [3, 14], [-13, 15]]);

  return {
    ...d,
    reference: `${d.reference}-EX`,
    declarant: {
      ...d.declarant,
      civilite: 'Madame',
      nom: 'Exemple',
      prenom: 'Camille',
      adresse: { numero: '12', voie: 'Chemin des Oliviers', lieuDit: '', codePostal: '84160', localite: 'Lourmarin' },
      telephone: '06 00 00 00 00',
      email: 'camille.exemple@example.com',
    },
    terrain: {
      adresse: { numero: '12', voie: 'Chemin des Oliviers', lieuDit: '', codePostal: '84160', localite: 'Lourmarin' },
      codeInsee: '84068',
      commune: 'Lourmarin',
      location: { lat: lat0, lon: lon0 },
      parcelles: [{ idu: '84068000AB0123', prefixe: '000', section: 'AB', numero: '0123', contenance: 1810, geometry: { type: 'Polygon', coordinates: [parcel] } }],
      voisines: [
        { idu: '84068000AB0124', prefixe: '000', section: 'AB', numero: '0124', contenance: 1600, geometry: { type: 'Polygon', coordinates: [north] } },
        { idu: '84068000AB0122', prefixe: '000', section: 'AB', numero: '0122', contenance: 1500, geometry: { type: 'Polygon', coordinates: [east] } },
      ],
      batiments: [{ type: 'Polygon', coordinates: [house] }],
    },
    implantation: {
      x: 9,
      y: -8,
      rotation: 4,
      placed: true,
      orthoBackground: false,
      viewpoints: { dp7: { x: 2, y: -19, bearing: 20 }, dp8: { x: -20, y: -16, bearing: 60 } },
    },
    engagement: { lieu: 'Lourmarin', date: d.engagement.date },
  };
}
