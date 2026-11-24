'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dossier, FileRef } from '../dossier';
import { repository } from '../storage';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
export type DossierUpdater = (recipe: (d: Dossier) => Dossier) => void;

/**
 * Charge un dossier et l'enregistre automatiquement (anti-rebond de 600 ms)
 * à chaque modification.
 */
export function useDossier(id: string) {
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const pending = useRef<Dossier | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    repository()
      .get(id)
      .then((d) => alive && (d ? setDossier(d) : setError('Dossier introuvable.')))
      .catch((e: Error) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const d = pending.current;
    if (!d) return;
    pending.current = null;
    setSaveState('saving');
    try {
      await repository().save(d);
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, []);

  const update: DossierUpdater = useCallback(
    (recipe) => {
      setDossier((prev) => {
        if (!prev) return prev;
        const next = { ...recipe(prev), updatedAt: new Date().toISOString() };
        pending.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 600);
    },
    [flush],
  );

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [flush]);

  return { dossier, loading, error, saveState, update, flush };
}

/** URL objet (blob:) d'un fichier du dossier, libérée automatiquement. */
export function useFileUrl(dossierId: string, ref: FileRef | null | undefined): string | null {
  const [loaded, setLoaded] = useState<{ key: string; url: string } | null>(null);
  const key = ref?.key;
  useEffect(() => {
    if (!ref) return;
    let objectUrl: string | null = null;
    let alive = true;
    repository()
      .getFile(dossierId, ref)
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setLoaded({ key: ref.key, url: objectUrl });
      });
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dossierId, key]);
  return key && loaded?.key === key ? loaded.url : null;
}
