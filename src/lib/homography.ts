/**
 * Homographie carré unité → quadrilatère (Heckbert, 1989), et rendu d'une image
 * déformée en perspective sur un canvas 2D par maillage de triangles affines.
 */
export type Pt = [number, number];
/** Coins : haut-gauche, haut-droit, bas-droit, bas-gauche. */
export type Quad4 = [Pt, Pt, Pt, Pt];

export type Mapper = (u: number, v: number) => Pt;

export function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: Quad4): Mapper {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u, v) => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

/** Dessine `img` (ou une zone source) déformée sur le quadrilatère `quad`. */
export function drawWarped(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, quad: Quad4, steps = 12) {
  const map = squareToQuad(quad);
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) {
      const u0 = i / steps, u1 = (i + 1) / steps, v0 = j / steps, v1 = (j + 1) / steps;
      const s = [
        [u0 * iw, v0 * ih], [u1 * iw, v0 * ih], [u1 * iw, v1 * ih], [u0 * iw, v1 * ih],
      ] as Pt[];
      const d = [map(u0, v0), map(u1, v0), map(u1, v1), map(u0, v1)];
      triangle(ctx, img, s[0], s[1], s[2], d[0], d[1], d[2]);
      triangle(ctx, img, s[0], s[2], s[3], d[0], d[2], d[3]);
    }
}

function triangle(ctx: CanvasRenderingContext2D, img: CanvasImageSource, s0: Pt, s1: Pt, s2: Pt, d0: Pt, d1: Pt, d2: Pt) {
  // Léger agrandissement du triangle de découpe pour masquer les jointures.
  const cx = (d0[0] + d1[0] + d2[0]) / 3, cy = (d0[1] + d1[1] + d2[1]) / 3;
  const grow = (p: Pt): Pt => {
    const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / l) * 0.6, p[1] + (dy / l) * 0.6];
  };
  const [e0, e1, e2] = [grow(d0), grow(d1), grow(d2)];
  // Transformation affine source → destination.
  const den = s0[0] * (s1[1] - s2[1]) + s1[0] * (s2[1] - s0[1]) + s2[0] * (s0[1] - s1[1]);
  if (Math.abs(den) < 1e-9) return;
  const a = (d0[0] * (s1[1] - s2[1]) + d1[0] * (s2[1] - s0[1]) + d2[0] * (s0[1] - s1[1])) / den;
  const b = (d0[1] * (s1[1] - s2[1]) + d1[1] * (s2[1] - s0[1]) + d2[1] * (s0[1] - s1[1])) / den;
  const c = (d0[0] * (s2[0] - s1[0]) + d1[0] * (s0[0] - s2[0]) + d2[0] * (s1[0] - s0[0])) / den;
  const d = (d0[1] * (s2[0] - s1[0]) + d1[1] * (s0[0] - s2[0]) + d2[1] * (s1[0] - s0[0])) / den;
  const e =
    (d0[0] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[0] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[0] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  const f =
    (d0[1] * (s1[0] * s2[1] - s2[0] * s1[1]) + d1[1] * (s2[0] * s0[1] - s0[0] * s2[1]) + d2[1] * (s0[0] * s1[1] - s1[0] * s0[1])) / den;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(e0[0], e0[1]);
  ctx.lineTo(e1[0], e1[1]);
  ctx.lineTo(e2[0], e2[1]);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

export function pointInQuad(p: Pt, q: Quad4): boolean {
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = q[i], [xj, yj] = q[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
