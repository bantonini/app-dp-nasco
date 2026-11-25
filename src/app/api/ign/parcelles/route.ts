import { parcelleAt, parcelleByReference, parcellesInBox } from '@/lib/geo/ign-server';
import { badRequest, parseBox, respond } from '../_respond';

/**
 * GET /api/ign/parcelles?lon=..&lat=..            → parcelle sous le point
 * GET /api/ign/parcelles?insee=..&section=..&numero=..
 * GET /api/ign/parcelles?bbox=minLon,minLat,maxLon,maxLat
 */
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const box = parseBox(p.get('bbox'));
  if (box) return respond(() => parcellesInBox(box));
  const lon = Number(p.get('lon')), lat = Number(p.get('lat'));
  if (p.has('lon') && Number.isFinite(lon) && Number.isFinite(lat)) return respond(() => parcelleAt(lon, lat));
  const insee = p.get('insee'), section = p.get('section'), numero = p.get('numero');
  if (insee && section && numero) {
    if (!/^\d[\dAB]\d{3}$/.test(insee)) return badRequest('Code INSEE invalide.');
    return respond(() => parcelleByReference(insee, section, numero));
  }
  return badRequest('Paramètres attendus : lon & lat, insee & section & numero, ou bbox.');
}
