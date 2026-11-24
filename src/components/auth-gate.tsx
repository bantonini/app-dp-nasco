'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/storage/supabase';

/**
 * Si Supabase est configuré, exige une session ; sinon l'application
 * fonctionne en mode local (sans compte).
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(() => !getSupabase());

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else router.replace(`/connexion?suite=${encodeURIComponent(pathname)}`);
    });
    const { data: sub } = sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/connexion');
    });
    return () => sub.subscription.unsubscribe();
  }, [router, pathname]);

  if (!ready) return <div className="grid min-h-dvh place-items-center text-sm text-muted">Chargement…</div>;
  return <>{children}</>;
}
