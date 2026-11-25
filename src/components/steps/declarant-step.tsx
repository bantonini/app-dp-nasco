'use client';

import type { Declarant, PostalAddress } from '@/lib/dossier';
import { Card, Field, Input, Segmented, SectionTitle, Select } from '../ui/controls';
import type { StepProps } from './types';

export function DeclarantStep({ dossier, update }: StepProps) {
  const d = dossier.declarant;
  const set = <K extends keyof Declarant>(key: K, value: Declarant[K]) =>
    update((x) => ({ ...x, declarant: { ...x.declarant, [key]: value } }));
  const setAddress = (key: keyof PostalAddress, value: string) =>
    update((x) => ({ ...x, declarant: { ...x.declarant, adresse: { ...x.declarant.adresse, [key]: value } } }));

  return (
    <>
      <SectionTitle eyebrow="Cerfa · rubriques 1 et 2" title="Le déclarant">
        <Segmented
          value={d.type}
          onChange={(v) => set('type', v)}
          options={[
            { value: 'particulier', label: 'Particulier' },
            { value: 'societe', label: 'Personne morale' },
          ]}
        />
      </SectionTitle>

      <div className="grid gap-6">
        <Card className="grid gap-5 p-6 sm:grid-cols-6">
          {d.type === 'particulier' ? (
            <>
              <Field label="Civilité" className="sm:col-span-2">
                {(id) => (
                  <Select id={id} value={d.civilite} onChange={(e) => set('civilite', e.target.value as Declarant['civilite'])}>
                    <option value="">—</option>
                    <option>Madame</option>
                    <option>Monsieur</option>
                  </Select>
                )}
              </Field>
              <Field label="Nom" className="sm:col-span-2">
                {(id) => <Input id={id} autoComplete="family-name" value={d.nom} onChange={(e) => set('nom', e.target.value)} />}
              </Field>
              <Field label="Prénom" className="sm:col-span-2">
                {(id) => <Input id={id} autoComplete="given-name" value={d.prenom} onChange={(e) => set('prenom', e.target.value)} />}
              </Field>
              <Field label="Date de naissance" className="sm:col-span-2">
                {(id) => <Input id={id} type="date" value={d.dateNaissance} onChange={(e) => set('dateNaissance', e.target.value)} />}
              </Field>
              <Field label="Lieu de naissance" className="sm:col-span-4" hint="Commune et département (ou pays).">
                {(id) => <Input id={id} value={d.lieuNaissance} onChange={(e) => set('lieuNaissance', e.target.value)} />}
              </Field>
            </>
          ) : (
            <>
              <Field label="Dénomination" className="sm:col-span-4">
                {(id) => <Input id={id} value={d.denomination} onChange={(e) => set('denomination', e.target.value)} />}
              </Field>
              <Field label="N° SIRET" className="sm:col-span-2">
                {(id) => <Input id={id} inputMode="numeric" value={d.siret} onChange={(e) => set('siret', e.target.value)} />}
              </Field>
              <Field label="Représentant · nom" className="sm:col-span-3">
                {(id) => <Input id={id} value={d.nom} onChange={(e) => set('nom', e.target.value)} />}
              </Field>
              <Field label="Représentant · prénom" className="sm:col-span-3">
                {(id) => <Input id={id} value={d.prenom} onChange={(e) => set('prenom', e.target.value)} />}
              </Field>
            </>
          )}
        </Card>

        <Card className="grid gap-5 p-6 sm:grid-cols-6">
          <h3 className="font-display text-lg sm:col-span-6">Adresse du déclarant</h3>
          <Field label="N°" className="sm:col-span-1">
            {(id) => <Input id={id} value={d.adresse.numero} onChange={(e) => setAddress('numero', e.target.value)} />}
          </Field>
          <Field label="Voie" className="sm:col-span-5">
            {(id) => <Input id={id} autoComplete="address-line1" value={d.adresse.voie} onChange={(e) => setAddress('voie', e.target.value)} />}
          </Field>
          <Field label="Lieu-dit" className="sm:col-span-6">
            {(id) => <Input id={id} value={d.adresse.lieuDit} onChange={(e) => setAddress('lieuDit', e.target.value)} />}
          </Field>
          <Field label="Code postal" className="sm:col-span-2">
            {(id) => (
              <Input id={id} inputMode="numeric" autoComplete="postal-code" value={d.adresse.codePostal} onChange={(e) => setAddress('codePostal', e.target.value)} />
            )}
          </Field>
          <Field label="Localité" className="sm:col-span-4">
            {(id) => <Input id={id} autoComplete="address-level2" value={d.adresse.localite} onChange={(e) => setAddress('localite', e.target.value)} />}
          </Field>
          <Field label="Téléphone" className="sm:col-span-3">
            {(id) => <Input id={id} type="tel" autoComplete="tel" value={d.telephone} onChange={(e) => set('telephone', e.target.value)} />}
          </Field>
          <Field label="E-mail" className="sm:col-span-3">
            {(id) => <Input id={id} type="email" autoComplete="email" value={d.email} onChange={(e) => set('email', e.target.value)} />}
          </Field>
          <label className="flex items-start gap-2.5 text-sm sm:col-span-6">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-green"
              checked={d.accepteEmail}
              onChange={(e) => set('accepteEmail', e.target.checked)}
            />
            Le déclarant accepte de recevoir par courrier électronique les documents transmis par l&apos;administration.
          </label>
        </Card>
      </div>
    </>
  );
}
