#!/usr/bin/env node
/**
 * Convertit les plans DWG du Pavillon N°1 (dossier assets/dwg) en SVG
 * à l'échelle réelle, utilisés tels quels dans les pièces DP3 / DP4 et le plan.
 *
 *   npm run assets:module
 *
 * - Lecture DWG : libredwg compilé en WebAssembly (@mlightcad/libredwg-web).
 * - Les blocs (INSERT) sont développés récursivement avec leurs transformations.
 * - Unités de sortie : le viewBox est en millimètres, origine = angle bas-gauche
 *   du module (x vers la droite, y vers le bas, sol fini à y = 0).
 * - Un manifeste JSON (public/module/manifest.json) décrit chaque dessin.
 */
import { Dwg_File_Type, LibreDwg } from '@mlightcad/libredwg-web';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/dwg');
const OUT = path.join(root, 'public/module');

/** Layer whose extents define the module envelope in every drawing. */
const WALLS = '_Murs - Extérieurs';

const DRAWINGS = [
  { id: 'facade-n4', file: 'N4-facade.dwg', title: 'Façade N4 — entrée', kind: 'facade', margin: 900 },
  { id: 'facade-n2', file: 'N2-facade.dwg', title: 'Façade N2 — pignon', kind: 'facade', margin: 900 },
  { id: 'facade-n3', file: 'N3-facade.dwg', title: 'Façade N3 — pignon', kind: 'facade', margin: 900 },
  { id: 'coupe-c19', file: 'C19-coupe.dwg', title: 'Coupe longitudinale C19', kind: 'coupe', margin: 900, lighten: 0.45 },
  { id: 'coupe-c20', file: 'C20-coupe.dwg', title: 'Coupe transversale C20', kind: 'coupe', margin: 900, lighten: 0.45, maxY: 2900 },
  {
    id: 'plan', file: 'LAD-NASCO-PLN.dwg', title: 'Plan du Pavillon N°1', kind: 'plan', margin: 700,
    crop: [-5020000, -2633000, -5005000, -2620000],
    skipLayers: ['Eq tech', 'Etiquettes', 'Annotations'],
  },
];

// ───────────────────────── geometry helpers ─────────────────────────
const I = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const mul = (m, n) => ({
  a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
});
const translate = (x, y) => ({ ...I, e: x, f: y });
const scale = (sx, sy) => ({ ...I, a: sx, d: sy });
const rotate = (r) => ({ a: Math.cos(r), b: Math.sin(r), c: -Math.sin(r), d: Math.cos(r), e: 0, f: 0 });
const apply = (m, p) => [m.a * p.x + m.c * p.y + m.e, m.b * p.x + m.d * p.y + m.f];

function arc(m, cx, cy, r, a0, a1, rx = r, rot = 0) {
  if (a1 < a0) a1 += Math.PI * 2;
  const n = Math.max(8, Math.ceil((a1 - a0) / (Math.PI / 24)));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + ((a1 - a0) * i) / n;
    const lx = rx * Math.cos(t), ly = r * Math.sin(t);
    pts.push(apply(m, { x: cx + lx * Math.cos(rot) - ly * Math.sin(rot), y: cy + lx * Math.sin(rot) + ly * Math.cos(rot) }));
  }
  return pts;
}

function bulged(m, vertices, closed) {
  const pts = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    pts.push(apply(m, p));
    if (!closed && i === n - 1) break;
    const q = vertices[(i + 1) % n];
    const bulge = p.bulge || 0;
    if (Math.abs(bulge) < 1e-9) continue;
    const theta = 4 * Math.atan(bulge);
    const dx = q.x - p.x, dy = q.y - p.y, chord = Math.hypot(dx, dy);
    const r = chord / (2 * Math.sin(theta / 2));
    const h = r * Math.cos(theta / 2);
    const cx = (p.x + q.x) / 2 - (h * dy) / chord, cy = (p.y + q.y) / 2 + (h * dx) / chord;
    const a0 = Math.atan2(p.y - cy, p.x - cx);
    for (let k = 1; k < 12; k++) {
      const t = a0 + (theta * k) / 12;
      pts.push(apply(m, { x: cx + Math.abs(r) * Math.cos(t), y: cy + Math.abs(r) * Math.sin(t) }));
    }
  }
  if (closed && pts.length) pts.push(pts[0]);
  return pts;
}

function bspline(e) {
  const cp = e.controlPoints || [], k = e.knots || [], d = e.degree || 3;
  if (cp.length < 2) return (e.fitPoints || []).map((p) => ({ x: p.x, y: p.y }));
  const out = [];
  const n = cp.length * 8, t0 = k[d], t1 = k[k.length - d - 1];
  for (let s = 0; s <= n; s++) {
    const t = Math.min(t0 + ((t1 - t0) * s) / n, t1 - 1e-9);
    let i = d;
    while (i < k.length - d - 2 && t >= k[i + 1]) i++;
    const D = [];
    for (let j = 0; j <= d; j++) D.push({ ...cp[i - d + j] });
    for (let r = 1; r <= d; r++)
      for (let j = d; j >= r; j--) {
        const a = (t - k[i - d + j]) / (k[i + 1 + j - r] - k[i - d + j] || 1);
        D[j] = { x: (1 - a) * D[j - 1].x + a * D[j].x, y: (1 - a) * D[j - 1].y + a * D[j].y };
      }
    out.push(D[d]);
  }
  return out;
}

const cleanText = (t) =>
  (t || '').replace(/\\P/g, '\n').replace(/\\[A-Za-z][^;\\{}]*;/g, '').replace(/[{}]/g, '').replace(/\\~/g, ' ').trim();
const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ───────────────────────── renderer ─────────────────────────
function render(db, cfg) {
  const blocks = Object.fromEntries(db.tables.BLOCK_RECORD.entries.map((b) => [b.name, b]));
  const hiddenLayers = new Set(db.tables.LAYER.entries.filter((l) => l.off || l.frozen).map((l) => l.name));
  const skip = (layer) => hiddenLayers.has(layer) || (cfg.skipLayers || []).some((s) => layer?.includes(s));

  /** @type {{kind:'line'|'fill'|'text', pts?:number[][], rings?:number[][][], color?:string, text?:string, size?:number, layer:string}[]} */
  const items = [];

  const colorOf = (e) => {
    const c = e.color != null && e.color >= 0 ? e.color : 0xbbbbbb;
    const L = cfg.lighten || 0;
    const g = Math.round([0.3, 0.59, 0.11].reduce((s, w, i) => s + w * ((c >> (16 - 8 * i)) & 255), 0));
    const v = Math.round(g + (255 - g) * L);
    return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
  };

  let depth = 0;
  function draw(e, m) {
    if (e.isVisible === false || skip(e.layer)) return;
    const layer = e.layer;
    switch (e.type) {
      case 'LINE':
        items.push({ kind: 'line', layer, pts: [apply(m, e.startPoint), apply(m, e.endPoint)] });
        break;
      case 'LWPOLYLINE':
      case 'POLYLINE2D':
        items.push({ kind: 'line', layer, pts: bulged(m, e.vertices || [], (e.flag & 1) === 1) });
        break;
      case 'ARC':
        items.push({ kind: 'line', layer, pts: arc(m, e.center.x, e.center.y, e.radius, e.startAngle, e.endAngle) });
        break;
      case 'CIRCLE':
        items.push({ kind: 'line', layer, pts: arc(m, e.center.x, e.center.y, e.radius, 0, Math.PI * 2) });
        break;
      case 'ELLIPSE': {
        const R = Math.hypot(e.majorAxisEndPoint.x, e.majorAxisEndPoint.y);
        const rot = Math.atan2(e.majorAxisEndPoint.y, e.majorAxisEndPoint.x);
        items.push({ kind: 'line', layer, pts: arc(m, e.center.x, e.center.y, R * e.axisRatio, e.startAngle, e.endAngle || Math.PI * 2, R, rot) });
        break;
      }
      case 'SPLINE':
        items.push({ kind: 'line', layer, pts: bspline(e).map((p) => apply(m, p)) });
        break;
      case 'LEADER':
        items.push({ kind: 'line', layer, pts: (e.vertices || []).map((v) => apply(m, v)) });
        break;
      case 'HATCH': {
        const rings = (e.boundaryPaths || [])
          .map((bp) => {
            if (bp.vertices) return bulged(m, bp.vertices, true);
            const pts = [];
            for (const ed of bp.edges || []) {
              if (ed.start && ed.end) pts.push(apply(m, ed.start), apply(m, ed.end));
              else if (ed.center) pts.push(...arc(m, ed.center.x, ed.center.y, ed.radius, ed.startAngle, ed.endAngle));
            }
            return pts;
          })
          .filter((r) => r.length > 2);
        if (rings.length) items.push({ kind: 'fill', layer, rings, color: e.solidFill ? colorOf(e) : '#dddddd' });
        break;
      }
      case 'MTEXT':
      case 'TEXT':
      case 'ATTRIB': {
        const raw = e.type === 'ATTRIB' ? e.text?.text : typeof e.text === 'string' ? e.text : '';
        const text = cleanText(raw).split('\n')[0];
        if (!text || /\\A1|MUR_|^0,0\d\\/.test(text)) break;
        const p = e.type === 'ATTRIB' ? e.text.startPoint : e.insertionPoint || e.startPoint;
        const size = (e.textHeight || e.text?.textHeight || 100) * Math.hypot(m.a, m.b);
        items.push({ kind: 'text', layer, pts: [apply(m, p)], text, size });
        break;
      }
      case 'DIMENSION': {
        const b = blocks[e.name];
        for (const c of b?.entities || []) draw(c, m);
        break;
      }
      case 'INSERT': {
        const b = blocks[e.name];
        if (!b || depth > 12) break;
        const bp = b.basePoint || { x: 0, y: 0 };
        const flip = e.extrusionDirection?.z < 0 ? -1 : 1;
        for (let ci = 0; ci < (e.columnCount || 1); ci++)
          for (let ri = 0; ri < (e.rowCount || 1); ri++) {
            let t = translate(e.insertionPoint.x, e.insertionPoint.y);
            t = mul(t, scale(flip, 1));
            t = mul(t, rotate(e.rotation || 0));
            t = mul(t, translate(ci * (e.columnSpacing || 0), ri * (e.rowSpacing || 0)));
            t = mul(t, scale(e.xScale || 1, e.yScale || 1));
            t = mul(t, translate(-bp.x, -bp.y));
            depth++;
            for (const c of b.entities || []) draw(c, mul(m, t));
            depth--;
          }
        for (const a of e.attribs || []) draw(a, m);
        break;
      }
    }
  }

  const model = blocks['*Model_Space']?.entities || db.entities;
  for (const e of model) draw(e, I);

  const bboxOf = (it) => {
    const all = it.kind === 'fill' ? it.rings.flat() : it.pts;
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [x, y] of all) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
    return b;
  };
  let kept = items.filter((it) => {
    const b = bboxOf(it);
    if (!b.every(Number.isFinite)) return false;
    if (cfg.crop) return b[0] >= cfg.crop[0] && b[2] <= cfg.crop[2] && b[1] >= cfg.crop[1] && b[3] <= cfg.crop[3];
    return true;
  });

  // Envelope of the module walls → origin and frame.
  const walls = kept.filter((it) => it.layer === WALLS).map(bboxOf);
  const env = walls.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const ox = env[0];
  const oy = cfg.kind === 'plan' ? env[3] : 0; // élévations : y = 0 au sol fini
  if (cfg.maxY != null) kept = kept.filter((it) => bboxOf(it)[3] <= cfg.maxY);

  const all = kept.map(bboxOf);
  const content = all.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const mg = cfg.margin;
  // Elevations: frame horizontally on the module, vertically on content.
  const frame =
    cfg.kind === 'plan'
      ? [content[0] - mg, content[1] - mg, content[2] + mg, content[3] + mg]
      : [env[0] - mg, Math.min(content[1], -300) - 150, env[2] + mg, content[3] + 250];

  const fx = (x) => (x - ox).toFixed(1);
  const fy = (y) => (oy - y).toFixed(1);
  const pointsAttr = (pts) => pts.map(([x, y]) => `${fx(x)},${fy(y)}`).join(' ');
  const body = kept
    .map((it) => {
      if (it.kind === 'line') return `<polyline points="${pointsAttr(it.pts)}"/>`;
      if (it.kind === 'fill')
        return `<path class="f" fill="${it.color}" d="${it.rings.map((r) => 'M' + pointsAttr(r).replace(/ /g, 'L') + 'Z').join('')}"/>`;
      const [x, y] = it.pts[0];
      return `<text x="${fx(x)}" y="${fy(y)}" font-size="${it.size.toFixed(0)}">${escapeXml(it.text)}</text>`;
    })
    .join('\n');

  const vb = { x: frame[0] - ox, y: oy - frame[3], width: frame[2] - frame[0], height: frame[3] - frame[1] };
  if (cfg.kind !== 'plan') {
    vb.y = -(frame[3] - 0);
    vb.height = frame[3] - frame[1];
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x.toFixed(0)} ${vb.y.toFixed(0)} ${vb.width.toFixed(0)} ${vb.height.toFixed(0)}" width="${(vb.width / 10).toFixed(0)}mm" height="${(vb.height / 10).toFixed(0)}mm">
<!-- ${cfg.title} — généré depuis ${cfg.file} — unités : mm -->
<style>polyline{fill:none;stroke:#141414;stroke-width:9;stroke-linejoin:round;stroke-linecap:round}.f{stroke:none;fill-rule:evenodd}text{font-family:Helvetica,Arial,sans-serif;fill:#141414}</style>
<rect x="${vb.x.toFixed(0)}" y="${vb.y.toFixed(0)}" width="${vb.width.toFixed(0)}" height="${vb.height.toFixed(0)}" fill="#fff"/>
${body}
</svg>`;
  return {
    svg,
    meta: {
      id: cfg.id, title: cfg.title, kind: cfg.kind, source: cfg.file,
      viewBox: [Math.round(vb.x), Math.round(vb.y), Math.round(vb.width), Math.round(vb.height)],
      envelope: { width: Math.round(env[2] - env[0]), height: Math.round(env[3] - env[1]) },
    },
  };
}

const lib = await LibreDwg.create(path.join(root, 'node_modules/@mlightcad/libredwg-web/wasm/'));
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];
for (const cfg of DRAWINGS) {
  const data = lib.dwg_read_data(fs.readFileSync(path.join(SRC, cfg.file)), Dwg_File_Type.DWG);
  const db = lib.convert(data);
  const { svg, meta } = render(db, cfg);
  lib.dwg_free(data);
  fs.writeFileSync(path.join(OUT, `${cfg.id}.svg`), svg);
  manifest.push(meta);
  console.log(`✓ ${cfg.id.padEnd(10)} ${meta.envelope.width} × ${meta.envelope.height} mm  (${(svg.length / 1024).toFixed(0)} ko)`);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
