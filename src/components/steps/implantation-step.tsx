'use client';

import { Camera, Crosshair, Magnet, RotateCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dossier, PhotoViewpoint } from '@/lib/dossier';
import { cardinal, type Vec } from '@/lib/geo/geometry';
import { canvasToBlob } from '@/lib/images';
import { renderMap } from '@/lib/geo/maps';
import { alignToNearestBoundary, buildSitePlan, normalizeRotation, type SitePlanModel } from '@/lib/site-plan';
import { SitePlanSvg } from '../plan/site-plan-svg';
import { Button, Card, Notice, SectionTitle } from '../ui/controls';
import type { StepProps } from './types';

type Drag =
  | { kind: 'module'; offset: Vec }
  | { kind: 'rotate' }
  | { kind: 'dp7' | 'dp8'; offset: Vec }
  | { kind: 'dp7-aim' | 'dp8-aim' };

export function ImplantationStep({ dossier, update, goTo }: StepProps) {
  const model = useMemo(() => buildSitePlan(dossier), [dossier]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [placing, setPlacing] = useState<'dp7' | 'dp8' | null>(null);
  const ortho = useOrtho(model, dossier.implantation.orthoBackground);

  if (!model)
    return (
      <>
        <SectionTitle eyebrow="DP2" title="Plan de masse" />
        <Notice tone="warn">
          Sélectionnez d&apos;abord la parcelle du terrain.{' '}
          <button className="underline" onClick={() => goTo('terrain')}>
            Aller à l&apos;étape Terrain
          </button>
        </Notice>
      </>
    );

  // Taille des annotations à l’écran : équivalent d’un tirage de 150 mm de large.
  const u = model.frame.width / 150;
  const imp = dossier.implantation;

  const setImplantation = (patch: Partial<Dossier['implantation']>) =>
    update((d) => ({
      ...d,
      implantation: { ...d.implantation, x: model.center.x, y: model.center.y, rotation: model.rotation, placed: true, ...patch },
    }));
  const setViewpoint = (id: 'dp7' | 'dp8', vp: PhotoViewpoint) =>
    update((d) => ({ ...d, implantation: { ...d.implantation, viewpoints: { ...d.implantation.viewpoints, [id]: vp } } }));

  const toLocal = (e: React.PointerEvent): Vec => {
    const svg = svgRef.current!;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: pt.x, y: -pt.y };
  };

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const p = toLocal(e);
    if (placing) {
      const bearing = bearingTo(p, model!.center);
      setViewpoint(placing, { x: p.x, y: p.y, bearing });
      setPlacing(null);
      return;
    }
    const handle = (e.target as Element).closest('[data-handle]')?.getAttribute('data-handle');
    if (!handle) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (handle === 'module') drag.current = { kind: 'module', offset: { x: p.x - model!.center.x, y: p.y - model!.center.y } };
    else if (handle === 'rotate') drag.current = { kind: 'rotate' };
    else if (handle === 'dp7' || handle === 'dp8') {
      const vp = imp.viewpoints[handle]!;
      drag.current = { kind: handle, offset: { x: p.x - vp.x, y: p.y - vp.y } };
    } else if (handle === 'dp7-aim' || handle === 'dp8-aim') drag.current = { kind: handle };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const p = toLocal(e);
    switch (d.kind) {
      case 'module':
        setImplantation({ x: round(p.x - d.offset.x), y: round(p.y - d.offset.y) });
        break;
      case 'rotate': {
        const r = bearingTo(model!.center, p);
        setImplantation({ rotation: normalizeRotation(e.shiftKey ? Math.round(r / 15) * 15 : Math.round(r)) });
        break;
      }
      case 'dp7':
      case 'dp8': {
        const vp = imp.viewpoints[d.kind]!;
        setViewpoint(d.kind, { ...vp, x: p.x - d.offset.x, y: p.y - d.offset.y });
        break;
      }
      default: {
        const id = d.kind === 'dp7-aim' ? 'dp7' : 'dp8';
        const vp = imp.viewpoints[id]!;
        setViewpoint(id, { ...vp, bearing: Math.round(bearingTo(vp, p)) });
      }
    }
  }

  const endDrag = () => (drag.current = null);
  const entrance = cardinal(model.rotation);

  return (
    <>
      <SectionTitle eyebrow="Pièce DP2" title="Plan de masse">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImplantation({ rotation: alignToNearestBoundary(model) })}>
            <Magnet className="size-4" /> Aligner sur la limite
          </Button>
          <Button variant="outline" size="sm" onClick={() => setImplantation({ rotation: normalizeRotation(model.rotation + 90) })}>
            <RotateCw className="size-4" /> Pivoter de 90°
          </Button>
          <Button
            variant={imp.orthoBackground ? 'primary' : 'outline'}
            size="sm"
            onClick={() => update((d) => ({ ...d, implantation: { ...d.implantation, orthoBackground: !d.implantation.orthoBackground } }))}
          >
            Fond photo aérienne
          </Button>
        </div>
      </SectionTitle>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="overflow-hidden p-0">
          <SitePlanSvg
            model={model}
            unit={u}
            interactive
            orthoHref={imp.orthoBackground ? ortho : null}
            className={`block h-auto w-full select-none ${placing ? 'cursor-crosshair' : ''}`}
            svgRef={svgRef}
            handlers={{ onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag }}
          />
        </Card>

        <div className="grid content-start gap-4">
          <Card className="p-5">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Position du module</p>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-muted">Orientation</dt>
              <dd className="text-right tabular">{model.rotation.toFixed(0)}°</dd>
              <dt className="text-muted">Entrée (N4) vers</dt>
              <dd className="text-right">{entrance}</dd>
              {model.distances.slice(0, 4).map((d, i) => (
                <div key={i} className="contents">
                  <dt className="text-muted">Limite {i + 1}</dt>
                  <dd className="text-right tabular">{d.distance.toFixed(2).replace('.', ',')} m</dd>
                </div>
              ))}
            </dl>
            {!model.inside && (
              <div className="mt-4">
                <Notice tone="warn">Le module dépasse des limites de la parcelle.</Notice>
              </div>
            )}
            {!imp.placed && (
              <div className="mt-4">
                <Notice>Position proposée automatiquement : faites glisser le module pour l&apos;ajuster.</Notice>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">Points de vue photos</p>
            <p className="mb-4 text-sm text-muted">
              Les angles de prise de vue des photos DP7 et DP8 doivent figurer sur le plan.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['dp7', 'dp8'] as const).map((id) => (
                <Button key={id} variant={placing === id ? 'accent' : 'outline'} size="sm" onClick={() => setPlacing(placing === id ? null : id)}>
                  {placing === id ? <Crosshair className="size-4" /> : <Camera className="size-4" />}
                  {imp.viewpoints[id] ? `Déplacer ${id.toUpperCase()}` : `Placer ${id.toUpperCase()}`}
                </Button>
              ))}
            </div>
            {placing && <p className="mt-3 text-sm text-green">Cliquez sur le plan à l&apos;endroit de la prise de vue.</p>}
          </Card>

          <p className="px-1 text-xs leading-relaxed text-muted">
            Glisser le module pour le déplacer, la poignée ronde pour le faire pivoter (Maj : pas de 15°). Les cotes indiquent la
            distance aux limites les plus proches.
          </p>
        </div>
      </div>
    </>
  );
}

function useOrtho(model: SitePlanModel | null, enabled: boolean) {
  const [href, setHref] = useState<string | null>(null);
  const key = model ? `${model.origin.lat},${model.origin.lon},${model.frame.width.toFixed(0)},${model.frame.height.toFixed(0)}` : '';
  useEffect(() => {
    if (!enabled || !model) return;
    let alive = true;
    let url: string | null = null;
    const f = model.frame;
    const [lon, lat] = model.toLonLat({ x: (f.minX + f.maxX) / 2, y: (f.minY + f.maxY) / 2 });
    renderMap({ center: { lat, lon }, widthM: f.width, heightM: f.height, layers: ['ortho'], zoom: 19 })
      .then((m) => canvasToBlob(m.canvas, 'image/jpeg', 0.85))
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setHref(url);
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return enabled ? href : null;
}

const round = (v: number) => Math.round(v * 100) / 100;
function bearingTo(from: Vec, to: Vec) {
  return ((Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI + 360) % 360;
}
