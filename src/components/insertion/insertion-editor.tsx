'use client';

import { Eraser, Hand, LoaderCircle, Paintbrush, RotateCcw, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dossier, FileRef, Insertion, Quad } from '@/lib/dossier';
import { pointInQuad, type Pt, type Quad4 } from '@/lib/homography';
import { canvasToBlob, loadImage } from '@/lib/images';
import { defaultCorners, renderComposite, toPixels } from '@/lib/insertion';
import { repository } from '@/lib/storage';
import { Button, Segmented, Slider } from '../ui/controls';

type Tool = 'move' | 'erase' | 'restore';
type Drag = { kind: 'corner'; index: number } | { kind: 'body'; start: Pt; quad: Quad } | { kind: 'brush' };

const MAX_OUTPUT = 2400;

/**
 * Éditeur de photomontage : le module est posé sur la photo, déplacé, mis en
 * perspective par ses 4 coins, ajusté (lumière, ombre) et partiellement masqué
 * (végétation au premier plan) au pinceau.
 */
export function InsertionEditor({
  dossier,
  photoUrl,
  spriteUrl,
  initialMaskUrl,
  onChange,
  onSaved,
}: {
  dossier: Dossier;
  photoUrl: string;
  spriteUrl: string;
  initialMaskUrl: string | null;
  onChange: (patch: Partial<Insertion>) => void;
  onSaved: (refs: { result: FileRef; mask: FileRef | null }) => void;
}) {
  const ins = dossier.insertion;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [sprite, setSprite] = useState<HTMLImageElement | null>(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const [tool, setTool] = useState<Tool>('move');
  const [brush, setBrush] = useState(40);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState({ w: 0, h: 0 });
  const drag = useRef<Drag | null>(null);
  const [cursor, setCursor] = useState<Pt | null>(null);

  // Chargement des images.
  useEffect(() => {
    let alive = true;
    loadImage(photoUrl).then((img) => alive && setPhoto(img));
    return () => {
      alive = false;
    };
  }, [photoUrl]);
  useEffect(() => {
    let alive = true;
    loadImage(spriteUrl).then((img) => alive && setSprite(img));
    return () => {
      alive = false;
    };
  }, [spriteUrl]);

  // Masque à la résolution de sortie de la photo (restauré depuis le fichier enregistré).
  const maskCanvas = useMemo(() => {
    if (!photo) return null;
    const k = Math.min(1, MAX_OUTPUT / Math.max(photo.naturalWidth, photo.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(photo.naturalWidth * k);
    c.height = Math.round(photo.naturalHeight * k);
    return c;
  }, [photo]);
  const mask = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    mask.current = maskCanvas;
    if (!maskCanvas || !initialMaskUrl) return;
    let alive = true;
    loadImage(initialMaskUrl).then((m) => {
      if (!alive) return;
      const ctx = maskCanvas.getContext('2d')!;
      ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      ctx.drawImage(m, 0, 0, maskCanvas.width, maskCanvas.height);
      setMaskVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [maskCanvas, initialMaskUrl]);

  // Taille d'affichage.
  useEffect(() => {
    if (!photo || !wrapRef.current) return;
    const el = wrapRef.current;
    const fit = () => {
      const w = el.clientWidth;
      setView({ w, h: Math.round((w * photo.naturalHeight) / photo.naturalWidth) });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [photo]);

  const spriteRatio = sprite ? sprite.naturalWidth / sprite.naturalHeight : 2.8;
  const corners: Quad | null = ins.corners ?? (photo ? defaultCorners(photo.naturalWidth / photo.naturalHeight, spriteRatio) : null);

  // Rendu écran.
  const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !photo || !sprite || !corners || !view.w) return;
    c.width = Math.round(view.w * dpr);
    c.height = Math.round(view.h * dpr);
    const ctx = c.getContext('2d')!;
    const quad = toPixels(corners, c.width, c.height);
    renderComposite(ctx, {
      photo, width: c.width, height: c.height, sprite, spriteWidth: sprite.naturalWidth, spriteHeight: sprite.naturalHeight,
      quad, adjust: ins, mask: maskCanvas,
    });
    if (tool === 'move') drawHandles(ctx, quad, dpr);
    if (tool !== 'move' && cursor) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(cursor[0] * dpr, cursor[1] * dpr, (brush / 2) * (c.width / (mask.current?.width || c.width)), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }, [photo, sprite, corners, view, ins, tool, cursor, brush, dpr, maskCanvas, maskVersion]);

  const local = (e: React.PointerEvent): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const paint = useCallback(
    (p: Pt) => {
      const m = mask.current;
      if (!m || !view.w) return;
      const k = m.width / view.w;
      const ctx = m.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = tool === 'erase' ? 'source-over' : 'destination-out';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(p[0] * k, p[1] * k, brush / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      setMaskVersion((v) => v + 1);
    },
    [tool, brush, view.w],
  );

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!corners) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = local(e);
    if (tool !== 'move') {
      drag.current = { kind: 'brush' };
      onChange({});
      paint(p);
      return;
    }
    const quad = toPixels(corners, view.w, view.h);
    const index = quad.findIndex(([x, y]) => Math.hypot(x - p[0], y - p[1]) < 14);
    if (index >= 0) drag.current = { kind: 'corner', index };
    else if (pointInQuad(p, quad)) drag.current = { kind: 'body', start: p, quad: corners };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = local(e);
    setCursor(p);
    const d = drag.current;
    if (!d || !corners) return;
    if (d.kind === 'brush') return paint(p);
    if (d.kind === 'corner') {
      const next = corners.map((c, i) => (i === d.index ? [p[0] / view.w, p[1] / view.h] : c)) as Quad;
      onChange({ corners: next });
    } else {
      const dx = (p[0] - d.start[0]) / view.w, dy = (p[1] - d.start[1]) / view.h;
      onChange({ corners: d.quad.map(([x, y]) => [x + dx, y + dy]) as Quad });
    }
  }

  function onWheel(e: React.WheelEvent) {
    if (!corners || tool !== 'move') return;
    e.preventDefault();
    const k = Math.exp(-e.deltaY * 0.0015);
    // Mise à l'échelle autour du milieu du bord inférieur (le module reste « posé » au sol).
    const ax = (corners[2][0] + corners[3][0]) / 2, ay = (corners[2][1] + corners[3][1]) / 2;
    onChange({ corners: corners.map(([x, y]) => [ax + (x - ax) * k, ay + (y - ay) * k]) as Quad });
  }

  function scaleBy(k: number) {
    if (!corners) return;
    const ax = (corners[2][0] + corners[3][0]) / 2, ay = (corners[2][1] + corners[3][1]) / 2;
    onChange({ corners: corners.map(([x, y]) => [ax + (x - ax) * k, ay + (y - ay) * k]) as Quad });
  }

  async function save() {
    if (!photo || !sprite || !corners || !mask.current) return;
    setSaving(true);
    try {
      const out = document.createElement('canvas');
      out.width = mask.current.width;
      out.height = mask.current.height;
      renderComposite(out.getContext('2d')!, {
        photo, width: out.width, height: out.height, sprite, spriteWidth: sprite.naturalWidth, spriteHeight: sprite.naturalHeight,
        quad: toPixels(corners, out.width, out.height), adjust: ins, mask: mask.current,
      });
      const repo = repository();
      const result = await repo.putFile(dossier.id, await canvasToBlob(out, 'image/jpeg', 0.9), {
        name: 'insertion-dp6.jpg', width: out.width, height: out.height,
      });
      const maskRef = await repo.putFile(dossier.id, await canvasToBlob(mask.current, 'image/png'), {
        name: 'insertion-masque.png', width: out.width, height: out.height,
      });
      onChange({ corners });
      onSaved({ result, mask: maskRef });
    } finally {
      setSaving(false);
    }
  }

  function clearMask() {
    const m = mask.current;
    if (!m) return;
    m.getContext('2d')!.clearRect(0, 0, m.width, m.height);
    setMaskVersion((v) => v + 1);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented<Tool>
            value={tool}
            onChange={setTool}
            options={[
              { value: 'move', label: 'Placer' },
              { value: 'erase', label: 'Masquer' },
              { value: 'restore', label: 'Restaurer' },
            ]}
          />
          <span className="text-xs text-muted">
            {tool === 'move' && (
              <>
                <Hand className="mr-1 inline size-3.5" />
                Glisser le module, ses coins pour la perspective, molette pour la taille.
              </>
            )}
            {tool === 'erase' && (
              <>
                <Eraser className="mr-1 inline size-3.5" />
                Peindre ce qui doit passer devant le module (arbres, haies…).
              </>
            )}
            {tool === 'restore' && (
              <>
                <Paintbrush className="mr-1 inline size-3.5" />
                Repeindre le module effacé.
              </>
            )}
          </span>
        </div>
        <div ref={wrapRef} className="relative overflow-hidden rounded-[6px] border border-line bg-ink">
          {!photo || !sprite ? (
            <div className="grid aspect-[4/3] place-items-center text-cream/70">
              <LoaderCircle className="size-6 animate-spin" />
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{ width: view.w, height: view.h, touchAction: 'none' }}
              className={tool === 'move' ? 'cursor-move' : 'cursor-none'}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onPointerLeave={() => setCursor(null)}
              onWheel={onWheel}
            />
          )}
        </div>
      </div>

      <div className="grid content-start gap-5">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => scaleBy(1 / 1.06)}>
            − Réduire
          </Button>
          <Button variant="outline" size="sm" onClick={() => scaleBy(1.06)}>
            + Agrandir
          </Button>
        </div>
        {tool !== 'move' && (
          <Slider label="Taille du pinceau" value={brush} min={6} max={200} step={1} onChange={setBrush} format={(v) => `${v} px`} />
        )}
        <Slider label="Luminosité" value={ins.brightness} min={0.5} max={1.5} step={0.01} onChange={(v) => onChange({ brightness: v })} />
        <Slider label="Contraste" value={ins.contrast} min={0.5} max={1.5} step={0.01} onChange={(v) => onChange({ contrast: v })} />
        <Slider label="Saturation" value={ins.saturation} min={0} max={1.6} step={0.01} onChange={(v) => onChange({ saturation: v })} />
        <Slider label="Ombre au sol" value={ins.shadow} min={0} max={0.9} step={0.01} onChange={(v) => onChange({ shadow: v })} />
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => onChange({ corners: null, brightness: 1, contrast: 1, saturation: 1, shadow: 0.45 })}>
            <RotateCcw className="size-3.5" /> Réinitialiser
          </Button>
          <Button variant="ghost" size="sm" onClick={clearMask}>
            <Eraser className="size-3.5" /> Effacer le masque
          </Button>
        </div>
        <Button variant="accent" size="lg" onClick={save} disabled={saving || !photo || !sprite}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer le photomontage
        </Button>
      </div>
    </div>
  );
}

function drawHandles(ctx: CanvasRenderingContext2D, q: Quad4, dpr: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  ctx.lineWidth = 1.2 * dpr;
  ctx.beginPath();
  q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [x, y] of q) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#204f1a';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    ctx.arc(x, y, 6.5 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}
