import test from 'node:test';
import assert from 'node:assert/strict';
import { channelStatePrefix, missingChannelConfiguration, slackAdapterConfiguration } from '../src/channels/bot';

const envNames = ['SLACK_CONNECTOR', 'SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET', 'REDIS_URL', 'SLACK_WORKSPACE_ID', 'VERCEL_PROJECT_ID'] as const;

test('Slack Connect requires Redis and retains OIDC authentication without manual Slack secrets', async () => {
  const original = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
  try {
    for (const name of envNames) delete process.env[name];
    process.env.SLACK_CONNECTOR = 'slack/okflow';
    assert.deepEqual(missingChannelConfiguration('slack'), ['REDIS_URL']);
    process.env.REDIS_URL = 'redis://localhost:6379';
    assert.deepEqual(missingChannelConfiguration('slack'), []);
    const config = slackAdapterConfiguration();
    assert.equal(typeof config.botToken, 'function');
    assert.ok('webhookVerifier' in config && typeof config.webhookVerifier === 'function');
    assert.ok(!('signingSecret' in config));
    const unsigned = new Request('https://example.test/api/webhooks/slack', { method: 'POST', body: '{}' });
    await assert.rejects(async () => { await config.webhookVerifier(unsigned, '{}'); }, /Missing Authorization bearer token/);

    const prefix = channelStatePrefix('slack');
    process.env.SLACK_BOT_TOKEN = 'new-ignored-token';
    assert.equal(channelStatePrefix('slack'), prefix, 'Connect state must survive token rotation');
    process.env.SLACK_CONNECTOR = 'slack/other-workspace';
    assert.notEqual(channelStatePrefix('slack'), prefix, 'Different connector must not reuse history');
    process.env.SLACK_CONNECTOR = 'slack/okflow';
    process.env.SLACK_WORKSPACE_ID = 'T_OTHER';
    assert.notEqual(channelStatePrefix('slack'), prefix, 'Explicit workspace change must isolate history');

    delete process.env.SLACK_CONNECTOR;
    delete process.env.SLACK_BOT_TOKEN;
    assert.deepEqual(missingChannelConfiguration('slack'), ['SLACK_BOT_TOKEN', 'SLACK_SIGNING_SECRET']);
    process.env.SLACK_BOT_TOKEN = 'test-only-bot-token';
    process.env.SLACK_SIGNING_SECRET = 'test-only-signing-secret';
    assert.deepEqual(missingChannelConfiguration('slack'), []);
    assert.deepEqual(slackAdapterConfiguration(), { botToken: 'test-only-bot-token', signingSecret: 'test-only-signing-secret' });
  } finally {
    for (const name of envNames) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});
