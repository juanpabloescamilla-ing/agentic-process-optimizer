import { timingSafeEqual } from 'node:crypto';
import { getToken } from '@vercel/connect';
import { missingChannelConfiguration } from '@/src/channels/bot';

export const runtime = 'nodejs';
export async function GET(request: Request) {
  const expected = process.env.CONSOLE_ACCESS_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  const a = Buffer.from(supplied), b = Buffer.from(expected ?? '');
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const missing = missingChannelConfiguration('slack');
  if (missing.length) return Response.json({ slack: 'missing_configuration', missing });
  try {
    const token = process.env.SLACK_CONNECTOR
      ? await getToken(process.env.SLACK_CONNECTOR, { subject: { type: 'app' } })
      : process.env.SLACK_BOT_TOKEN!;
    const response = await fetch('https://slack.com/api/auth.test', {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
    });
    const auth = await response.json();
    return Response.json({ slack: auth.ok ? 'authenticated' : 'rejected', teamId: auth.team_id, botId: auth.bot_id });
  } catch {
    return Response.json({ slack: 'token_exchange_failed' }, { status: 503 });
  }
}
