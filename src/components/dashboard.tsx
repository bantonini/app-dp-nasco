'use client';

import { ArrowRight, FilePlus2, FlaskConical, HardDrive, LogOut, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createDossier, declarantName, parcelLabel, progress, type Dossier } from '@/lib/dossier';
import { demoDossier } from '@/lib/demo';
import { repository } from '@/lib/storage';
import { getSupabase } from '@/lib/storage/supabase';
import { AppHeader, BrandBar } from './ui/brand';
import { Button } from './ui/controls';
import { StatusPill } from './status-pill';

export function Dashboard() {
  const router = useRouter();
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const repo = repository();

  useEffect(() => {
    repo.list().then(setDossiers).catch((e: Error) => setError(e.message));
  }, [repo]);

  async function create(kind: 'blank' | 'demo') {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const seq = await repo.nextSequence();
      const d = kind === 'demo' ? demoDossier(id, seq) : createDossier(id, seq);
      await repo.save(d);
      router.push(`/dossiers/${id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function remove(d: Dossier) {
    if (!window.confirm(`Supprimer définitivement le dossier ${d.reference} (${declarantName(d)}) ?`)) return;
    await repo.remove(d.id);
    setDossiers((all) => all?.filter((x) => x.id !== d.id) ?? null);
  }

  return (
    <>
      <AppHeader>
        {repo.kind === 'local' ? (
          <span className="hidden items-center gap-1.5 text-xs text-muted md:flex" title="Supabase n'est pas configuré">
            <HardDrive className="size-3.5" /> Stockage local (ce navigateur)
          </span>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => getSupabase()?.auth.signOut()}>
            <LogOut className="size-4" /> Déconnexion
          </Button>
        )}
      </AppHeader>

      <main className="mx-auto max-w-[1400px] px-5 pt-12 pb-24 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-end">
          <div>
            <p className="mb-3 text-xs font-medium tracking-[0.16em] text-green uppercase">Cerfa n° 16702 · Déclaration préalable</p>
            <h1 className="font-display text-[3.4rem] leading-[0.95] sm:text-[4.4rem]">
              Déclarations
              <br />
              préalables
            </h1>
            <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-muted">
              Constituez en quelques étapes le dossier complet d&apos;installation d&apos;un Pavillon N°1 : formulaire, plans de
              situation et de masse, coupes, façades, insertion paysagère et photographies — prêt à déposer en mairie.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => create('blank')} disabled={busy}>
                <FilePlus2 className="size-4" /> Nouveau dossier
              </Button>
              <Button size="lg" variant="outline" onClick={() => create('demo')} disabled={busy}>
                <FlaskConical className="size-4" /> Dossier d&apos;exemple
              </Button>
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/module/insertion-n4.svg" alt="Façade du Pavillon N°1" className="w-full drop-shadow-[0_18px_18px_rgba(0,0,0,0.12)]" />
        </div>

        <BrandBar className="mt-14 mb-10 max-w-[420px]" />

        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-[1.7rem]">Dossiers</h2>
          {dossiers && <span className="text-sm text-muted tabular">{dossiers.length} au total</span>}
        </div>

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        {dossiers === null ? (
          <div className="h-40 animate-pulse rounded-[6px] bg-paper" />
        ) : dossiers.length === 0 ? (
          <div className="rounded-[6px] border border-dashed border-line px-6 py-16 text-center text-muted">
            Aucun dossier pour l&apos;instant. Créez le premier, ou ouvrez le dossier d&apos;exemple pour découvrir l&apos;outil.
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[6px] border border-line bg-paper">
            {dossiers.map((d) => (
              <DossierRow key={d.id} dossier={d} onRemove={() => remove(d)} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function DossierRow({ dossier: d, onRemove }: { dossier: Dossier; onRemove: () => void }) {
  const pct = Math.round(progress(d) * 100);
  const parcel = d.terrain.parcelles[0];
  return (
    <li className="group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-cream/50 md:grid-cols-[130px_1.3fr_1fr_150px_110px_auto]">
      <span className="hidden text-sm text-muted tabular md:block">{d.reference}</span>
      <Link href={`/dossiers/${d.id}`} className="min-w-0">
        <p className="truncate font-medium">{declarantName(d)}</p>
        <p className="truncate text-sm text-muted md:hidden">{d.reference}</p>
      </Link>
      <p className="hidden truncate text-sm text-muted md:block">
        {d.terrain.commune || '—'}
        {parcel && ` · ${parcelLabel(parcel)}`}
      </p>
      <div className="hidden items-center gap-2 md:flex" aria-label={`Avancement ${pct} %`}>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
          <span className="block h-full bg-green" style={{ width: `${pct}%` }} />
        </span>
        <span className="w-9 text-right text-xs text-muted tabular">{pct} %</span>
      </div>
      <span className="hidden md:block">
        <StatusPill status={d.status} />
      </span>
      <div className="flex items-center gap-1">
        <Button variant="danger" size="sm" onClick={onRemove} aria-label="Supprimer" className="opacity-0 group-hover:opacity-100 focus:opacity-100">
          <Trash2 className="size-4" />
        </Button>
        <Link
          href={`/dossiers/${d.id}`}
          className="inline-flex size-8 items-center justify-center rounded-brand text-ink transition-colors hover:bg-ink hover:text-cream"
          aria-label="Ouvrir"
        >
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </li>
  );
}
