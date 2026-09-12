import test from 'node:test';
import assert from 'node:assert/strict';
import { agentFailure } from '../src/agent/errors';

test('retry wrapper preserves provider rate limit rather than reporting invalid console access', () => {
  const result = agentFailure({ name: 'AI_RetryError', errors: [{ name: 'GatewayRateLimitError', statusCode: 429, responseBody: 'private' }] });
  assert.equal(result.status, 429);
  assert.ok(!JSON.stringify(result).includes('private'));
});
test('upstream credentials do not become console authentication errors', () => {
  assert.equal(agentFailure({ cause: { statusCode: 403 } }).status, 503);
});
