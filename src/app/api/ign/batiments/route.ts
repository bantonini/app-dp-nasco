import { batimentsInBox } from '@/lib/geo/ign-server';
import { badRequest, parseBox, respond } from '../_respond';

export async function GET(req: Request) {
  const box = parseBox(new URL(req.url).searchParams.get('bbox'));
  if (!box) return badRequest('Paramètre bbox attendu.');
  if (box[2] - box[0] > 0.02 || box[3] - box[1] > 0.02) return badRequest('Emprise trop grande.');
  return respond(() => batimentsInBox(box));
}
