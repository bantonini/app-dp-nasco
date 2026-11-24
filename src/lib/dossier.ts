import { DEFAULT_DESCRIPTION, MODULE, type InsertionSpriteId } from './module';
import type { Polygon, MultiPolygon } from './geo/geometry';

/** Référence d'un fichier stocké (photo, image d'insertion…). */
export interface FileRef {
  key: string;
  name: string;
  type: string;
  width?: number;
  height?: number;
}

export interface PostalAddress {
  numero: string;
  voie: string;
  lieuDit: string;
  codePostal: string;
  localite: string;
}

export interface Declarant {
  type: 'particulier' | 'societe';
  civilite: 'Madame' | 'Monsieur' | '';
  nom: string;
  prenom: string;
  dateNaissance: string;
  lieuNaissance: string;
  denomination: string;
  siret: string;
  adresse: PostalAddress;
  telephone: string;
  email: string;
  accepteEmail: boolean;
}

export interface Parcelle {
  /** Identifiant unique cadastral (IDU), ex. 13001000AB0123 */
  idu: string;
  prefixe: string;
  section: string;
  numero: string;
  /** Contenance cadastrale en m² */
  contenance: number;
  geometry: Polygon | MultiPolygon;
}

export interface Terrain {
  adresse: PostalAddress;
  codeInsee: string;
  commune: string;
  /** Point de référence (WGS84) utilisé pour les cartes. */
  location: { lat: number; lon: number } | null;
  parcelles: Parcelle[];
  /** Parcelles voisines (affichage du plan de masse uniquement). */
  voisines: Parcelle[];
  /** Bâtiments existants (BD TOPO), en WGS84. */
  batiments: Polygon[];
}

export interface Projet {
  description: string;
  destination: 'habitation' | 'annexe' | 'hebergement-touristique';
  surfacePlancher: number;
  emprise: number;
  hauteur: number;
  /** Surface de plancher existante sur le terrain avant travaux (m²). */
  surfaceExistante: number;
  raccordements: string;
}

/** Point de vue photographique reporté sur le plan de masse. */
export interface PhotoViewpoint {
  /** Position en mètres dans le repère local du plan (x vers l'Est, y vers le Nord). */
  x: number;
  y: number;
  /** Direction de visée en degrés (0 = Nord, sens horaire). */
  bearing: number;
}

export interface Implantation {
  /** Centre du module, repère local (m). */
  x: number;
  y: number;
  /** Rotation du module en degrés, sens horaire ; 0 = façade d'entrée (N4) vers le Nord. */
  rotation: number;
  placed: boolean;
  orthoBackground: boolean;
  viewpoints: { dp7: PhotoViewpoint | null; dp8: PhotoViewpoint | null };
}

export interface Photos {
  dp7: FileRef | null;
  dp8: FileRef | null;
}

export type Quad = [[number, number], [number, number], [number, number], [number, number]];

export interface Insertion {
  base: 'dp7' | 'dp8' | 'custom';
  customPhoto: FileRef | null;
  sprite: InsertionSpriteId;
  customSprite: FileRef | null;
  /** Coins du module sur la photo, coordonnées relatives (0–1) : HG, HD, BD, BG. */
  corners: Quad | null;
  brightness: number;
  contrast: number;
  saturation: number;
  shadow: number;
  mask: FileRef | null;
  result: FileRef | null;
}

export type DossierStatus = 'brouillon' | 'pret' | 'depose';

export interface Dossier {
  id: string;
  reference: string;
  status: DossierStatus;
  createdAt: string;
  updatedAt: string;
  declarant: Declarant;
  terrain: Terrain;
  projet: Projet;
  implantation: Implantation;
  photos: Photos;
  insertion: Insertion;
  engagement: { lieu: string; date: string };
}

const emptyAddress = (): PostalAddress => ({ numero: '', voie: '', lieuDit: '', codePostal: '', localite: '' });

export function createDossier(id: string, sequence: number): Dossier {
  const now = new Date();
  return {
    id,
    reference: `DP-${now.getFullYear()}-${String(sequence).padStart(4, '0')}`,
    status: 'brouillon',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    declarant: {
      type: 'particulier',
      civilite: '',
      nom: '',
      prenom: '',
      dateNaissance: '',
      lieuNaissance: '',
      denomination: '',
      siret: '',
      adresse: emptyAddress(),
      telephone: '',
      email: '',
      accepteEmail: true,
    },
    terrain: { adresse: emptyAddress(), codeInsee: '', commune: '', location: null, parcelles: [], voisines: [], batiments: [] },
    projet: {
      description: DEFAULT_DESCRIPTION,
      destination: 'habitation',
      surfacePlancher: MODULE.floorArea,
      emprise: MODULE.footprint,
      hauteur: MODULE.height,
      surfaceExistante: 0,
      raccordements: 'Raccordement aux réseaux existants (eau, électricité) depuis la construction principale.',
    },
    implantation: { x: 0, y: 0, rotation: 0, placed: false, orthoBackground: false, viewpoints: { dp7: null, dp8: null } },
    photos: { dp7: null, dp8: null },
    insertion: {
      base: 'dp7',
      customPhoto: null,
      sprite: 'n4',
      customSprite: null,
      corners: null,
      brightness: 1,
      contrast: 1,
      saturation: 1,
      shadow: 0.45,
      mask: null,
      result: null,
    },
    engagement: { lieu: '', date: now.toISOString().slice(0, 10) },
  };
}

// ───────────────────────── Complétude ─────────────────────────

export type StepId = 'declarant' | 'terrain' | 'projet' | 'implantation' | 'photos' | 'insertion' | 'export';

export interface StepStatus {
  done: boolean;
  missing: string[];
}

export function stepStatus(d: Dossier): Record<StepId, StepStatus> {
  const check = (pairs: [boolean, string][]): StepStatus => {
    const missing = pairs.filter(([ok]) => !ok).map(([, label]) => label);
    return { done: missing.length === 0, missing };
  };
  const decl = d.declarant;
  const declarant = check([
    [decl.type === 'societe' ? !!decl.denomination && !!decl.siret : !!decl.nom && !!decl.prenom, 'Identité du déclarant'],
    [!!decl.adresse.voie && !!decl.adresse.codePostal && !!decl.adresse.localite, 'Adresse du déclarant'],
    [!!decl.email || !!decl.telephone, 'Téléphone ou e-mail'],
  ]);
  const terrain = check([
    [!!d.terrain.location, 'Localisation du terrain'],
    [d.terrain.parcelles.length > 0, 'Parcelle cadastrale'],
  ]);
  const projet = check([
    [d.projet.description.trim().length > 20, 'Description du projet'],
    [d.projet.surfacePlancher > 0 && d.projet.emprise > 0, 'Surfaces'],
  ]);
  const implantation = check([
    [d.implantation.placed, 'Position du module sur la parcelle'],
    [!!d.implantation.viewpoints.dp7 && !!d.implantation.viewpoints.dp8, 'Points de vue des photos DP7 / DP8'],
  ]);
  const photos = check([
    [!!d.photos.dp7, 'Photo environnement proche (DP7)'],
    [!!d.photos.dp8, 'Photo paysage lointain (DP8)'],
  ]);
  const insertion = check([[!!d.insertion.result, 'Insertion paysagère enregistrée (DP6)']]);
  const exportStep = check([
    [!!d.engagement.lieu, 'Lieu de signature'],
    [[declarant, terrain, projet, implantation, photos, insertion].every((x) => x.done), 'Étapes précédentes complètes'],
  ]);
  return { declarant, terrain, projet, implantation, photos, insertion, export: exportStep };
}

export function progress(d: Dossier): number {
  const s = Object.values(stepStatus(d));
  return s.filter((x) => x.done).length / s.length;
}

export function declarantName(d: Dossier): string {
  const decl = d.declarant;
  if (decl.type === 'societe') return decl.denomination || 'Société sans nom';
  const name = [decl.prenom, decl.nom.toUpperCase()].filter(Boolean).join(' ');
  return name || 'Nouveau client';
}

export function parcelLabel(p: Pick<Parcelle, 'section' | 'numero' | 'prefixe'>): string {
  const prefix = p.prefixe && p.prefixe !== '000' ? `${p.prefixe} ` : '';
  return `${prefix}${p.section} ${p.numero.replace(/^0+/, '')}`;
}

export function formatAddress(a: PostalAddress): string {
  const line1 = [a.numero, a.voie].filter(Boolean).join(' ');
  return [line1, a.lieuDit, [a.codePostal, a.localite].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}
