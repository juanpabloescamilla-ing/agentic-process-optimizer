import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { respondToMessage } from '@/src/agent/respond';

export const runtime = 'nodejs';
export const maxDuration = 60;
const schema = z.object({ text: z.string().min(1).max(12000),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(12000) })).max(20).default([]) });
export async function POST(request: Request) {
  const expected = process.env.CONSOLE_ACCESS_TOKEN;
  if (!expected) return Response.json({ error: 'Configura CONSOLE_ACCESS_TOKEN para habilitar la consola.' }, { status: 503 });
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const a = Buffer.from(token), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return Response.json({ error: 'Acceso no autorizado.' }, { status: 401 });
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 250000) return Response.json({ error: 'Solicitud demasiado grande.' }, { status: 413 });
  let input: z.infer<typeof schema>;
  try { input = schema.parse(JSON.parse(raw)); }
  catch { return Response.json({ error: 'Mensaje o historial inválido.' }, { status: 400 }); }
  try { return Response.json({ text: await respondToMessage(input) }); }
  catch (error) {
    const missing = error instanceof Error && error.message === 'MODEL_NOT_CONFIGURED';
    return Response.json({ error: missing ? 'Configura MODEL_ID y AI_GATEWAY_API_KEY en Vercel.' : 'No se pudo completar la ejecución. Intenta nuevamente; no se modificaron sistemas externos.' }, { status: missing ? 503 : 502 });
  }
}
