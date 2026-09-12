import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/chat/route';

test('console rejects absent configuration, wrong credentials and invalid payloads before model execution', async () => {
  const previous = process.env.CONSOLE_ACCESS_TOKEN;
  const request = (token: string, body = '{"text":"Hola","history":[]}') => new Request('https://example.test/api/chat', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body,
  });
  try {
    delete process.env.CONSOLE_ACCESS_TOKEN;
    assert.equal((await POST(request('test'))).status, 503);
    process.env.CONSOLE_ACCESS_TOKEN = 'local-test-only';
    assert.equal((await POST(request('incorrect'))).status, 401);
    assert.equal((await POST(request('local-test-only', 'not-json'))).status, 400);
    assert.equal((await POST(request('local-test-only', JSON.stringify({ text: '', history: [] })))).status, 400);
    assert.equal((await POST(request('local-test-only', 'a'.repeat(250001)))).status, 413);
  } finally {
    if (previous === undefined) delete process.env.CONSOLE_ACCESS_TOKEN;
    else process.env.CONSOLE_ACCESS_TOKEN = previous;
  }
});
