import type { Insertion, Quad } from './dossier';
import { drawWarped, type Quad4 } from './homography';

export interface CompositeParams {
  photo: CanvasImageSource;
  width: number;
  height: number;
  sprite: CanvasImageSource;
  spriteWidth: number;
  spriteHeight: number;
  /** Coins en pixels du canvas de sortie. */
  quad: Quad4;
  adjust: Pick<Insertion, 'brightness' | 'contrast' | 'saturation' | 'shadow'>;
  /** Masque (taille quelconque, étiré) : pixels opaques = module effacé. */
  mask?: CanvasImageSource | null;
}

/** Rendu du photomontage : photo + ombre + module déformé, moins le masque. */
export function renderComposite(ctx: CanvasRenderingContext2D, p: CompositeParams) {
  const { width: w, height: h } = p;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(p.photo, 0, 0, w, h);

  const layer = document.createElement('canvas');
  layer.width = w;
  layer.height = h;
  const l = layer.getContext('2d')!;

  // Ombre de contact au pied du module.
  if (p.adjust.shadow > 0) {
    const [, , br, bl] = p.quad;
    const depth = Math.max(4, Math.hypot(br[0] - bl[0], br[1] - bl[1]) * 0.035);
    const blur = Math.max(2, depth * 0.9);
    l.save();
    l.filter = `blur(${blur.toFixed(1)}px)`;
    l.fillStyle = `rgba(20,16,10,${p.adjust.shadow})`;
    l.beginPath();
    l.moveTo(bl[0] - depth, bl[1] - depth * 0.6);
    l.lineTo(br[0] + depth, br[1] - depth * 0.6);
    l.lineTo(br[0] + depth * 1.6, br[1] + depth * 0.7);
    l.lineTo(bl[0] - depth * 1.6, bl[1] + depth * 0.7);
    l.closePath();
    l.fill();
    l.restore();
  }

  l.save();
  const { brightness, contrast, saturation } = p.adjust;
  l.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation})`;
  // Les filtres s'appliquent par appel drawImage : on rend d'abord le module sur un calque intermédiaire.
  const warped = document.createElement('canvas');
  warped.width = w;
  warped.height = h;
  drawWarped(warped.getContext('2d')!, p.sprite, p.spriteWidth, p.spriteHeight, p.quad, 14);
  l.drawImage(warped, 0, 0);
  l.restore();

  if (p.mask) {
    l.save();
    l.globalCompositeOperation = 'destination-out';
    l.drawImage(p.mask, 0, 0, w, h);
    l.restore();
  }
  ctx.drawImage(layer, 0, 0);
}

/** Position initiale : module centré, posé aux deux tiers de la hauteur de la photo. */
export function defaultCorners(photoRatio: number, spriteRatio: number): Quad {
  const w = 0.46;
  const hRel = (w / spriteRatio) * photoRatio;
  const x0 = 0.5 - w / 2, x1 = 0.5 + w / 2;
  const yb = 0.72, yt = yb - hRel;
  return [[x0, yt], [x1, yt], [x1, yb], [x0, yb]];
}

export const toPixels = (q: Quad, w: number, h: number): Quad4 => q.map(([x, y]) => [x * w, y * h]) as Quad4;
export const toRelative = (q: Quad4, w: number, h: number): Quad => q.map(([x, y]) => [x / w, y / h]) as Quad;
