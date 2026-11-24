'use client';

import { CheckCircle2 } from 'lucide-react';
import type { Insertion } from '@/lib/dossier';
import { useFileUrl } from '@/lib/hooks/use-dossier';
import { INSERTION_SPRITES, type InsertionSpriteId } from '@/lib/module';
import { InsertionEditor } from '../insertion/insertion-editor';
import { PhotoDrop } from '../photo-drop';
import { Card, Notice, SectionTitle, Segmented } from '../ui/controls';
import type { StepProps } from './types';

export function InsertionStep({ dossier, update, goTo }: StepProps) {
  const ins = dossier.insertion;
  const set = (patch: Partial<Insertion>) => update((d) => ({ ...d, insertion: { ...d.insertion, ...patch } }));
  // Toute modification du montage invalide l'image enregistrée.
  const edit = (patch: Partial<Insertion>) => set({ ...patch, result: null });

  const baseRef = ins.base === 'custom' ? ins.customPhoto : dossier.photos[ins.base];
  const photoUrl = useFileUrl(dossier.id, baseRef);
  const customSpriteUrl = useFileUrl(dossier.id, ins.customSprite);
  const maskUrl = useFileUrl(dossier.id, ins.mask);
  const spriteUrl = ins.customSprite ? customSpriteUrl : INSERTION_SPRITES.find((s) => s.id === ins.sprite)!.url;

  return (
    <>
      <SectionTitle eyebrow="Pièce DP6" title="Insertion paysagère">
        {ins.result && (
          <span className="inline-flex items-center gap-1.5 text-sm text-green">
            <CheckCircle2 className="size-4" /> Photomontage enregistré
          </span>
        )}
      </SectionTitle>

      <Card className="mb-6 flex flex-wrap items-center gap-x-8 gap-y-4 p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Photo</span>
          <Segmented
            value={ins.base}
            onChange={(v) => edit({ base: v, corners: null, mask: null })}
            options={[
              { value: 'dp7', label: 'DP7' },
              { value: 'dp8', label: 'DP8' },
              { value: 'custom', label: 'Autre' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium tracking-wide text-muted uppercase">Vue du module</span>
          <Segmented
            value={ins.customSprite ? 'custom' : ins.sprite}
            onChange={(v) => v !== 'custom' && edit({ sprite: v as InsertionSpriteId, customSprite: null, corners: null })}
            options={[...INSERTION_SPRITES.map((s) => ({ value: s.id as string, label: s.label })), ...(ins.customSprite ? [{ value: 'custom', label: 'Image importée' }] : [])]}
          />
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">Importer un rendu 3D (PNG transparent)</summary>
          <PhotoDrop
            className="mt-3 w-64"
            dossierId={dossier.id}
            value={ins.customSprite}
            label="Rendu du module"
            accept="image/png"
            keepAlpha
            onChange={(ref) => edit({ customSprite: ref, corners: null })}
          />
        </details>
      </Card>

      {ins.base === 'custom' && !ins.customPhoto && (
        <PhotoDrop className="max-w-xl" dossierId={dossier.id} value={null} label="Photo pour le photomontage" onChange={(ref) => edit({ customPhoto: ref })} />
      )}

      {!baseRef && ins.base !== 'custom' && (
        <Notice tone="warn">
          Ajoutez d&apos;abord la photo {ins.base.toUpperCase()}.{' '}
          <button className="underline" onClick={() => goTo('photos')}>
            Aller aux photographies
          </button>
        </Notice>
      )}

      {photoUrl && spriteUrl && (
        <InsertionEditor
          key={`${baseRef?.key}-${spriteUrl}`}
          dossier={dossier}
          photoUrl={photoUrl}
          spriteUrl={spriteUrl}
          initialMaskUrl={maskUrl}
          onChange={edit}
          onSaved={({ result, mask }) => set({ result, mask })}
        />
      )}
    </>
  );
}
