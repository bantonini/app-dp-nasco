import { NextResponse } from 'next/server';
import { UpstreamError } from '@/lib/geo/ign-server';

export async function respond<T>(work: () => Promise<T>, maxAge = 3600) {
  try {
    return NextResponse.json(await work(), {
      headers: { 'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge * 24}` },
    });
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function parseBox(value: string | null): number[] | null {
  const box = value?.split(',').map(Number);
  return box && box.length === 4 && box.every(Number.isFinite) ? box : null;
}
