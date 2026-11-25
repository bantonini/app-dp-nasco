import type { Dossier, StepId, StepStatus } from '@/lib/dossier';
import type { DossierUpdater } from '@/lib/hooks/use-dossier';

export interface StepProps {
  dossier: Dossier;
  update: DossierUpdater;
  status: Record<StepId, StepStatus>;
  goTo: (step: StepId) => void;
}
