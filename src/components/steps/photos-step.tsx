'use client';

import { Camera } from 'lucide-react';
import { PhotoDrop } from '../photo-drop';
import { Card, Notice, SectionTitle } from '../ui/controls';
import type { StepProps } from './types';

const SLOTS = [
  {
    id: 'dp7' as const,
    code: 'DPC7',
    title: "Environnement proche",
    text: "Photographie du terrain prise depuis ses abords immédiats, montrant l'emplacement du futur module et les constructions ou plantations voisines.",
  },
  {
    id: 'dp8' as const,
    code: 'DPC8',
    title: 'Paysage lointain',
    text: "Photographie situant le terrain dans le paysage environnant, prise depuis l'espace public ou un point de vue éloigné.",
  },
];

export function PhotosStep({ dossier, update, goTo }: StepProps) {
  const vps = dossier.implantation.viewpoints;
  return (
    <>
      <SectionTitle eyebrow="Pièces DPC7 et DPC8" title="Photographies" />
      <div className="grid gap-6 md:grid-cols-2">
        {SLOTS.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="mb-4 flex items-baseline gap-3">
              <span className="font-display rounded-brand bg-ink px-2 py-0.5 text-sm text-cream">{s.code}</span>
              <h3 className="font-display text-xl">{s.title}</h3>
            </div>
            <PhotoDrop
              dossierId={dossier.id}
              value={dossier.photos[s.id]}
              label={`Photo ${s.code}`}
              onChange={(ref) =>
                update((d) => ({
                  ...d,
                  photos: { ...d.photos, [s.id]: ref },
                  // Une nouvelle photo de base invalide le photomontage enregistré.
                  insertion: d.insertion.base === s.id ? { ...d.insertion, result: null } : d.insertion,
                }))
              }
            />
            <p className="mt-4 text-sm leading-relaxed text-muted">{s.text}</p>
            {!vps[s.id] && (
              <button onClick={() => goTo('implantation')} className="mt-3 inline-flex items-center gap-1.5 text-sm text-green underline">
                <Camera className="size-4" /> Reporter le point de vue sur le plan de masse
              </button>
            )}
          </Card>
        ))}
      </div>
      <div className="mt-6">
        <Notice>
          Conseil : photographiez à hauteur d&apos;homme, en format paysage, en évitant le contre-jour. La photo DPC7 sert aussi de base
          au photomontage (DPC6).
        </Notice>
      </div>
    </>
  );
}
