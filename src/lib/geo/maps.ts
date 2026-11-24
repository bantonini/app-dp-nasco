/**
 * Composition de cartes à partir des tuiles WMTS (Web Mercator) de la Géoplateforme,
 * à une échelle d'impression exacte. Utilisé pour le DP1 et le fond du DP2.
 */
import type { Position } from './geometry';

export type MapLayer = 'plan' | 'ortho' | 'cadastre';

const TILE = 256;
const R = 6378137;
const RAD = Math.PI / 180;

export function metersPerPixel(lat: number, zoom: number) {
  return (Math.cos(lat * RAD) * 2 * Math.PI * R) / (TILE * 2 ** zoom);
}

function worldPixel([lon, lat]: Position, zoom: number) {
  const size = TILE * 2 ** zoom;
  const s = Math.sin(lat * RAD);
  return { x: ((lon + 180) / 360) * size, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * size };
}

export interface MapRequest {
  center: { lat: number; lon: number };
  /** Emprise couverte au sol (m). */
  widthM: number;
  heightM: number;
  layers: MapLayer[];
  zoom: number;
}

export interface RenderedMap {
  canvas: HTMLCanvasElement;
  /** Projette un point WGS84 en pixels du canvas. */
  project: (p: Position) => { x: number; y: number };
  metersPerPixel: number;
  /** Nombre de tuiles qui n'ont pas pu être chargées. */
  failedTiles: number;
}

const tileCache = new Map<string, Promise<HTMLImageElement | null>>();

function loadTile(layer: MapLayer, z: number, x: number, y: number) {
  const key = `${layer}/${z}/${x}/${y}`;
  let p = tileCache.get(key);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = `/api/ign/tuiles/${key}`;
    });
    tileCache.set(key, p);
    p.then((img) => img || tileCache.delete(key));
  }
  return p;
}

export async function renderMap(req: MapRequest): Promise<RenderedMap> {
  const { center, zoom } = req;
  const mpp = metersPerPixel(center.lat, zoom);
  const w = Math.round(req.widthM / mpp);
  const h = Math.round(req.heightM / mpp);
  const c = worldPixel([center.lon, center.lat], zoom);
  const origin = { x: c.x - w / 2, y: c.y - h / 2 };

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f1f0ea';
  ctx.fillRect(0, 0, w, h);

  const max = 2 ** zoom;
  const tx0 = Math.floor(origin.x / TILE), tx1 = Math.floor((origin.x + w) / TILE);
  const ty0 = Math.max(0, Math.floor(origin.y / TILE)), ty1 = Math.min(max - 1, Math.floor((origin.y + h) / TILE));
  let failedTiles = 0;
  for (const layer of req.layers) {
    const jobs: Promise<void>[] = [];
    for (let tx = tx0; tx <= tx1; tx++)
      for (let ty = ty0; ty <= ty1; ty++)
        jobs.push(
          loadTile(layer, zoom, ((tx % max) + max) % max, ty).then((img) => {
            if (img) ctx.drawImage(img, tx * TILE - origin.x, ty * TILE - origin.y);
            else failedTiles++;
          }),
        );
    await Promise.all(jobs);
  }
  if (failedTiles) drawUnavailable(ctx, w, h);

  return {
    canvas,
    metersPerPixel: mpp,
    failedTiles,
    project: (p) => {
      const q = worldPixel(p, zoom);
      return { x: q.x - origin.x, y: q.y - origin.y };
    },
  };
}

function drawUnavailable(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  for (let i = -h; i < w; i += 24) {
    ctx.beginPath();
    ctx.moveTo(i, h);
    ctx.lineTo(i + h, 0);
    ctx.stroke();
  }
  ctx.restore();
}

/** Zoom de tuiles adapté à une échelle d'impression (≈ 150–250 dpi). */
export function zoomForScale(scale: number, lat: number, dpi = 180): number {
  const target = (scale * 0.0254) / dpi;
  let z = 10;
  while (z < 19 && metersPerPixel(lat, z + 1) >= target * 0.75) z++;
  return z;
}

export function drawLocationMarker(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.lineWidth = size / 5;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = size / 9;
  ctx.strokeStyle = '#d0021b';
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.moveTo(x - size * 1.6, y);
  ctx.lineTo(x - size * 0.4, y);
  ctx.moveTo(x + size * 0.4, y);
  ctx.lineTo(x + size * 1.6, y);
  ctx.moveTo(x, y - size * 1.6);
  ctx.lineTo(x, y - size * 0.4);
  ctx.moveTo(x, y + size * 0.4);
  ctx.lineTo(x, y + size * 1.6);
  ctx.stroke();
  ctx.restore();
}

export function drawRings(
  ctx: CanvasRenderingContext2D,
  rings: Position[][],
  project: (p: Position) => { x: number; y: number },
  style: { stroke: string; width: number; fill?: string; dash?: number[] },
) {
  ctx.save();
  ctx.beginPath();
  for (const ring of rings)
    ring.forEach((p, i) => {
      const q = project(p);
      if (i) ctx.lineTo(q.x, q.y);
      else ctx.moveTo(q.x, q.y);
    });
  ctx.closePath();
  if (style.fill) {
    ctx.fillStyle = style.fill;
    ctx.fill('evenodd');
  }
  ctx.setLineDash(style.dash ?? []);
  ctx.lineWidth = style.width;
  ctx.strokeStyle = style.stroke;
  ctx.stroke();
  ctx.restore();
}
