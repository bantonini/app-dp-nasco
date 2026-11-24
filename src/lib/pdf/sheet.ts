import { rgb, type Color, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';

export const MM = 72 / 25.4;
export const A4_LANDSCAPE: [number, number] = [297, 210];
export const A4_PORTRAIT: [number, number] = [210, 297];

export const COLORS = {
  ink: rgb(0.055, 0.055, 0.047),
  green: rgb(0.125, 0.31, 0.102),
  cream: rgb(0.922, 0.922, 0.878),
  paper: rgb(0.965, 0.965, 0.937),
  muted: rgb(0.42, 0.42, 0.38),
  line: rgb(0.8, 0.8, 0.76),
  white: rgb(1, 1, 1),
  red: rgb(0.816, 0.008, 0.106),
};

export interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

/** Caractères hors WinAnsi (non gérés par les polices standard PDF). */
export function pdfSafe(text: string): string {
  return text
    .replace(/[≤]/g, '<=')
    .replace(/[≥]/g, '>=')
    .replace(/[   ]/g, ' ')
    .replace(/[^\u0000-ÿ–—‘’“”•…€Œœ]/g, '');
}

interface TextOpts {
  size?: number;
  bold?: boolean;
  color?: Color;
  align?: 'left' | 'center' | 'right';
  /** Espacement des lettres (pt) — pour le logotype. */
  tracking?: number;
}

/**
 * Surcouche de PDFPage en millimètres, origine en haut à gauche.
 */
export class Sheet {
  readonly width: number;
  readonly height: number;
  constructor(
    readonly page: PDFPage,
    readonly fonts: Fonts,
  ) {
    this.width = page.getWidth() / MM;
    this.height = page.getHeight() / MM;
  }

  private y(mm: number) {
    return (this.height - mm) * MM;
  }

  font(bold?: boolean) {
    return bold ? this.fonts.bold : this.fonts.regular;
  }

  textWidth(text: string, size: number, bold?: boolean, tracking = 0) {
    const t = pdfSafe(text);
    return (this.font(bold).widthOfTextAtSize(t, size) + tracking * Math.max(0, t.length - 1)) / MM;
  }

  /** Texte sur une ligne ; y = ligne de base (mm depuis le haut). */
  text(x: number, y: number, text: string, o: TextOpts = {}) {
    const size = o.size ?? 9;
    const t = pdfSafe(text);
    const w = this.textWidth(t, size, o.bold, o.tracking);
    const dx = o.align === 'center' ? -w / 2 : o.align === 'right' ? -w : 0;
    if (o.tracking) {
      let cx = x + dx;
      for (const ch of t) {
        this.page.drawText(ch, { x: cx * MM, y: this.y(y), size, font: this.font(o.bold), color: o.color ?? COLORS.ink });
        cx += (this.font(o.bold).widthOfTextAtSize(ch, size) + o.tracking) / MM;
      }
      return;
    }
    this.page.drawText(t, { x: (x + dx) * MM, y: this.y(y), size, font: this.font(o.bold), color: o.color ?? COLORS.ink });
  }

  /** Paragraphe justifié à gauche ; renvoie la position y après le dernier interligne. */
  paragraph(x: number, y: number, width: number, text: string, o: TextOpts & { leading?: number } = {}) {
    const size = o.size ?? 9;
    const leading = o.leading ?? size * 0.42;
    let cy = y;
    for (const para of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (this.textWidth(next, size, o.bold) > width && line) {
          this.text(x, cy, line, o);
          cy += leading;
          line = word;
        } else line = next;
      }
      this.text(x, cy, line, o);
      cy += leading;
    }
    return cy;
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: Color; stroke?: Color; width?: number } = {}) {
    this.page.drawRectangle({
      x: x * MM, y: this.y(y + h), width: w * MM, height: h * MM,
      color: o.fill, borderColor: o.stroke, borderWidth: o.stroke ? (o.width ?? 0.5) : 0,
    });
  }

  line(x1: number, y1: number, x2: number, y2: number, o: { color?: Color; width?: number; dash?: number[] } = {}) {
    this.page.drawLine({
      start: { x: x1 * MM, y: this.y(y1) }, end: { x: x2 * MM, y: this.y(y2) },
      thickness: o.width ?? 0.5, color: o.color ?? COLORS.ink, dashArray: o.dash,
    });
  }

  image(img: PDFImage, x: number, y: number, w: number, h: number) {
    this.page.drawImage(img, { x: x * MM, y: this.y(y + h), width: w * MM, height: h * MM });
  }

  /** Image ajustée (contain) dans une boîte ; renvoie la boîte occupée. */
  imageContain(img: PDFImage, x: number, y: number, w: number, h: number) {
    const k = Math.min(w / img.width, h / img.height);
    const iw = img.width * k, ih = img.height * k;
    const ix = x + (w - iw) / 2, iy = y + (h - ih) / 2;
    this.image(img, ix, iy, iw, ih);
    return { x: ix, y: iy, w: iw, h: ih };
  }

  /** Échelle graphique : `meters` représentés sur la longueur correspondant à l'échelle 1/scale. */
  scaleBar(x: number, y: number, scale: number, meters: number) {
    const len = (meters * 1000) / scale;
    const seg = len / 4;
    for (let i = 0; i < 4; i++) this.rect(x + i * seg, y, seg, 1.4, { fill: i % 2 ? COLORS.white : COLORS.ink, stroke: COLORS.ink, width: 0.4 });
    this.text(x, y + 4.4, '0', { size: 6.5 });
    this.text(x + len, y + 4.4, `${meters.toLocaleString('fr-FR')} m`, { size: 6.5, align: 'center' });
  }
}

/** Longueur « ronde » pour l'échelle graphique (~ maxMm de papier). */
export function niceBarLength(scale: number, maxMm = 40) {
  const maxM = (maxMm * scale) / 1000;
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
  return [...steps].reverse().find((s) => s <= maxM) ?? 1;
}
