'use client';

import { AlertTriangle, CheckCircle2, Download, FileText, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { StepId } from '@/lib/dossier';
import { declarantName } from '@/lib/dossier';
import type { BuildProgress } from '@/lib/pdf/build';
import { Button, Card, Field, Input, Notice, SectionTitle } from '../ui/controls';
import type { StepProps } from './types';

const PIECES: { code: string; label: string; step: StepId }[] = [
  { code: 'Cerfa', label: 'Récapitulatif du formulaire 13703', step: 'declarant' },
  { code: 'DP1', label: 'Plan de situation (1/25 000 et 1/5 000)', step: 'terrain' },
  { code: 'DP2', label: 'Plan de masse coté', step: 'implantation' },
  { code: 'DP3', label: 'Coupes du module (1/50)', step: 'projet' },
  { code: 'DP4', label: 'Façades, plan et toiture (1/50, 1/75)', step: 'projet' },
  { code: 'DP6', label: 'Insertion paysagère', step: 'insertion' },
  { code: 'DP7', label: 'Photographie — environnement proche', step: 'photos' },
  { code: 'DP8', label: 'Photographie — paysage lointain', step: 'photos' },
];

export function ExportStep({ dossier, update, status, goTo }: StepProps) {
  const [progress, setProgress] = useState<BuildProgress | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => void (pdfUrl && URL.revokeObjectURL(pdfUrl)), [pdfUrl]);

  const incomplete = (Object.entries(status) as [StepId, (typeof status)[StepId]][]).filter(([id, s]) => id !== 'export' && !s.done);
  const fileName = `DP-${dossier.reference}-${declarantName(dossier).replace(/[^\p{L}\d]+/gu, '-')}.pdf`;

  async function generate() {
    setError(null);
    setPdfUrl(null);
    try {
      const { buildDossierPdf } = await import('@/lib/pdf/build');
      const bytes = await buildDossierPdf(dossier, setProgress);
      setPdfUrl(URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
      <SectionTitle eyebrow="Vérification et export" title="Dossier PDF" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="grid content-start gap-6">
          <Card className="p-6">
            <h3 className="font-display mb-4 text-lg">Pièces du dossier</h3>
            <ul className="divide-y divide-line">
              {PIECES.map((p) => {
                const ok = status[p.step].done;
                return (
                  <li key={p.code} className="flex items-center gap-3 py-2.5">
                    <span className="font-display w-14 shrink-0 text-sm">{p.code}</span>
                    <span className="flex-1 text-sm">{p.label}</span>
                    {ok ? (
                      <CheckCircle2 className="size-4 text-green" aria-label="Complet" />
                    ) : (
                      <button onClick={() => goTo(p.step)} className="text-xs text-[#8a5a00] underline">
                        À compléter
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="grid gap-4 p-6 sm:grid-cols-2">
            <h3 className="font-display text-lg sm:col-span-2">Engagement du déclarant</h3>
            <Field label="Fait à">
              {(id) => (
                <Input id={id} value={dossier.engagement.lieu} onChange={(e) => update((d) => ({ ...d, engagement: { ...d.engagement, lieu: e.target.value } }))} />
              )}
            </Field>
            <Field label="Le">
              {(id) => (
                <Input id={id} type="date" value={dossier.engagement.date} onChange={(e) => update((d) => ({ ...d, engagement: { ...d.engagement, date: e.target.value } }))} />
              )}
            </Field>
          </Card>

          {incomplete.length > 0 && (
            <Notice tone="warn">
              <span className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  Il reste des éléments à compléter : {incomplete.flatMap(([, s]) => s.missing).join(', ')}. Vous pouvez tout de même
                  générer un PDF de travail.
                </span>
              </span>
            </Notice>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" variant="accent" onClick={generate} disabled={!!progress}>
              {progress ? <LoaderCircle className="size-4 animate-spin" /> : <FileText className="size-4" />}
              {progress ? `${progress.step}…` : 'Générer le dossier PDF'}
            </Button>
            {pdfUrl && (
              <a
                href={pdfUrl}
                download={fileName}
                onClick={() => dossier.status === 'brouillon' && incomplete.length === 0 && update((d) => ({ ...d, status: 'pret' }))}
                className="inline-flex h-12 items-center gap-2 rounded-brand border border-ink px-6 text-[0.95rem] font-medium hover:bg-ink hover:text-cream"
              >
                <Download className="size-4" /> Télécharger
              </a>
            )}
          </div>
          {progress && (
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-green transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          )}
          {error && <p className="text-sm text-danger">Échec de la génération : {error}</p>}
        </div>

        <div className="min-h-[560px] overflow-hidden rounded-[6px] border border-line bg-paper">
          {pdfUrl ? (
            <iframe src={pdfUrl} title="Aperçu du dossier PDF" className="h-full min-h-[720px] w-full" />
          ) : (
            <div className="grid h-full min-h-[560px] place-items-center p-10 text-center text-sm text-muted">
              L&apos;aperçu du dossier s&apos;affichera ici après la génération.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
