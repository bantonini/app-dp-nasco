import { TILE_LAYERS, tileUrl, type TileLayer } from '@/lib/geo/ign-server';

/** Relais des tuiles WMTS de la Géoplateforme (même origine → export canvas/PDF possible). */
export async function GET(_req: Request, ctx: { params: Promise<{ layer: string; z: string; x: string; y: string }> }) {
  const { layer, z, x, y } = await ctx.params;
  const [zi, xi, yi] = [z, x, y].map((v) => Number.parseInt(v, 10));
  if (!(layer in TILE_LAYERS) || ![zi, xi, yi].every(Number.isInteger) || zi < 0 || zi > 20) {
    return new Response('Tuile invalide', { status: 400 });
  }
  const upstream = await fetch(tileUrl(layer as TileLayer, zi, xi, yi), { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!upstream?.ok) return new Response('Tuile indisponible', { status: 502 });
  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') ?? 'image/png',
      'Cache-Control': 'public, max-age=604800, s-maxage=2592000, immutable',
    },
  });
}
