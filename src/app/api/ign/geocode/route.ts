import { geocode } from '@/lib/geo/ign-server';
import { badRequest, respond } from '../_respond';

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 3) return badRequest('Saisir au moins 3 caractères.');
  return respond(() => geocode(q));
}
