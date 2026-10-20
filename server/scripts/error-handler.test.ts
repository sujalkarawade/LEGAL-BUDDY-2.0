import { it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { errorHandler } from '../src/middleware/error-handler.js';

it('does not expose raw errors or request bodies through the global handler', () => {
  const log = mock.method(console, 'error', () => {});
  const respond = (error: unknown) => {
    let status = 0, body: any;
    const response = { status: (value: number) => { status = value; return response; }, json: (value: any) => { body = value; } };
    errorHandler(error, {} as any, response as any, () => {});
    return { status, body };
  };
  try {
    const secret = 'SYNTHETIC-CONFIDENTIAL-SENTINEL';
    assert.equal(respond(new Error(secret)).status, 500);
    assert.ok(!JSON.stringify(log.mock.calls).includes(secret));
    const syntax = Object.assign(new SyntaxError(secret), { body: secret });
    const bad = respond(syntax);
    assert.equal(bad.status, 400); assert.ok(!JSON.stringify(bad.body).includes(secret));
    assert.equal(respond({ code: 'LIMIT_FILE_SIZE' }).status, 413);
    assert.equal(respond({ name: 'MulterError' }).status, 400);
  } finally { log.mock.restore(); }
});
