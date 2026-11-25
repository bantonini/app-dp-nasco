'use client';

import { ImagePlus, LoaderCircle, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import type { FileRef } from '@/lib/dossier';
import { useFileUrl } from '@/lib/hooks/use-dossier';
import { prepareImage } from '@/lib/images';
import { repository } from '@/lib/storage';
import { cn } from './ui/cn';

/** Zone de dépôt d'une photo : redimensionnement, envoi, aperçu. */
export function PhotoDrop({
  dossierId,
  value,
  onChange,
  label,
  className,
  accept = 'image/*',
  keepAlpha = false,
}: {
  dossierId: string;
  value: FileRef | null;
  onChange: (ref: FileRef) => void;
  label: string;
  className?: string;
  accept?: string;
  keepAlpha?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = useFileUrl(dossierId, value);

  async function handle(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Format non reconnu : choisissez une image (JPEG, PNG, HEIC converti…).');
    setBusy(true);
    setError(null);
    try {
      const img = await prepareImage(file, keepAlpha ? 1600 : 2400);
      const ref = await repository().putFile(dossierId, img.blob, { name: file.name, width: img.width, height: img.height });
      onChange(ref);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
        className={cn(
          'group relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[6px] border text-sm transition-colors',
          url ? 'border-line bg-ink' : 'border-dashed border-ink/30 bg-paper hover:border-ink hover:bg-cream/40',
          over && 'border-green bg-green-50',
        )}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label} className="absolute inset-0 h-full w-full object-cover" />
            <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-brand bg-paper/95 px-2.5 py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100">
              <RefreshCw className="size-3.5" /> Remplacer
            </span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-2 px-6 text-center text-muted">
            <ImagePlus className="size-7 text-ink" strokeWidth={1.5} />
            <span className="font-medium text-ink">{label}</span>
            <span className="text-xs">Glisser une photo ici ou cliquer pour choisir</span>
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-paper/80">
            <LoaderCircle className="size-6 animate-spin" />
          </span>
        )}
      </button>
      <input ref={input} type="file" accept={accept} className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
