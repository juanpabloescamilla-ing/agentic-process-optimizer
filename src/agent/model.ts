import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export function configuredModel() {
  const modelId = process.env.MODEL_ID?.trim();
  if (!modelId) throw new Error('MODEL_NOT_CONFIGURED');
  const key = process.env.OPENROUTER_API_KEY?.trim();
  // Passing a provider instance calls OpenRouter directly, bypassing AI Gateway.
  if (key) return createOpenRouter({ apiKey: key })(modelId);
  return modelId;
}
