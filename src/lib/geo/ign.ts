/** Appels client vers les routes /api/ign/* (voir ign-server.ts). */
import type { Polygon } from './geometry';
import type { AddressSuggestion, ParcelleFeature } from './ign-server';

export type { AddressSuggestion, ParcelleFeature };

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Erreur ${res.status}`);
  return body as T;
}

export const searchAddress = (q: string, signal?: AbortSignal) =>
  get<AddressSuggestion[]>(`/api/ign/geocode?q=${encodeURIComponent(q)}`, signal);

export const findParcelAt = (lon: number, lat: number) =>
  get<ParcelleFeature[]>(`/api/ign/parcelles?lon=${lon}&lat=${lat}`);

export const findParcelByReference = (insee: string, section: string, numero: string) =>
  get<ParcelleFeature[]>(
    `/api/ign/parcelles?insee=${encodeURIComponent(insee)}&section=${encodeURIComponent(section)}&numero=${encodeURIComponent(numero)}`,
  );

export const findParcelsInBox = (box: number[]) => get<ParcelleFeature[]>(`/api/ign/parcelles?bbox=${box.join(',')}`);

export const findBuildingsInBox = (box: number[]) => get<Polygon[]>(`/api/ign/batiments?bbox=${box.join(',')}`);
