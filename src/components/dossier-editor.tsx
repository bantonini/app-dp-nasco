'use client';

import { Check, ChevronLeft, ChevronRight, CloudOff, LoaderCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { declarantName, stepStatus, type DossierStatus, type StepId } from '@/lib/dossier';
import { useDossier, type SaveState } from '@/lib/hooks/use-dossier';
import { STATUS_LABELS } from './status-pill';
import { DeclarantStep } from './steps/declarant-step';
import { ExportStep } from './steps/export-step';
import { ImplantationStep } from './steps/implantation-step';
import { InsertionStep } from './steps/insertion-step';
import { PhotosStep } from './steps/photos-step';
import { ProjetStep } from './steps/projet-step';
import { TerrainStep } from './steps/terrain-step';
import type { StepProps } from './steps/types';
import { AppHeader } from './ui/brand';
import { Button, Select } from './ui/controls';
import { cn } from './ui/cn';

const STEPS: { id: StepId; label: string; detail: string; Component: React.ComponentType<StepProps> }[] = [
  { id: 'declarant', label: 'Déclarant', detail: 'Identité et coordonnées', Component: DeclarantStep },
  { id: 'terrain', label: 'Terrain', detail: 'Adresse et cadastre', Component: TerrainStep },
  { id: 'projet', label: 'Projet', detail: 'Description et surfaces', Component: ProjetStep },
  { id: 'implantation', label: 'Implantation', detail: 'Plan de masse · DP2', Component: ImplantationStep },
  { id: 'photos', label: 'Photographies', detail: 'DP7 · DP8', Component: PhotosStep },
  { id: 'insertion', label: 'Insertion', detail: 'Photomontage · DP6', Component: InsertionStep },
  { id: 'export', label: 'Dossier PDF', detail: 'Vérification et export', Component: ExportStep },
];

export function DossierEditor({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { dossier, loading, error, saveState, update } = useDossier(id);
  const current = STEPS.find((s) => s.id === params.get('etape')) ?? STEPS[0];
  const index = STEPS.indexOf(current);
  const go = (step: StepId) => {
    router.replace(`/dossiers/${id}?etape=${step}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="grid min-h-dvh place-items-center text-sm text-muted">Chargement du dossier…</div>;
  if (error || !dossier)
    return (
      <div className="grid min-h-dvh place-items-center text-center">
        <div>
          <p className="mb-4 text-muted">{error}</p>
          <Link href="/" className="underline">
            Retour aux dossiers
          </Link>
        </div>
      </div>
    );

  const status = stepStatus(dossier);
  const { Component } = current;

  return (
    <>
      <AppHeader>
        <SaveIndicator state={saveState} />
        <Select
          aria-label="Statut du dossier"
          className="h-9 w-auto min-w-36 text-sm"
          value={dossier.status}
          onChange={(e) => update((d) => ({ ...d, status: e.target.value as DossierStatus }))}
        >
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </AppHeader>

      <div className="mx-auto grid max-w-[1400px] gap-8 px-5 pt-8 pb-24 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Link href="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ChevronLeft className="size-4" /> Tous les dossiers
          </Link>
          <p className="text-xs text-muted tabular">{dossier.reference}</p>
          <p className="font-display mb-6 text-[1.6rem] leading-tight">{declarantName(dossier)}</p>
          <nav aria-label="Étapes du dossier">
            <ol className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {STEPS.map((s, i) => {
                const active = s.id === current.id;
                const done = status[s.id].done;
                return (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      onClick={() => go(s.id)}
                      aria-current={active ? 'step' : undefined}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-brand px-2.5 py-2 text-left transition-colors',
                        active ? 'bg-ink text-cream' : 'hover:bg-ink/5',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem] font-semibold tabular',
                          done ? 'bg-green text-cream' : active ? 'bg-cream text-ink' : 'border border-ink/30 text-muted',
                        )}
                      >
                        {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{s.label}</span>
                        <span className={cn('hidden text-xs lg:block', active ? 'text-cream/70' : 'text-muted')}>{s.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>

        <main className="min-w-0">
          <Component dossier={dossier} update={update} status={status} goTo={go} />
          <div className="mt-12 flex items-center justify-between border-t border-line pt-6">
            {index > 0 ? (
              <Button variant="ghost" onClick={() => go(STEPS[index - 1].id)}>
                <ChevronLeft className="size-4" /> {STEPS[index - 1].label}
              </Button>
            ) : (
              <span />
            )}
            {index < STEPS.length - 1 && (
              <Button onClick={() => go(STEPS[index + 1].id)}>
                {STEPS[index + 1].label} <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  return (
    <span className="hidden items-center gap-1.5 text-xs text-muted sm:flex" aria-live="polite">
      {state === 'saving' && (
        <>
          <LoaderCircle className="size-3.5 animate-spin" /> Enregistrement…
        </>
      )}
      {state === 'saved' && (
        <>
          <Check className="size-3.5 text-green" /> Enregistré
        </>
      )}
      {state === 'error' && (
        <span className="flex items-center gap-1.5 text-danger">
          <CloudOff className="size-3.5" /> Échec de l&apos;enregistrement
        </span>
      )}
    </span>
  );
}
