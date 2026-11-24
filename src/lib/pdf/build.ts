import { PDFDocument, StandardFonts, type PDFImage } from 'pdf-lib';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SitePlanSvg } from '@/components/plan/site-plan-svg';
import { declarantName, formatAddress, parcelLabel, type Dossier, type FileRef } from '../dossier';
import { cardinal, outerRings } from '../geo/geometry';
import { drawLocationMarker, drawRings, renderMap, zoomForScale } from '../geo/maps';
import { canvasToBlob, rasterizeSvg } from '../images';
import { DRAWINGS, FACADE_NORMALS, MODULE, type DrawingId } from '../module';
import { buildSitePlan, fitScale } from '../site-plan';
import { repository } from '../storage';
import { cerfaPages } from './cerfa';
import { A4_LANDSCAPE, COLORS, niceBarLength, Sheet, type Fonts } from './sheet';

export interface BuildProgress {
  step: string;
  done: number;
  total: number;
}

/** Zone de dessin des planches paysage (mm). */
const AREA = { x: 12, y: 12, w: 212, h: 186 };
const DPI = 200;

interface PieceInfo {
  code: string;
  title: string;
  scale?: string;
  notes?: string[];
  legend?: { label: string; swatch: 'module' | 'parcel' | 'neighbour' | 'building' | 'viewpoint' }[];
}

/**
 * Construit le dossier complet de déclaration préalable (PDF), entièrement
 * dans le navigateur : récapitulatif Cerfa, DP1 à DP8.
 */
export async function buildDossierPdf(d: Dossier, onProgress?: (p: BuildProgress) => void): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Déclaration préalable — ${MODULE.name} — ${declarantName(d)}`);
  pdf.setAuthor('NASCO');
  pdf.setSubject(`Dossier ${d.reference}`);
  pdf.setCreator('NASCO — application DP');
  pdf.setLanguage('fr-FR');
  const fonts: Fonts = { regular: await pdf.embedFont(StandardFonts.Helvetica), bold: await pdf.embedFont(StandardFonts.HelveticaBold) };

  const jobs: [string, () => Promise<void>][] = [
    ['Page de garde', () => coverPage(pdf, fonts, d)],
    ['Formulaire Cerfa', () => cerfaPages(pdf, fonts, d)],
    ['DP1 — Plan de situation', () => dp1(pdf, fonts, d)],
    ['DP2 — Plan de masse', () => dp2(pdf, fonts, d)],
    ['DP3 — Coupes', () => drawingsPage(pdf, fonts, d, 'DP3', 'Plan en coupe du terrain et de la construction', ['coupe-c19', 'coupe-c20'])],
    ['DP4 — Façades', () => drawingsPage(pdf, fonts, d, 'DP4', 'Plan des façades et des toitures', ['facade-n4', 'facade-n2', 'facade-n3'])],
    ['DP4 — Plan du module', () => modulePlanPage(pdf, fonts, d)],
    ['DP6 — Insertion paysagère', () => photoPage(pdf, fonts, d, 'DP6', 'Document graphique d’insertion du projet', d.insertion.result, 'Photomontage du Pavillon N°1 dans son environnement.')],
    ['DP7 — Environnement proche', () => photoPage(pdf, fonts, d, 'DP7', 'Photographie de l’environnement proche', d.photos.dp7, 'Point de vue DP7 reporté sur le plan de masse (DP2).')],
    ['DP8 — Paysage lointain', () => photoPage(pdf, fonts, d, 'DP8', 'Photographie du paysage lointain', d.photos.dp8, 'Point de vue DP8 reporté sur le plan de masse (DP2).')],
  ];
  for (const [i, [step, job]] of jobs.entries()) {
    onProgress?.({ step, done: i, total: jobs.length });
    await job();
  }
  numberPages(pdf, fonts, d);
  onProgress?.({ step: 'Terminé', done: jobs.length, total: jobs.length });
  return pdf.save();
}

// ───────────────────────── Cadre & cartouche ─────────────────────────

function landscape(pdf: PDFDocument, fonts: Fonts, d: Dossier, info: PieceInfo) {
  const s = new Sheet(pdf.addPage(A4_LANDSCAPE.map((v) => v * (72 / 25.4)) as [number, number]), fonts);
  s.rect(6, 6, 285, 198, { stroke: COLORS.ink, width: 0.6 });
  const x = 232, w = 53;
  s.line(x - 3, 6, x - 3, 204, { width: 0.6 });

  s.text(x, 17, 'NASCO.', { size: 15, bold: true, tracking: 0.9 });
  s.text(x, 22.5, `${MODULE.name} · Déclaration préalable`, { size: 6.8, color: COLORS.muted });

  s.rect(x, 28, w, 17, { fill: COLORS.green });
  s.text(x + 3.5, 40.5, info.code, { size: 22, bold: true, color: COLORS.cream });
  let y = s.paragraph(x, 53, w, info.title, { size: 10.5, bold: true, leading: 4.6 });
  if (info.scale) {
    s.text(x, y + 1.5, `Échelle : ${info.scale}`, { size: 8 });
    y += 6;
  }
  y += 3;
  if (info.legend?.length) {
    s.line(x, y, x + w, y, { color: COLORS.line });
    y += 5;
    s.text(x, y, 'LÉGENDE', { size: 6.5, bold: true, color: COLORS.muted });
    y += 5;
    for (const item of info.legend) {
      swatch(s, x, y - 2.6, item.swatch);
      y = s.paragraph(x + 9, y, w - 9, item.label, { size: 7, leading: 3.2 }) + 1.6;
    }
  }
  if (info.notes?.length) {
    s.line(x, y, x + w, y, { color: COLORS.line });
    y += 5;
    for (const n of info.notes) y = s.paragraph(x, y, w, n, { size: 7, leading: 3.2, color: COLORS.ink }) + 1.5;
  }

  // Bloc d'identification
  const parcels = d.terrain.parcelles.map(parcelLabel).join(', ') || '—';
  const rows: [string, string][] = [
    ['Déclarant', declarantName(d)],
    ['Terrain', formatAddress(d.terrain.adresse) || '—'],
    ['Cadastre', `${d.terrain.commune || ''} · ${parcels}`],
    ['Dossier', `${d.reference} · ${new Date(d.engagement.date || d.updatedAt).toLocaleDateString('fr-FR')}`],
  ];
  let by = 160;
  s.line(x, by - 5, x + w, by - 5, { color: COLORS.line });
  for (const [k, v] of rows) {
    s.text(x, by, k.toUpperCase(), { size: 5.8, bold: true, color: COLORS.muted });
    by = s.paragraph(x, by + 3.4, w, v, { size: 7.2, leading: 3.1 }) + 1.6;
  }
  return s;
}

function swatch(s: Sheet, x: number, y: number, kind: NonNullable<PieceInfo['legend']>[number]['swatch']) {
  switch (kind) {
    case 'module':
      return s.rect(x, y, 6, 3.2, { fill: COLORS.green, stroke: COLORS.ink, width: 0.4 });
    case 'parcel':
      return s.line(x, y + 1.6, x + 6, y + 1.6, { width: 1, dash: [3, 1] });
    case 'neighbour':
      return s.rect(x, y, 6, 3.2, { fill: COLORS.paper, stroke: COLORS.muted, width: 0.3 });
    case 'building':
      return s.rect(x, y, 6, 3.2, { fill: COLORS.line, stroke: COLORS.ink, width: 0.4 });
    case 'viewpoint':
      return s.rect(x + 1.4, y, 3.2, 3.2, { fill: COLORS.red });
  }
}

function numberPages(pdf: PDFDocument, fonts: Fonts, d: Dossier) {
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    if (i === 0) return;
    const s = new Sheet(p, fonts);
    const label = `${i + 1} / ${pages.length}`;
    if (s.width > s.height) s.text(285, 200, label, { size: 7, align: 'right', color: COLORS.muted });
    else s.text(s.width - 12, s.height - 8, `${d.reference} · ${label}`, { size: 7, align: 'right', color: COLORS.muted });
  });
}

// ───────────────────────── Page de garde ─────────────────────────

async function coverPage(pdf: PDFDocument, fonts: Fonts, d: Dossier) {
  const s = new Sheet(pdf.addPage(A4_LANDSCAPE.map((v) => v * (72 / 25.4)) as [number, number]), fonts);
  s.rect(0, 0, 297, 210, { fill: COLORS.cream });
  s.text(18, 26, 'NASCO.', { size: 26, bold: true, tracking: 1.6 });
  'NASCO'.split('').forEach((l, i) => s.text(281, 24 + i * 5.2, l, { size: 9, bold: true, align: 'center' }));

  s.text(18, 70, 'Déclaration préalable', { size: 34, bold: true });
  s.text(18, 84, `Installation d’un ${MODULE.name}`, { size: 18 });
  s.text(18, 93, 'Construction d’une maison individuelle et/ou de ses annexes — Cerfa n° 13703', { size: 10, color: COLORS.muted });

  const rows: [string, string][] = [
    ['Déclarant', declarantName(d)],
    ['Adresse du terrain', formatAddress(d.terrain.adresse) || '—'],
    ['Commune', `${d.terrain.commune}${d.terrain.codeInsee ? ` (INSEE ${d.terrain.codeInsee})` : ''}`],
    ['Références cadastrales', d.terrain.parcelles.map((p) => `${parcelLabel(p)} (${p.contenance} m²)`).join(', ') || '—'],
    ['Référence dossier', d.reference],
  ];
  let y = 118;
  for (const [k, v] of rows) {
    s.text(18, y, k.toUpperCase(), { size: 7, bold: true, color: COLORS.muted });
    s.text(70, y, v, { size: 10 });
    y += 8.5;
  }

  // Bordereau des pièces
  const pieces = [
    ['DP1', 'Plan de situation du terrain'],
    ['DP2', 'Plan de masse'],
    ['DP3', 'Plan en coupe'],
    ['DP4', 'Plan des façades et des toitures'],
    ['DP6', 'Document graphique d’insertion'],
    ['DP7', 'Photographie — environnement proche'],
    ['DP8', 'Photographie — paysage lointain'],
  ];
  s.text(200, 118, 'PIÈCES JOINTES', { size: 7, bold: true, color: COLORS.muted });
  pieces.forEach(([code, label], i) => {
    s.rect(200, 121.5 + i * 7, 9, 4.6, { fill: COLORS.ink });
    s.text(204.5, 125 + i * 7, code, { size: 6.5, bold: true, color: COLORS.cream, align: 'center' });
    s.text(212, 125.2 + i * 7, label, { size: 8.5 });
  });

  // Barre de couleurs de la charte
  s.rect(18, 192, 40, 3, { fill: COLORS.green });
  s.rect(59.5, 192, 40, 3, { fill: COLORS.ink });
  s.rect(101, 192, 40, 3, { stroke: COLORS.ink, width: 0.6 });
  s.text(279, 195, new Date(d.engagement.date || Date.now()).toLocaleDateString('fr-FR', { dateStyle: 'long' }), { size: 9, align: 'right' });
}

// ───────────────────────── DP1 ─────────────────────────

async function dp1(pdf: PDFDocument, fonts: Fonts, d: Dossier) {
  const s = landscape(pdf, fonts, d, {
    code: 'DP1',
    title: 'Plan de situation du terrain',
    scale: '1/25 000 et 1/5 000',
    notes: ['Fonds de plan : Plan IGN, © IGN – Géoplateforme.', 'Le terrain est repéré par une cible rouge et, sur le plan de détail, par son contour.'],
  });
  const loc = d.terrain.location;
  if (!loc) return missing(s, 'Localisation du terrain non renseignée.');
  const gap = 6, w = (AREA.w - gap) / 2, h = 168;
  const panels = [
    { scale: 25000, title: 'Situation dans la commune — 1/25 000', outline: false },
    { scale: 5000, title: 'Situation dans le quartier — 1/5 000', outline: true },
  ];
  for (const [i, p] of panels.entries()) {
    const x = AREA.x + i * (w + gap);
    const widthM = (w * p.scale) / 1000, heightM = (h * p.scale) / 1000;
    const map = await renderMap({ center: loc, widthM, heightM, layers: ['plan'], zoom: zoomForScale(p.scale, loc.lat) });
    const ctx = map.canvas.getContext('2d')!;
    if (p.outline) {
      const rings = d.terrain.parcelles.flatMap((pp) => outerRings(pp.geometry));
      drawRings(ctx, rings, map.project, { stroke: '#d0021b', width: Math.max(2, map.canvas.width / 400) });
    }
    const c = map.project([loc.lon, loc.lat]);
    drawLocationMarker(ctx, c.x, c.y, map.canvas.width / 45);
    const img = await embedCanvas(pdf, map.canvas, 'jpeg');
    s.text(x, AREA.y + 4, p.title, { size: 9, bold: true });
    s.image(img, x, AREA.y + 8, w, h);
    s.rect(x, AREA.y + 8, w, h, { stroke: COLORS.ink, width: 0.5 });
    northArrow(s, x + w - 8, AREA.y + 17);
    s.scaleBar(x, AREA.y + 8 + h + 4, p.scale, niceBarLength(p.scale, 40));
  }
}

// ───────────────────────── DP2 ─────────────────────────

async function dp2(pdf: PDFDocument, fonts: Fonts, d: Dossier) {
  const model = buildSitePlan(d);
  const scale = model ? fitScale(model.frame.width, model.frame.height, { width: AREA.w, height: AREA.h - 12 }) : 200;
  const s = landscape(pdf, fonts, d, {
    code: 'DP2',
    title: 'Plan de masse des constructions à édifier',
    scale: `1/${scale.toLocaleString('fr-FR')}`,
    legend: [
      { swatch: 'parcel', label: 'Limites du terrain d’assiette' },
      { swatch: 'module', label: `${MODULE.name} projeté (${MODULE.length.toFixed(2).replace('.', ',')} × ${MODULE.width.toFixed(2).replace('.', ',')} m, h. ${MODULE.height.toFixed(2).replace('.', ',')} m)` },
      { swatch: 'building', label: 'Constructions existantes' },
      { swatch: 'neighbour', label: 'Parcelles voisines' },
      { swatch: 'viewpoint', label: 'Prises de vue DP7 / DP8' },
    ],
    notes: [
      'Cotes en mètres, distances mesurées aux limites séparatives les plus proches.',
      'Pose sur plots : terrain naturel conservé, pas de terrassement.',
      'Source cadastrale : PCI Express, © DGFiP / IGN.',
    ],
  });
  if (!model) return missing(s, 'Parcelle non renseignée.');

  const u = scale / 1000;
  let ortho: string | null = null;
  if (d.implantation.orthoBackground) {
    const f = model.frame;
    const [lon, lat] = model.toLonLat({ x: (f.minX + f.maxX) / 2, y: (f.minY + f.maxY) / 2 });
    const map = await renderMap({ center: { lat, lon }, widthM: f.width, heightM: f.height, layers: ['ortho'], zoom: 19 });
    ortho = map.canvas.toDataURL('image/jpeg', 0.85);
  }
  const wMm = (model.frame.width * 1000) / scale, hMm = (model.frame.height * 1000) / scale;
  const svg = renderToStaticMarkup(createElement(SitePlanSvg, { model, unit: u, orthoHref: ortho, sizeMm: { width: wMm, height: hMm } }));
  const canvas = await rasterizeSvg(svg, (wMm / 25.4) * DPI * 1.2, (hMm / 25.4) * DPI * 1.2);
  const img = await embedCanvas(pdf, canvas, 'png');
  const x = AREA.x + (AREA.w - wMm) / 2, y = AREA.y + (AREA.h - 12 - hMm) / 2;
  s.image(img, x, y, wMm, hMm);
  s.rect(x, y, wMm, hMm, { stroke: COLORS.ink, width: 0.4 });
  s.scaleBar(x, y + hMm + 5, scale, niceBarLength(scale, 50));
  s.text(x + wMm, y + hMm + 8, `Entrée orientée ${cardinal(model.rotation)}`, { size: 7, align: 'right', color: COLORS.muted });
}

// ───────────────────────── DP3 / DP4 : dessins du module ─────────────────────────

const svgCache = new Map<DrawingId, Promise<string>>();
const fetchSvg = (id: DrawingId) => {
  let p = svgCache.get(id);
  if (!p) svgCache.set(id, (p = fetch(DRAWINGS[id].url).then((r) => r.text())));
  return p;
};

async function placeDrawing(pdf: PDFDocument, s: Sheet, id: DrawingId, x: number, y: number, scale: number, title: string) {
  const dwg = DRAWINGS[id];
  const [vx, vy, vw, vh] = dwg.viewBox;
  const w = vw / scale, h = vh / scale;
  const canvas = await rasterizeSvg(await fetchSvg(id), (w / 25.4) * DPI * 1.3, (h / 25.4) * DPI * 1.3);
  s.text(x, y - 2.5, title, { size: 8.5, bold: true });
  s.image(await embedCanvas(pdf, canvas, 'png'), x, y, w, h);
  if (dwg.kind !== 'plan') {
    // Cotes de niveau (mm → papier).
    const level = (hMm: number) => y + (-hMm - vy) / scale;
    const lx = x + (dwg.envelope.width - vx + 250) / scale;
    for (const [hMm, label] of [
      [MODULE.height * 1000, `+${MODULE.height.toFixed(2).replace('.', ',')}`],
      [0, '±0,00 plancher'],
    ] as const) {
      const ly = level(hMm);
      s.line(lx, ly, lx + 3, ly, { width: 0.4 });
      s.text(lx + 4, ly + 1, label, { size: 6.5 });
    }
  }
  return { w, h };
}

async function drawingsPage(pdf: PDFDocument, fonts: Fonts, d: Dossier, code: string, title: string, ids: DrawingId[]) {
  const model = buildSitePlan(d);
  const orient = (id: DrawingId) => {
    const n = FACADE_NORMALS[id as keyof typeof FACADE_NORMALS];
    return n === undefined || !model ? '' : ` — orientée ${cardinal(model.rotation + n)}`;
  };
  const s = landscape(pdf, fonts, d, {
    code,
    title,
    scale: '1/50',
    notes:
      code === 'DP3'
        ? ['Module posé sur plots : le terrain naturel est conservé, sans terrassement ni remblai.', `Hauteur maximale : ${MODULE.height.toFixed(2).replace('.', ',')} m au-dessus du plancher.`]
        : ['Bardage panneaux bois/liège teinte naturelle.', 'Volets et brise-vue coulissants vert sauge.', 'Menuiseries aluminium noir. Toiture bac acier gris clair.'],
  });
  const S = 50;
  const [first, ...rest] = ids;
  const big = DRAWINGS[first];
  await placeDrawing(pdf, s, first, AREA.x + (AREA.w - big.viewBox[2] / S) / 2, AREA.y + 10, S, `${big.title}${orient(first)}`);
  const row = rest.map((id) => DRAWINGS[id]);
  const totalW = row.reduce((t, r) => t + r.viewBox[2] / S, 0);
  const gap = row.length > 1 ? (AREA.w - totalW) / (row.length + 1) : (AREA.w - totalW) / 2;
  let x = AREA.x + gap;
  const y = AREA.y + 10 + big.viewBox[3] / S + 22;
  for (const dwg of row) {
    await placeDrawing(pdf, s, dwg.id, x, y, S, `${dwg.title}${orient(dwg.id)}`);
    x += dwg.viewBox[2] / S + gap;
  }
  s.scaleBar(AREA.x, AREA.y + AREA.h - 4, S, 2);
}

async function modulePlanPage(pdf: PDFDocument, fonts: Fonts, d: Dossier) {
  const s = landscape(pdf, fonts, d, {
    code: 'DP4',
    title: 'Plan du module et de la toiture (complément)',
    scale: '1/75',
    notes: [
      `Emprise au sol : ${MODULE.footprint.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} m². Surface de plancher : ${d.projet.surfacePlancher.toLocaleString('fr-FR')} m².`,
      'Toiture-terrasse en bac acier, évacuation des eaux pluviales sur la parcelle.',
    ],
  });
  const S = 75;
  const dwg = DRAWINGS.plan;
  const w = dwg.viewBox[2] / S, h = dwg.viewBox[3] / S;
  await placeDrawing(pdf, s, 'plan', AREA.x + (AREA.w - w) / 2, AREA.y + (AREA.h - h) / 2, S, dwg.title);
  s.scaleBar(AREA.x, AREA.y + AREA.h - 4, S, 2);
}

// ───────────────────────── DP6 / DP7 / DP8 ─────────────────────────

async function photoPage(pdf: PDFDocument, fonts: Fonts, d: Dossier, code: string, title: string, ref: FileRef | null, note: string) {
  const s = landscape(pdf, fonts, d, { code, title, notes: [note] });
  if (!ref) return missing(s, 'Image non fournie.');
  const blob = await repository().getFile(d.id, ref);
  if (!blob) return missing(s, 'Image introuvable dans le stockage.');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const img = blob.type === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const box = s.imageContain(img, AREA.x, AREA.y, AREA.w, AREA.h);
  s.rect(box.x, box.y, box.w, box.h, { stroke: COLORS.ink, width: 0.4 });
}

// ───────────────────────── utilitaires ─────────────────────────

function missing(s: Sheet, message: string) {
  s.rect(AREA.x, AREA.y, AREA.w, AREA.h, { stroke: COLORS.line, width: 0.6 });
  s.text(AREA.x + AREA.w / 2, AREA.y + AREA.h / 2, message, { size: 11, align: 'center', color: COLORS.muted });
}

function northArrow(s: Sheet, x: number, y: number) {
  s.rect(x - 4.5, y - 11, 9, 17, { fill: COLORS.white, stroke: COLORS.ink, width: 0.4 });
  s.text(x, y - 6.5, 'N', { size: 7, bold: true, align: 'center' });
  s.page.drawSvgPath('M 0 -9 L 3.4 4 L 0 1.6 L -3.4 4 Z', {
    x: x * (72 / 25.4), y: (s.height - y - 1.5) * (72 / 25.4), scale: 1.7, color: COLORS.ink,
  });
}

async function embedCanvas(pdf: PDFDocument, canvas: HTMLCanvasElement, type: 'png' | 'jpeg'): Promise<PDFImage> {
  const blob = await canvasToBlob(canvas, type === 'png' ? 'image/png' : 'image/jpeg', 0.9);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return type === 'png' ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
}
