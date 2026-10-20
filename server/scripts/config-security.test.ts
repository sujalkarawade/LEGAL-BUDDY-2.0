import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

it('production rejects missing, short and known placeholder JWT secrets', () => {
  const run = (value: string) => spawnSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', "await import('./src/config/index.ts')"],
    { cwd: process.cwd(), env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: value }, encoding: 'utf8', windowsHide: true });
  for (const value of ['', 'short', 'legalbuddy-known-placeholder-secret-for-test', 'replace-with-a-long-random-secret']) {
    const result = run(value);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Production requires/);
  }
  assert.equal(run(randomBytes(32).toString('hex')).status, 0);
});
