import manifest from '../../public/module/manifest.json';

/**
 * Caractéristiques fixes du Pavillon N°1.
 * Les dimensions proviennent des plans DWG (assets/dwg), convertis en SVG
 * par `npm run assets:module`.
 */
export const MODULE = {
  name: 'Pavillon N°1',
  brand: 'NASCO',
  /** Longueur hors-tout (m) — façade N4 / plan. */
  length: 8.0,
  /** Largeur hors-tout (m) — pignons N2 / N3. */
  width: 2.5,
  /** Hauteur au point le plus haut, depuis le sol fini (m) — acrotère. */
  height: 2.7,
  /** Hauteur du plancher fini au-dessus du terrain (m) — pose sur plots. */
  floorHeight: 0.25,
  /** Surface de plancher intérieure (m²) : 7,46 × 1,90 d'après le plan. */
  floorArea: 14.2,
  get footprint() {
    return Math.round(this.length * this.width * 10) / 10;
  },
} as const;

export const DEFAULT_MATERIALS =
  'Ossature bois préfabriquée. Bardage en panneaux bois/liège de teinte naturelle, ' +
  'volets et panneaux brise-vue coulissants vert sauge, menuiseries aluminium noir, ' +
  'toiture en bac acier gris clair. Pose sur plots, sans fondations maçonnées ni ' +
  'modification du terrain naturel.';

export const DEFAULT_DESCRIPTION =
  `Installation d'un module d'habitation préfabriqué « ${MODULE.name} » de la marque ${MODULE.brand}, ` +
  `de ${fr(MODULE.length)} m × ${fr(MODULE.width)} m (emprise au sol ${fr(MODULE.footprint, 1)} m²) ` +
  `et de ${fr(MODULE.height)} m de hauteur. ${DEFAULT_MATERIALS}`;

/** Nombre au format français, `digits` décimales fixes. */
export function fr(n: number, digits = 2) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export type DrawingId = 'facade-n4' | 'facade-n2' | 'facade-n3' | 'coupe-c19' | 'coupe-c20' | 'plan';

export interface Drawing {
  id: DrawingId;
  title: string;
  kind: 'facade' | 'coupe' | 'plan';
  source: string;
  /** viewBox SVG en millimètres : [x, y, largeur, hauteur]. */
  viewBox: [number, number, number, number];
  envelope: { width: number; height: number };
  url: string;
}

export const DRAWINGS: Record<DrawingId, Drawing> = Object.fromEntries(
  (manifest as Omit<Drawing, 'url'>[]).map((d) => [d.id, { ...d, url: `/module/${d.id}.svg` }]),
) as Record<DrawingId, Drawing>;

/**
 * Orientation des façades dans le repère du plan du module (plan.svg) :
 * N4 (entrée) regarde vers le haut du plan, N2 vers la gauche, N3 vers la droite.
 * Angle = direction de la normale extérieure, en degrés, 0 = haut du plan, sens horaire.
 */
export const FACADE_NORMALS: Record<'facade-n4' | 'facade-n2' | 'facade-n3' | 'facade-n1', number> = {
  'facade-n4': 0,
  'facade-n3': 90,
  'facade-n1': 180,
  'facade-n2': 270,
};

/** Images utilisées pour l'insertion paysagère (DP6). */
export const INSERTION_SPRITES = [
  { id: 'n4', label: 'Façade entrée (N4)', url: '/module/insertion-n4.svg', ratio: 8.9 / 3.15 },
  { id: 'n2', label: 'Pignon (N2)', url: '/module/insertion-pignon.svg', ratio: 3.4 / 3.15 },
] as const;

export type InsertionSpriteId = (typeof INSERTION_SPRITES)[number]['id'];
