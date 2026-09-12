import { createHash } from "node:crypto";
import { Chat, type Adapter, type Message, type Thread } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createTeamsAdapter } from "@chat-adapter/teams";
import { createRedisState } from "@chat-adapter/state-redis";
import { respondToMessage } from "@/src/agent/respond";

export type Platform = "slack" | "teams";
type Turn = { role: "user" | "assistant"; content: string };
type ConversationState = { history: Turn[]; lastMessageId?: string };

const MAX_TURNS = 16;
const MAX_TEXT_LENGTH = 12_000;
const bots = new Map<Platform, Chat<Record<string, Adapter>, ConversationState>>();

export function isPlatform(value: string): value is Platform {
  return value === "slack" || value === "teams";
}

export function missingChannelConfiguration(platform: Platform): string[] {
  const required = platform === "slack"
    ? ["REDIS_URL", "SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"]
    : ["REDIS_URL", "TEAMS_APP_ID", "TEAMS_APP_PASSWORD", "TEAMS_APP_TENANT_ID"];
  return required.filter((name) => !process.env[name]?.trim());
}

async function answer(thread: Thread<ConversationState>, message: Message, skipped: Message[] = []) {
  if (message.author.isBot === true || message.author.isMe || !message.text.trim()) return;
  const current = await thread.state;
  if (current?.lastMessageId === message.id) return;
  // Queue mode collapses a burst to its latest event. Retain the earlier user
  // messages so answers supplied while the agent is busy are not lost.
  const text = [...skipped.filter((item) => item.author.isBot !== true && !item.author.isMe).map((item) => item.text), message.text].join("\n\n").trim();
  if (text.length > MAX_TEXT_LENGTH) {
    await thread.post("El mensaje supera 12.000 caracteres. Divide la evidencia en mensajes más pequeños dentro de este hilo.");
    return;
  }
  if (/^(reiniciar|borrar contexto)$/i.test(text)) {
    await thread.setState({ history: [], lastMessageId: message.id }, { replace: true });
    await thread.post("Contexto del agente borrado para este hilo. Describe el proceso que quieres mejorar.");
    return;
  }
  const history = (current?.history ?? []).slice(-MAX_TURNS);
  try {
    const reply = await respondToMessage({ text, history });
    await thread.post({ markdown: reply });
    const nextHistory: Turn[] = [...history, { role: "user", content: text }, { role: "assistant", content: reply.slice(0, MAX_TEXT_LENGTH) }];
    await thread.setState({ history: nextHistory.slice(-MAX_TURNS), lastMessageId: message.id }, { replace: true });
  } catch {
    // Never log credentials, raw platform payloads, or company evidence.
    console.error("channel_agent_response_failed", { platform: thread.adapter.name });
    await thread.post("No pude completar este paso. El diagnóstico no se marcó como terminado. Intenta nuevamente en este hilo.");
  }
}

/** One configured installation per platform; history never joins Slack and Teams. */
export function getChannelBot(platform: Platform) {
  const missing = missingChannelConfiguration(platform);
  if (missing.length) throw new Error(`Channel configuration missing: ${missing.join(", ")}`);
  const existing = bots.get(platform);
  if (existing) return existing;

  const adapter: Adapter = platform === "slack"
    ? createSlackAdapter({
        botToken: process.env.SLACK_BOT_TOKEN!,
        signingSecret: process.env.SLACK_SIGNING_SECRET!,
      })
    : createTeamsAdapter({
        appId: process.env.TEAMS_APP_ID!,
        appPassword: process.env.TEAMS_APP_PASSWORD!,
        appTenantId: process.env.TEAMS_APP_TENANT_ID!,
        appType: "SingleTenant",
      });
  // Installation-specific Redis namespace prevents reuse after a tenant switch.
  // Only the digest is used in keys; the Slack token itself is never persisted.
  const installation = platform === "slack" ? process.env.SLACK_BOT_TOKEN! : `${process.env.TEAMS_APP_TENANT_ID}:${process.env.TEAMS_APP_ID}`;
  const installationId = createHash("sha256").update(installation).digest("hex").slice(0, 24);
  const bot = new Chat<Record<string, Adapter>, ConversationState>({
    userName: "process-optimizer",
    adapters: { [platform]: adapter },
    state: createRedisState({ url: process.env.REDIS_URL!, keyPrefix: `process-optimizer:${platform}:${installationId}` }),
    logger: "error",
    concurrency: "queue",
  });
  bot.onNewMention(async (thread, message, context) => {
    await thread.subscribe();
    await answer(thread, message, context?.skipped);
  });
  bot.onSubscribedMessage((thread, message, context) => answer(thread, message, context?.skipped));
  bot.onDirectMessage((thread, message, _channel, context) => answer(thread, message, context?.skipped));
  bots.set(platform, bot);
  return bot;
}
