'use client';

import { LoaderCircle, MapPin, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { parcelLabel, type Dossier, type PostalAddress } from '@/lib/dossier';
import { findParcelAt, findParcelByReference, searchAddress, type AddressSuggestion } from '@/lib/geo/ign';
import { loadSurroundings, toParcelle } from '@/lib/geo/surroundings';
import { MapPreview } from '../map-preview';
import { Button, Card, Field, Input, Notice, SectionTitle } from '../ui/controls';
import type { StepProps } from './types';

export function TerrainStep({ dossier, update }: StepProps) {
  const t = dossier.terrain;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'warn' | 'ok'; text: string } | null>(null);
  const [ref, setRef] = useState({ section: '', numero: '' });

  const setAddress = (key: keyof PostalAddress, value: string) =>
    update((x) => ({ ...x, terrain: { ...x.terrain, adresse: { ...x.terrain.adresse, [key]: value } } }));

  async function refreshSurroundings(parcelles: Dossier['terrain']['parcelles']) {
    const s = await loadSurroundings(parcelles);
    update((x) => ({ ...x, terrain: { ...x.terrain, ...s } }));
  }

  async function chooseAddress(a: AddressSuggestion) {
    update((x) => ({
      ...x,
      terrain: {
        ...x.terrain,
        adresse: { numero: a.numero, voie: a.voie, lieuDit: '', codePostal: a.codePostal, localite: a.localite },
        codeInsee: a.codeInsee,
        commune: a.localite,
        location: { lat: a.lat, lon: a.lon },
      },
      engagement: { ...x.engagement, lieu: x.engagement.lieu || a.localite },
    }));
    setBusy(true);
    setMessage(null);
    try {
      const found = await findParcelAt(a.lon, a.lat);
      if (!found.length) {
        setMessage({ tone: 'warn', text: "Aucune parcelle trouvée sous l'adresse : saisissez la référence cadastrale ci-dessous." });
        return;
      }
      const parcelles = found.map(toParcelle);
      update((x) => ({
        ...x,
        terrain: { ...x.terrain, parcelles, commune: found[0].commune || x.terrain.commune, codeInsee: found[0].codeInsee },
        implantation: { ...x.implantation, placed: false },
      }));
      setMessage({ tone: 'ok', text: `Parcelle ${parcelLabel(found[0])} trouvée (${found[0].contenance} m²). Vérifiez qu'il s'agit bien du terrain.` });
      await refreshSurroundings(parcelles);
    } catch (e) {
      setMessage({ tone: 'warn', text: `Cadastre indisponible : ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  async function addByReference() {
    if (!t.codeInsee) return setMessage({ tone: 'warn', text: "Choisissez d'abord l'adresse du terrain (pour connaître la commune)." });
    setBusy(true);
    setMessage(null);
    try {
      const found = await findParcelByReference(t.codeInsee, ref.section.trim(), ref.numero.trim());
      if (!found.length) return setMessage({ tone: 'warn', text: 'Référence introuvable dans le cadastre de cette commune.' });
      const parcelles = [...t.parcelles.filter((p) => p.idu !== found[0].idu), ...found.map(toParcelle)];
      update((x) => ({
        ...x,
        terrain: {
          ...x.terrain,
          parcelles,
          location: x.terrain.location ?? centerOf(found[0].geometry.type === 'Polygon' ? found[0].geometry.coordinates[0] : found[0].geometry.coordinates[0][0]),
        },
        implantation: { ...x.implantation, placed: false },
      }));
      setRef({ section: '', numero: '' });
      await refreshSurroundings(parcelles);
    } catch (e) {
      setMessage({ tone: 'warn', text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  function removeParcel(idu: string) {
    const parcelles = t.parcelles.filter((p) => p.idu !== idu);
    update((x) => ({ ...x, terrain: { ...x.terrain, parcelles }, implantation: { ...x.implantation, placed: false } }));
    void refreshSurroundings(parcelles);
  }

  const total = t.parcelles.reduce((s, p) => s + p.contenance, 0);

  return (
    <>
      <SectionTitle eyebrow="Cerfa · rubrique 3" title="Le terrain" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-6">
          <Card className="p-6">
            <AddressSearch onSelect={chooseAddress} />
            <div className="mt-5 grid gap-4 sm:grid-cols-6">
              <Field label="N°" className="sm:col-span-1">
                {(id) => <Input id={id} value={t.adresse.numero} onChange={(e) => setAddress('numero', e.target.value)} />}
              </Field>
              <Field label="Voie" className="sm:col-span-5">
                {(id) => <Input id={id} value={t.adresse.voie} onChange={(e) => setAddress('voie', e.target.value)} />}
              </Field>
              <Field label="Lieu-dit" className="sm:col-span-6">
                {(id) => <Input id={id} value={t.adresse.lieuDit} onChange={(e) => setAddress('lieuDit', e.target.value)} />}
              </Field>
              <Field label="Code postal" className="sm:col-span-2">
                {(id) => <Input id={id} value={t.adresse.codePostal} onChange={(e) => setAddress('codePostal', e.target.value)} />}
              </Field>
              <Field label="Localité" className="sm:col-span-4">
                {(id) => <Input id={id} value={t.adresse.localite} onChange={(e) => setAddress('localite', e.target.value)} />}
              </Field>
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <h3 className="font-display text-lg">Références cadastrales</h3>
              {total > 0 && <span className="text-sm text-muted tabular">Superficie totale : {total.toLocaleString('fr-FR')} m²</span>}
            </div>
            {t.parcelles.length > 0 && (
              <ul className="mb-5 flex flex-wrap gap-2">
                {t.parcelles.map((p) => (
                  <li key={p.idu} className="inline-flex items-center gap-2 rounded-brand bg-ink py-1.5 pr-1.5 pl-3 text-sm text-cream">
                    <span className="font-medium">{parcelLabel(p)}</span>
                    <span className="text-cream/60 tabular">{p.contenance.toLocaleString('fr-FR')} m²</span>
                    <button type="button" onClick={() => removeParcel(p.idu)} className="rounded-[3px] p-0.5 hover:bg-cream/15" aria-label={`Retirer ${parcelLabel(p)}`}>
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Commune (INSEE)" className="w-32">
                {(id) => <Input id={id} value={t.codeInsee} readOnly className="bg-cream/60 text-muted" />}
              </Field>
              <Field label="Section" className="w-24">
                {(id) => <Input id={id} value={ref.section} placeholder="AB" maxLength={2} onChange={(e) => setRef({ ...ref, section: e.target.value.toUpperCase() })} />}
              </Field>
              <Field label="Numéro" className="w-28">
                {(id) => <Input id={id} value={ref.numero} placeholder="123" inputMode="numeric" onChange={(e) => setRef({ ...ref, numero: e.target.value })} />}
              </Field>
              <Button variant="outline" onClick={addByReference} disabled={busy || !ref.section || !ref.numero}>
                <Plus className="size-4" /> Ajouter
              </Button>
            </div>
            {busy && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <LoaderCircle className="size-4 animate-spin" /> Interrogation du cadastre…
              </p>
            )}
            {message && (
              <div className="mt-4">
                <Notice tone={message.tone}>{message.text}</Notice>
              </div>
            )}
          </Card>
        </div>

        <div className="grid content-start gap-4">
          {t.location ? (
            <>
              <MapPreview
                className="aspect-[4/3]"
                center={t.location}
                parcelles={t.parcelles}
                layers={['ortho', 'cadastre']}
                widthM={200}
                heightM={150}
                zoom={19}
              />
              <MapPreview
                className="aspect-[2/1]"
                center={t.location}
                parcelles={[]}
                layers={['plan']}
                widthM={3000}
                heightM={1500}
                zoom={15}
                marker
              />
            </>
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-[6px] border border-dashed border-line text-center text-sm text-muted">
              <div>
                <MapPin className="mx-auto mb-2 size-6" />
                Recherchez l&apos;adresse du terrain pour afficher la carte et le cadastre.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function centerOf(ring: [number, number][]) {
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  return { lat, lon };
}

function AddressSearch({ onSelect }: { onSelect: (a: AddressSuggestion) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const handle = setTimeout(() => {
      abort.current?.abort();
      abort.current = new AbortController();
      searchAddress(q, abort.current.signal)
        .then((r) => {
          setResults(r);
          setActive(0);
          setOpen(true);
          setError(null);
        })
        .catch((e: Error) => e.name !== 'AbortError' && setError(e.message));
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  const suggestions = q.trim().length < 3 ? [] : results;
  const pick = (a: AddressSuggestion) => {
    setQ(a.label);
    setOpen(false);
    onSelect(a);
  };

  return (
    <div className="relative">
      <Field label="Rechercher l'adresse du terrain" hint={error ?? 'Base Adresse Nationale — la parcelle est ensuite retrouvée automatiquement.'}>
        {(id) => (
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              id={id}
              role="combobox"
              aria-expanded={open}
              aria-autocomplete="list"
              className="h-12 pl-9 text-base"
              placeholder="12 chemin des Oliviers, Lourmarin"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => suggestions.length && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => {
                if (!open || !suggestions.length) return;
                if (e.key === 'ArrowDown') setActive((i) => Math.min(i + 1, suggestions.length - 1));
                else if (e.key === 'ArrowUp') setActive((i) => Math.max(i - 1, 0));
                else if (e.key === 'Enter') pick(suggestions[active]);
                else return;
                e.preventDefault();
              }}
            />
          </div>
        )}
      </Field>
      {open && suggestions.length > 0 && (
        <ul role="listbox" className="absolute inset-x-0 top-[4.6rem] z-20 overflow-hidden rounded-brand border border-line bg-paper shadow-lg">
          {suggestions.map((r, i) => (
            <li
              key={r.label + i}
              role="option"
              aria-selected={i === active}
              onMouseDown={() => pick(r)}
              className={`cursor-pointer px-3 py-2.5 text-sm ${i === active ? 'bg-ink text-cream' : 'hover:bg-cream'}`}
            >
              {r.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
