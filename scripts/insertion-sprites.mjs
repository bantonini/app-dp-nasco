#!/usr/bin/env node
/**
 * Génère les vues colorées du Pavillon N°1 utilisées pour l'insertion
 * paysagère (DP6). Cotes reprises des façades DWG N4 et N2 (en mm,
 * sol fini = 0, hauteur positive vers le haut).
 *
 *   node scripts/insertion-sprites.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/module');

const C = {
  cladding: ['#a3774f', '#9b6f49', '#a87e56', '#956a47', '#a07450'],
  joint: '#5f4330',
  green: '#56654e',
  greenDark: '#465440',
  frame: '#161616',
  roof: '#c9cac4',
  roofEdge: '#9fa19b',
  deck: '#8d7a63',
  plot: '#3a3a3a',
};

const TOP = 2900; // hauteur (mm) correspondant au haut du dessin
const GROUND = -250; // terrain naturel sous les plots
const y = (h) => TOP - h;

/** Pseudo-random generator so the output is stable between runs. */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function cladding(x0, x1, seed) {
  const r = rng(seed);
  const out = [];
  const rows = [0, 520, 1180, 1760, 2300, 2700];
  for (let i = 0; i < rows.length - 1; i++) {
    let x = x0 - r() * 600;
    while (x < x1) {
      const w = 700 + r() * 900;
      const a = Math.max(x, x0), b = Math.min(x + w, x1);
      if (b > a) {
        const fill = C.cladding[Math.floor(r() * C.cladding.length)];
        out.push(`<rect x="${a.toFixed(0)}" y="${y(rows[i + 1])}" width="${(b - a).toFixed(0)}" height="${rows[i + 1] - rows[i]}" fill="${fill}" stroke="${C.joint}" stroke-width="14"/>`);
      }
      x += w;
    }
  }
  return out.join('');
}

function slatted(x0, x1, h0, h1) {
  const lines = [];
  for (let x = x0 + 70; x < x1 - 30; x += 70)
    lines.push(`<line x1="${x}" y1="${y(h1) + 30}" x2="${x}" y2="${y(h0) - 30}" stroke="${C.greenDark}" stroke-width="16"/>`);
  return `<rect x="${x0}" y="${y(h1)}" width="${x1 - x0}" height="${h1 - h0}" fill="${C.green}" stroke="${C.greenDark}" stroke-width="20"/>${lines.join('')}`;
}

function glazing(x0, x1, h0, h1, mullions = 0) {
  const id = `g${x0}${h0}`;
  const w = x1 - x0, h = h1 - h0;
  const bars = [];
  for (let i = 1; i <= mullions; i++) {
    const x = x0 + (w * i) / (mullions + 1);
    bars.push(`<rect x="${x - 25}" y="${y(h1)}" width="50" height="${h}" fill="${C.frame}"/>`);
  }
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4d5a60"/><stop offset="0.45" stop-color="#26302f"/><stop offset="0.55" stop-color="#5d6d70"/><stop offset="1" stop-color="#1c2322"/></linearGradient></defs>
<rect x="${x0}" y="${y(h1)}" width="${w}" height="${h}" fill="url(#${id})" stroke="${C.frame}" stroke-width="55"/>${bars.join('')}`;
}

function frame(width, body) {
  const x0 = -450, x1 = width + 450;
  const roof = `<rect x="${x0}" y="${y(2860)}" width="${x1 - x0}" height="110" fill="${C.roof}"/><rect x="${x0}" y="${y(2760)}" width="${x1 - x0}" height="22" fill="${C.roofEdge}"/>
<rect x="0" y="${y(2760)}" width="${width}" height="60" fill="#2a2420" opacity="0.45"/>`;
  const plots = [];
  for (let x = 150; x < width; x += Math.max(600, (width - 300) / Math.round((width - 300) / 900)))
    plots.push(`<rect x="${(x - 60).toFixed(0)}" y="${y(-40)}" width="120" height="210" fill="${C.plot}"/>`);
  plots.push(`<rect x="${width - 210}" y="${y(-40)}" width="120" height="210" fill="${C.plot}"/>`);
  const base = `<rect x="0" y="${y(0)}" width="${width}" height="40" fill="#2b2622"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0} 0 ${x1 - x0} ${TOP - GROUND}" width="${(x1 - x0) / 10}" height="${(TOP - GROUND) / 10}">
${plots.join('')}${base}${body}${roof}
</svg>\n`;
}

// ── Façade N4 (entrée), 8,00 m ──
const n4 = frame(
  8000,
  [
    cladding(0, 8000, 7),
    slatted(0, 620, 0, 2470),
    slatted(1160, 1780, 0, 2470),
    slatted(2600, 3380, 0, 2470),
    glazing(1810, 2200, 910, 1610),
    glazing(3400, 4340, 0, 2130, 0),
    glazing(4590, 6080, 900, 1600, 1),
    slatted(6080, 7590, 900, 1600),
  ].join(''),
);

// ── Pignon N2, 2,50 m ──
const n2 = frame(
  2500,
  [
    cladding(0, 2500, 11),
    glazing(350, 1080, 1500, 2030, 1),
    slatted(1080, 1810, 1500, 2030),
    glazing(350, 1120, 410, 940, 1),
    slatted(1120, 1890, 410, 940),
  ].join(''),
);

fs.writeFileSync(path.join(OUT, 'insertion-n4.svg'), n4);
fs.writeFileSync(path.join(OUT, 'insertion-pignon.svg'), n2);
console.log('✓ insertion-n4.svg, insertion-pignon.svg');
