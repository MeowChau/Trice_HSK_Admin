const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID, randomBytes } = require('node:crypto');

const root = path.resolve(__dirname, '../../../deploy/transfers');
fs.mkdirSync(root, { recursive: true });
const helper = path.join(__dirname, 'prepare-test-credentials.cjs');
const names = ['SEED_ADMIN_EMAIL', 'SEED_ADMIN_PASSWORD', 'SEED_USER_EMAIL', 'SEED_USER_PASSWORD'];
function run(directory, settings = {}) {
  const env = { ...process.env, NODE_ENV: 'test' };
  for (const name of names) delete env[name];
  return spawnSync(process.execPath, [helper], { cwd: directory, env: { ...env, ...settings }, encoding: 'utf8' });
}
function values(directory) {
  return Object.fromEntries(fs.readFileSync(path.join(directory, '.env'), 'utf8').trim().split('\n')
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
}
function temporary(t) {
  const directory = fs.mkdtempSync(path.join(root, 'test-seed-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('generates unique credentials per disposable environment without printing them', t => {
  const first = temporary(t), second = temporary(t);
  const result = run(first);
  assert.equal(result.status, 0);
  assert.equal(run(second).status, 0);
  const a = values(first), b = values(second);
  for (const name of names) {
    assert.ok(a[name]);
    assert.notEqual(a[name], b[name]);
    assert.ok(!result.stdout.includes(a[name]));
    assert.ok(!result.stderr.includes(a[name]));
  }
  assert.match(a.SEED_ADMIN_EMAIL, /^[a-f0-9-]+@test\.invalid$/);
  assert.ok(a.SEED_ADMIN_PASSWORD.length >= 12);
});

test('repeated startup retains the private credentials for the existing test database', t => {
  const directory = temporary(t);
  assert.equal(run(directory).status, 0);
  const previous = values(directory);
  assert.equal(run(directory).status, 0);
  assert.deepEqual(values(directory), previous);
});

test('honors explicit environment configuration instead of creating a sample account', t => {
  const directory = temporary(t);
  const configured = { SEED_ADMIN_EMAIL: `${randomUUID()}@test.invalid`, SEED_ADMIN_PASSWORD: randomBytes(24).toString('base64url') };
  assert.equal(run(directory, configured).status, 0);
  const current = values(directory);
  assert.equal(current.SEED_ADMIN_EMAIL, configured.SEED_ADMIN_EMAIL);
  assert.equal(current.SEED_ADMIN_PASSWORD, configured.SEED_ADMIN_PASSWORD);
});

test('refuses production and leaves configuration untouched', t => {
  const directory = temporary(t);
  const result = run(directory, { NODE_ENV: 'production' });
  assert.notEqual(result.status, 0);
  assert.ok(!fs.existsSync(path.join(directory, '.env')));
});
