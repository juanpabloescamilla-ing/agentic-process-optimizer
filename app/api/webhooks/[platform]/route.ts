import { after } from "next/server";
import { getChannelBot, isPlatform, missingChannelConfiguration } from "@/src/channels/bot";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ platform: string }> }) {
  const { platform } = await context.params;
  if (!isPlatform(platform)) return Response.json({ error: "Unknown platform" }, { status: 404 });
  if (missingChannelConfiguration(platform).length) {
    return Response.json({ error: "Channel not configured" }, { status: 503 });
  }
  // Pass the untouched request to the official adapter: Slack HMAC / Teams JWT
  // verification must happen before any event reaches our agent handlers.
  const bot = getChannelBot(platform);
  return bot.webhooks[platform](request, {
    waitUntil: (task) => after(async () => { await task; }),
  });
}
