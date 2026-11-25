import type { Vec } from '@/lib/geo/geometry';
import { parcelLabel } from '@/lib/dossier';
import { MODULE } from '@/lib/module';
import type { SitePlanModel } from '@/lib/site-plan';

export interface SitePlanSvgProps {
  model: SitePlanModel;
  /** Mètres représentés par 1 mm imprimé (= échelle / 1000) : règle épaisseurs et textes. */
  unit: number;
  orthoHref?: string | null;
  interactive?: boolean;
  /** Dimensions physiques (export) — sinon l'SVG s'adapte à son conteneur. */
  sizeMm?: { width: number; height: number };
  className?: string;
  svgRef?: React.Ref<SVGSVGElement>;
  handlers?: Pick<React.SVGProps<SVGSVGElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel'>;
}

const INK = '#141414';
const GREEN = '#204f1a';
const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Plan de masse (DPC2), dessiné en mètres dans le repère local (x Est, y Nord).
 * Utilisé à la fois pour l'éditeur interactif et pour l'export PDF.
 */
export function SitePlanSvg({ model, unit: u, orthoHref, interactive, sizeMm, className, svgRef, handlers }: SitePlanSvgProps) {
  const { frame } = model;
  const P = (v: Vec) => `${v.x.toFixed(3)},${(-v.y).toFixed(3)}`;
  const path = (rings: Vec[][]) => rings.map((r) => `M${r.map(P).join('L')}Z`).join('');
  const font = { fontFamily: 'Helvetica, Arial, sans-serif' };
  const front = model.module.slice(0, 2);
  const frontMid = mid(front[0], front[1]);
  const normal = unitVec(model.center, frontMid);
  const rotHandle = add(frontMid, scale(normal, 9 * u));

  return (
    <svg
      ref={svgRef}
      {...handlers}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${frame.minX} ${-frame.maxY} ${frame.width} ${frame.height}`}
      width={sizeMm ? `${sizeMm.width}mm` : undefined}
      height={sizeMm ? `${sizeMm.height}mm` : undefined}
      className={className}
      style={{ ...font, touchAction: interactive ? 'none' : undefined }}
    >
      <defs>
        <clipPath id="sp-frame">
          <rect x={frame.minX} y={-frame.maxY} width={frame.width} height={frame.height} />
        </clipPath>
        <pattern id="sp-hatch" width={1.2 * u} height={1.2 * u} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2={1.2 * u} stroke="#8a897f" strokeWidth={0.18 * u} />
        </pattern>
      </defs>

      <rect x={frame.minX} y={-frame.maxY} width={frame.width} height={frame.height} fill="#ffffff" />
      <g clipPath="url(#sp-frame)">
        {orthoHref && (
          <image href={orthoHref} x={frame.minX} y={-frame.maxY} width={frame.width} height={frame.height} preserveAspectRatio="none" opacity={0.85} />
        )}

        {/* Parcelles voisines */}
        {model.neighbours.map((n) => (
          <g key={n.parcelle.idu}>
            <path d={path(n.rings)} fill={orthoHref ? 'none' : '#f4f4ef'} stroke="#9d9c92" strokeWidth={0.18 * u} />
            <text x={n.labelAt.x} y={-n.labelAt.y} fontSize={2.2 * u} fill="#8a897f" textAnchor="middle" dominantBaseline="middle">
              {n.parcelle.numero.replace(/^0+/, '')}
            </text>
          </g>
        ))}

        {/* Bâti existant */}
        {model.buildings.map((r, i) => (
          <path key={i} d={path([r])} fill="url(#sp-hatch)" stroke="#55544c" strokeWidth={0.3 * u} />
        ))}

        {/* Terrain d'assiette */}
        {model.parcels.map((p) => (
          <path key={p.parcelle.idu} d={path(p.rings)} fill={orthoHref ? 'rgba(255,255,255,0.12)' : 'none'} stroke={INK} strokeWidth={0.55 * u} strokeDasharray={`${3 * u} ${0.8 * u} ${0.5 * u} ${0.8 * u}`} />
        ))}
        {model.parcels.map((p) => (
          <Label key={`l${p.parcelle.idu}`} at={{ x: p.labelAt.x, y: p.labelAt.y + 9 * u }} u={u}>
            {`Parcelle ${parcelLabel(p.parcelle)} — ${p.parcelle.contenance.toLocaleString('fr-FR')} m²`}
          </Label>
        ))}

        {/* Cotes aux limites séparatives */}
        {model.distances.map((d, i) => (
          <Dimension key={i} from={d.from} to={d.to} u={u} label={`${fmt(d.distance)} m`} />
        ))}

        {/* Module projeté */}
        <g data-handle={interactive ? 'module' : undefined} style={{ cursor: interactive ? 'move' : undefined }}>
          <path d={path([model.module])} fill={GREEN} fillOpacity={0.88} stroke={INK} strokeWidth={0.5 * u} />
          {/* Repère de la façade d'entrée (N4) */}
          <path d={`M${P(lerp(front[0], front[1], 0.44))}L${P(lerp(front[0], front[1], 0.56))}L${P(add(frontMid, scale(normal, -0.9)))}Z`} fill="#ebebe0" />
        </g>
        <Dimension from={model.module[3]} to={model.module[2]} u={u} offset={MODULE.width * 0.28} label={fmt(MODULE.length)} light />
        <Dimension from={model.module[2]} to={model.module[1]} u={u} offset={Math.min(1, 3 * u)} label={fmt(MODULE.width)} light />
        <Label at={add(model.center, scale(normal, -(MODULE.width / 2 + 7.5 * u)))} u={u} strong>
          {`${MODULE.name} projeté — ${MODULE.footprint.toLocaleString('fr-FR', { minimumFractionDigits: 1 })} m²`}
        </Label>

        {interactive && (
          <g data-handle="rotate" style={{ cursor: 'grab' }}>
            <line x1={frontMid.x} y1={-frontMid.y} x2={rotHandle.x} y2={-rotHandle.y} stroke={GREEN} strokeWidth={0.3 * u} />
            <circle cx={rotHandle.x} cy={-rotHandle.y} r={1.8 * u} fill="#ffffff" stroke={GREEN} strokeWidth={0.5 * u} />
          </g>
        )}

        {/* Points de vue photographiques */}
        {model.viewpoints.map(({ id, label, vp }) => {
          const dir = { x: Math.sin((vp.bearing * Math.PI) / 180), y: Math.cos((vp.bearing * Math.PI) / 180) };
          const reach = 14 * u;
          const left = rotateVec(dir, -22), right = rotateVec(dir, 22);
          const tip = add(vp, scale(dir, reach));
          return (
            <g key={id}>
              <path d={`M${P(vp)}L${P(add(vp, scale(left, reach)))}L${P(add(vp, scale(right, reach)))}Z`} fill="#d0021b" fillOpacity={0.13} stroke="#d0021b" strokeWidth={0.2 * u} />
              <line x1={vp.x} y1={-vp.y} x2={tip.x} y2={-tip.y} stroke="#d0021b" strokeWidth={0.35 * u} />
              {interactive && <circle data-handle={`${id}-aim`} cx={tip.x} cy={-tip.y} r={1.6 * u} fill="#ffffff" stroke="#d0021b" strokeWidth={0.4 * u} style={{ cursor: 'grab' }} />}
              <g data-handle={interactive ? id : undefined} style={{ cursor: interactive ? 'move' : undefined }}>
                <circle cx={vp.x} cy={-vp.y} r={3 * u} fill="#d0021b" />
                <text x={vp.x} y={-vp.y} fontSize={2 * u} fontWeight={700} fill="#ffffff" textAnchor="middle" dominantBaseline="central">
                  {label}
                </text>
              </g>
            </g>
          );
        })}
      </g>

      <NorthArrow x={frame.maxX - 9 * u} y={frame.maxY - 6 * u} u={u} />
    </svg>
  );
}

function Label({ at, u, children, strong }: { at: Vec; u: number; children: string; strong?: boolean }) {
  return (
    <text
      x={at.x}
      y={-at.y}
      fontSize={(strong ? 2.6 : 2.3) * u}
      fontWeight={strong ? 700 : 400}
      fill={strong ? '#204f1a' : INK}
      textAnchor="middle"
      dominantBaseline="middle"
      paintOrder="stroke"
      stroke="#ffffff"
      strokeWidth={0.9 * u}
      strokeLinejoin="round"
    >
      {children}
    </text>
  );
}

function Dimension({ from, to, u, label, offset = 0, light }: { from: Vec; to: Vec; u: number; label: string; offset?: number; light?: boolean }) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < 0.05) return null;
  const dir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
  const n = { x: -dir.y, y: dir.x };
  const a = add(from, scale(n, offset)), b = add(to, scale(n, offset));
  const m = mid(a, b);
  let angle = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  const tick = (p: Vec) => {
    const t1 = add(p, scale(add(dir, n), 0.9 * u)), t2 = add(p, scale(add(dir, n), -0.9 * u));
    return <line x1={t1.x} y1={-t1.y} x2={t2.x} y2={-t2.y} stroke={INK} strokeWidth={0.3 * u} />;
  };
  const color = light ? '#ebebe0' : INK;
  return (
    <g>
      <line x1={a.x} y1={-a.y} x2={b.x} y2={-b.y} stroke={light ? '#ebebe0' : INK} strokeWidth={0.2 * u} />
      {!light && tick(a)}
      {!light && tick(b)}
      <text
        transform={`translate(${m.x} ${-m.y}) rotate(${angle})`}
        y={-0.8 * u}
        fontSize={2.1 * u}
        fill={color}
        textAnchor="middle"
        paintOrder="stroke"
        stroke={light ? 'none' : '#ffffff'}
        strokeWidth={0.8 * u}
      >
        {label}
      </text>
    </g>
  );
}

function NorthArrow({ x, y, u }: { x: number; y: number; u: number }) {
  const s = 4 * u;
  return (
    <g transform={`translate(${x} ${-y})`}>
      <circle r={s * 1.35} fill="#ffffff" stroke={INK} strokeWidth={0.25 * u} />
      <path d={`M0 ${-s}L${s * 0.45} ${s * 0.75}L0 ${s * 0.35}Z`} fill={INK} />
      <path d={`M0 ${-s}L${-s * 0.45} ${s * 0.75}L0 ${s * 0.35}Z`} fill="#ffffff" stroke={INK} strokeWidth={0.2 * u} />
      <text y={-s * 1.6} fontSize={2.6 * u} fontWeight={700} textAnchor="middle" fill={INK}>
        N
      </text>
    </g>
  );
}

const add = (a: Vec, b: Vec) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Vec, k: number) => ({ x: a.x * k, y: a.y * k });
const mid = (a: Vec, b: Vec) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const lerp = (a: Vec, b: Vec, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const unitVec = (a: Vec, b: Vec) => {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
};
const rotateVec = (v: Vec, deg: number) => {
  const t = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(t) + v.y * Math.sin(t), y: -v.x * Math.sin(t) + v.y * Math.cos(t) };
};
