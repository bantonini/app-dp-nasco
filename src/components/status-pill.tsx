import type { DossierStatus } from '@/lib/dossier';
import { cn } from './ui/cn';

const LABELS: Record<DossierStatus, string> = { brouillon: 'Brouillon', pret: 'Prêt à déposer', depose: 'Déposé' };

export function StatusPill({ status }: { status: DossierStatus }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium',
        status === 'brouillon' && 'bg-cream text-muted ring-1 ring-line',
        status === 'pret' && 'bg-green-50 text-green ring-1 ring-green/25',
        status === 'depose' && 'bg-ink text-cream',
      )}
    >
      {LABELS[status]}
    </span>
  );
}

export const STATUS_LABELS = LABELS;
