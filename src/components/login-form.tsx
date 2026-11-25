'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { getSupabase } from '@/lib/storage/supabase';
import { BrandBar, VerticalMark, Wordmark } from './ui/brand';
import { Button, Field, Input, Notice } from './ui/controls';

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('suite') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = getSupabase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sb) return;
    setBusy(true);
    setError(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setError('Identifiants incorrects.');
    else router.replace(next.startsWith('/') ? next : '/');
  }

  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="relative w-full max-w-sm">
        <VerticalMark className="absolute top-1 -left-10 hidden sm:flex" />
        <Wordmark className="text-[2rem]" />
        <p className="font-display mt-2 text-xl">Pavillon N°1 · Déclarations préalables</p>
        <BrandBar className="mt-6 mb-8" />
        {!sb ? (
          <Notice>Supabase n&apos;est pas configuré : l&apos;application fonctionne sans compte, en stockage local.</Notice>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="E-mail">
              {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Field label="Mot de passe">
              {(id) => (
                <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
            </Field>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" size="lg" disabled={busy} className="mt-2">
              {busy ? 'Connexion…' : 'Se connecter'}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
