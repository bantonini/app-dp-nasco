'use client';

import { useEffect, useRef, useState } from 'react';
import type { Parcelle } from '@/lib/dossier';
import { outerRings } from '@/lib/geo/geometry';
import { drawLocationMarker, drawRings, renderMap, type MapLayer } from '@/lib/geo/maps';
import { cn } from './ui/cn';

/** Aperçu cartographique IGN (tuiles relayées par /api/ign/tuiles). */
export function MapPreview({
  center,
  parcelles,
  layers,
  widthM,
  heightM,
  zoom,
  marker = false,
  className,
}: {
  center: { lat: number; lon: number };
  parcelles: Parcelle[];
  layers: MapLayer[];
  widthM: number;
  heightM: number;
  zoom: number;
  marker?: boolean;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState<{ key: string; partial: boolean } | null>(null);
  const key = `${center.lat},${center.lon},${layers.join('+')},${zoom},${parcelles.map((p) => p.idu).join()}`;

  useEffect(() => {
    let alive = true;
    renderMap({ center, widthM, heightM, layers, zoom }).then((map) => {
      if (!alive || !host.current) return;
      const ctx = map.canvas.getContext('2d')!;
      const rings = parcelles.flatMap((p) => outerRings(p.geometry));
      if (rings.length) drawRings(ctx, rings, map.project, { stroke: '#d0021b', width: 3, fill: 'rgba(208,2,27,0.10)' });
      if (marker) {
        const c = map.project([center.lon, center.lat]);
        drawLocationMarker(ctx, c.x, c.y, 14);
      }
      map.canvas.className = 'block h-full w-full object-cover';
      host.current.replaceChildren(map.canvas);
      setRendered({ key, partial: map.failedTiles > 0 });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, widthM, heightM]);

  const state = rendered?.key !== key ? 'loading' : rendered.partial ? 'partial' : 'ready';
  return (
    <div className={cn('relative overflow-hidden rounded-[6px] border border-line bg-[#f1f0ea]', className)}>
      <div ref={host} className="h-full w-full" />
      {state === 'loading' && <div className="absolute inset-0 animate-pulse bg-cream/60" />}
      {state === 'partial' && (
        <p className="absolute right-2 bottom-2 rounded-brand bg-paper/90 px-2 py-1 text-[0.7rem] text-muted">
          Fond IGN partiellement indisponible
        </p>
      )}
      <p className="absolute bottom-2 left-2 rounded-brand bg-paper/80 px-1.5 py-0.5 text-[0.65rem] text-muted">© IGN – Géoplateforme</p>
    </div>
  );
}
