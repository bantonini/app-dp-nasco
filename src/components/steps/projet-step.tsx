'use client';

import { RotateCcw } from 'lucide-react';
import type { Projet } from '@/lib/dossier';
import { DEFAULT_DESCRIPTION, fr, MODULE } from '@/lib/module';
import { Button, Card, Field, Input, Notice, SectionTitle, Select, Textarea } from '../ui/controls';
import type { StepProps } from './types';

const DESTINATIONS: { value: Projet['destination']; label: string }[] = [
  { value: 'habitation', label: 'Habitation — logement' },
  { value: 'annexe', label: "Annexe à l'habitation existante" },
  { value: 'hebergement-touristique', label: 'Hébergement touristique' },
];

export function ProjetStep({ dossier, update }: StepProps) {
  const p = dossier.projet;
  const set = <K extends keyof Projet>(key: K, value: Projet[K]) => update((x) => ({ ...x, projet: { ...x.projet, [key]: value } }));
  const num = (v: string) => (v === '' ? 0 : Number(v.replace(',', '.')));

  return (
    <>
      <SectionTitle eyebrow="Cerfa · rubriques 4 et 5" title="Le projet" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="grid content-start gap-5 p-6">
          <Field
            label="Courte description du projet"
            hint="Reportée telle quelle dans le formulaire et la notice. Le texte par défaut décrit le Pavillon N°1."
          >
            {(id) => <Textarea id={id} rows={7} value={p.description} onChange={(e) => set('description', e.target.value)} />}
          </Field>
          <div>
            <Button variant="ghost" size="sm" onClick={() => set('description', DEFAULT_DESCRIPTION)} disabled={p.description === DEFAULT_DESCRIPTION}>
              <RotateCcw className="size-3.5" /> Rétablir le texte NASCO
            </Button>
          </div>
          <Field label="Destination">
            {(id) => (
              <Select id={id} value={p.destination} onChange={(e) => set('destination', e.target.value as Projet['destination'])}>
                {DESTINATIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Raccordements aux réseaux">
            {(id) => <Input id={id} value={p.raccordements} onChange={(e) => set('raccordements', e.target.value)} />}
          </Field>
        </Card>

        <div className="grid content-start gap-6">
          <Card className="grid gap-5 p-6 sm:grid-cols-2">
            <Field label="Surface de plancher créée (m²)">
              {(id) => <Input id={id} inputMode="decimal" value={p.surfacePlancher} onChange={(e) => set('surfacePlancher', num(e.target.value))} />}
            </Field>
            <Field label="Emprise au sol créée (m²)">
              {(id) => <Input id={id} inputMode="decimal" value={p.emprise} onChange={(e) => set('emprise', num(e.target.value))} />}
            </Field>
            <Field label="Hauteur maximale (m)">
              {(id) => <Input id={id} inputMode="decimal" value={p.hauteur} onChange={(e) => set('hauteur', num(e.target.value))} />}
            </Field>
            <Field label="Surface existante (m²)" hint="Surface de plancher déjà bâtie sur le terrain.">
              {(id) => <Input id={id} inputMode="decimal" value={p.surfaceExistante} onChange={(e) => set('surfaceExistante', num(e.target.value))} />}
            </Field>
          </Card>
          <RegulatoryNotice emprise={p.emprise} surface={p.surfacePlancher} />
          <Card className="p-5">
            <p className="mb-3 text-xs font-medium tracking-wide text-muted uppercase">Module {MODULE.name}</p>
            <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
              <dt className="text-muted">Dimensions hors-tout</dt>
              <dd className="text-right tabular">
                {fr(MODULE.length)} × {fr(MODULE.width)} m
              </dd>
              <dt className="text-muted">Hauteur</dt>
              <dd className="text-right tabular">{fr(MODULE.height)} m</dd>
              <dt className="text-muted">Emprise au sol</dt>
              <dd className="text-right tabular">{fr(MODULE.footprint, 1)} m²</dd>
              <dt className="text-muted">Surface de plancher</dt>
              <dd className="text-right tabular">{fr(MODULE.floorArea, 1)} m²</dd>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}

function RegulatoryNotice({ emprise, surface }: { emprise: number; surface: number }) {
  const max = Math.max(emprise, surface);
  if (max > 40)
    return <Notice tone="warn">Au-delà de 40 m² d&apos;emprise ou de surface de plancher, un permis de construire est nécessaire.</Notice>;
  if (max > 20)
    return (
      <Notice tone="warn">
        Entre 20 et 40 m², la déclaration préalable n&apos;est possible qu&apos;en zone urbaine d&apos;un PLU (et si la surface totale
        reste ≤ 150 m²). Sinon, un permis de construire est requis.
      </Notice>
    );
  return (
    <Notice tone="ok">
      Emprise et surface de plancher ≤ 20 m² : le projet relève de la déclaration préalable (art. R. 421-9 du code de l&apos;urbanisme).
    </Notice>
  );
}
