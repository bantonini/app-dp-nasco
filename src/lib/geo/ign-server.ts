import 'server-only';
import type { Polygon, MultiPolygon } from './geometry';

/**
 * Accès aux services ouverts de l'IGN (Géoplateforme) et de l'API Carto.
 * Appelés uniquement côté serveur (routes /api/ign/*) pour éviter les soucis
 * CORS et pouvoir mettre en cache les réponses.
 */
const GEOPF = 'https://data.geopf.fr';
const APICARTO = 'https://apicarto.ign.fr/api';

export class UpstreamError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

async function getJson<T>(url: string, revalidate = 86400): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate },
    signal: AbortSignal.timeout(15000),
  }).catch((e: unknown) => {
    throw new UpstreamError(`Service IGN injoignable (${(e as Error).message})`);
  });
  if (!res.ok) throw new UpstreamError(`Service IGN : réponse ${res.status}`, res.status === 404 ? 404 : 502);
  return res.json() as Promise<T>;
}

// ───────────── Géocodage ─────────────

export interface AddressSuggestion {
  label: string;
  numero: string;
  voie: string;
  codePostal: string;
  localite: string;
  codeInsee: string;
  lat: number;
  lon: number;
}

interface GeocodeFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string; housenumber?: string; street?: string; name?: string; postcode?: string; city?: string; citycode?: string };
}

export async function geocode(q: string): Promise<AddressSuggestion[]> {
  const url = `${GEOPF}/geocodage/search?index=address&limit=6&autocomplete=1&q=${encodeURIComponent(q)}`;
  const data = await getJson<{ features: GeocodeFeature[] }>(url, 3600);
  return data.features.map(({ geometry, properties: p }) => ({
    label: p.label,
    numero: p.housenumber ?? '',
    voie: p.street ?? (p.housenumber ? '' : p.name ?? ''),
    codePostal: p.postcode ?? '',
    localite: p.city ?? '',
    codeInsee: p.citycode ?? '',
    lon: geometry.coordinates[0],
    lat: geometry.coordinates[1],
  }));
}

// ───────────── Cadastre (API Carto, module cadastre — PCI Express) ─────────────

export interface ParcelleFeature {
  idu: string;
  prefixe: string;
  section: string;
  numero: string;
  contenance: number;
  codeInsee: string;
  commune: string;
  geometry: Polygon | MultiPolygon;
}

interface ApiCartoParcelle {
  geometry: Polygon | MultiPolygon;
  properties: {
    idu: string; numero: string; section: string; com_abs?: string; code_insee: string;
    nom_com: string; contenance: number;
  };
}

const toParcelle = (f: ApiCartoParcelle): ParcelleFeature => ({
  idu: f.properties.idu,
  prefixe: f.properties.com_abs ?? '000',
  section: f.properties.section,
  numero: f.properties.numero,
  contenance: f.properties.contenance,
  codeInsee: f.properties.code_insee,
  commune: f.properties.nom_com,
  geometry: f.geometry,
});

async function parcelles(params: Record<string, string>): Promise<ParcelleFeature[]> {
  const qs = new URLSearchParams({ ...params, source_ign: 'PCI', _limit: '500' });
  const data = await getJson<{ features: ApiCartoParcelle[] }>(`${APICARTO}/cadastre/parcelle?${qs}`);
  return data.features.map(toParcelle);
}

export function parcelleAt(lon: number, lat: number) {
  return parcelles({ geom: JSON.stringify({ type: 'Point', coordinates: [lon, lat] }) });
}

export function parcelleByReference(codeInsee: string, section: string, numero: string) {
  return parcelles({
    code_insee: codeInsee,
    section: section.toUpperCase().padStart(2, '0'),
    numero: numero.padStart(4, '0'),
  });
}

export function parcellesInBox([minLon, minLat, maxLon, maxLat]: number[]) {
  const ring = [[minLon, minLat], [maxLon, minLat], [maxLon, maxLat], [minLon, maxLat], [minLon, minLat]];
  return parcelles({ geom: JSON.stringify({ type: 'Polygon', coordinates: [ring] }) });
}

// ───────────── Bâtiments (BD TOPO, WFS Géoplateforme) ─────────────

export async function batimentsInBox([minLon, minLat, maxLon, maxLat]: number[]): Promise<Polygon[]> {
  const qs = new URLSearchParams({
    SERVICE: 'WFS', VERSION: '2.0.0', REQUEST: 'GetFeature',
    TYPENAMES: 'BDTOPO_V3:batiment', OUTPUTFORMAT: 'application/json', SRSNAME: 'EPSG:4326',
    BBOX: `${minLat},${minLon},${maxLat},${maxLon},urn:ogc:def:crs:EPSG::4326`, COUNT: '300',
  });
  const data = await getJson<{ features: { geometry: Polygon | MultiPolygon }[] }>(`${GEOPF}/wfs/ows?${qs}`);
  // BD TOPO peut renvoyer des coordonnées 3D : on ne garde que x, y.
  const flat = (rings: number[][][]) => rings.map((r) => r.map(([x, y]) => [x, y] as [number, number]));
  return data.features.flatMap(({ geometry: g }) =>
    g.type === 'Polygon'
      ? [{ type: 'Polygon' as const, coordinates: flat(g.coordinates) }]
      : g.coordinates.map((c) => ({ type: 'Polygon' as const, coordinates: flat(c) })),
  );
}

// ───────────── Tuiles WMTS ─────────────

export const TILE_LAYERS = {
  plan: { layer: 'GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2', style: 'normal', format: 'image/png' },
  ortho: { layer: 'ORTHOIMAGERY.ORTHOPHOTOS', style: 'normal', format: 'image/jpeg' },
  cadastre: { layer: 'CADASTRALPARCELS.PARCELLAIRE_EXPRESS', style: 'PCI vecteur', format: 'image/png' },
} as const;
export type TileLayer = keyof typeof TILE_LAYERS;

export function tileUrl(layer: TileLayer, z: number, x: number, y: number): string {
  const l = TILE_LAYERS[layer];
  const qs = new URLSearchParams({
    SERVICE: 'WMTS', REQUEST: 'GetTile', VERSION: '1.0.0', LAYER: l.layer, STYLE: l.style,
    TILEMATRIXSET: 'PM', FORMAT: l.format, TILEMATRIX: String(z), TILEROW: String(y), TILECOL: String(x),
  });
  return `${GEOPF}/wmts?${qs}`;
}
