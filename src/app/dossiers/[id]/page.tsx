import { AuthGate } from '@/components/auth-gate';
import { DossierEditor } from '@/components/dossier-editor';

export const metadata = { title: 'Dossier' };

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthGate>
      <DossierEditor id={id} />
    </AuthGate>
  );
}
