/** Outils image côté navigateur. */

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image illisible : ${src.slice(0, 60)}`));
    img.src = src;
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.88): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export image impossible'))), type, quality),
  );
}

/**
 * Redimensionne une photo (côté le plus long ≤ maxSize) et la ré-encode en JPEG,
 * en respectant l'orientation EXIF (gérée par createImageBitmap).
 */
export async function prepareImage(file: Blob, maxSize = 2400): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const k = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const keepAlpha = file.type === 'image/png';
  return {
    blob: await canvasToBlob(canvas, keepAlpha ? 'image/png' : 'image/jpeg', 0.86),
    width: canvas.width,
    height: canvas.height,
  };
}

/** Rasterise un SVG (chaîne ou URL) dans un canvas à la taille demandée. */
export async function rasterizeSvg(svg: string, width: number, height: number, background = '#ffffff') {
  const url = svg.trim().startsWith('<') ? URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })) : svg;
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width);
    canvas.height = Math.round(height);
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    if (url !== svg) URL.revokeObjectURL(url);
  }
}
