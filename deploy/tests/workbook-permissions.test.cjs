'use strict';
// Run in a Linux Node container as UID 0 with /source and /operator mounted
// read-only, plus a small /tmp tmpfs. No database or Docker socket is used.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { loadBundle, apply } = require('/operator/rebuild-hsk1-workbook.cjs');

async function test() {
  assert.equal(process.platform, 'linux'); assert.equal(process.getuid(), 0);
  const directory = fs.mkdtempSync('/tmp/workbook-permissions-');
  const extracted = path.join(directory, 'book');
  fs.cpSync('/source', extracted, { recursive: true });
  fs.chmodSync(directory, 0o755);
  function makePrivate(p) {
    const stat = fs.statSync(p);
    fs.chownSync(p, 1001, 1001);
    fs.chmodSync(p, stat.isDirectory() ? 0o700 : 0o600);
    if (stat.isDirectory()) for (const name of fs.readdirSync(p)) makePrivate(path.join(p, name));
  }
  makePrivate(extracted);
  const options = { encoding: 'utf8', env: { ...process.env, WORKBOOK_DIRECTORY: extracted, WORKBOOK_APP_ROOT: '/missing-app' } };
  const denied = spawnSync(process.execPath, ['/operator/rebuild-hsk1-workbook.cjs', 'verify-files'], { ...options, uid: 1000, gid: 1000 });
  assert.equal(denied.status, 1); assert.match(denied.stderr, /EACCES/);
  const allowed = spawnSync(process.execPath, ['/operator/rebuild-hsk1-workbook.cjs', 'verify-files'], options);
  assert.equal(allowed.status, 0, allowed.stderr); assert.match(allowed.stdout, /WORKBOOK_ASSETS_VERIFIED/);
  const bundle = loadBundle(extracted, () => {});
  const backup = path.join(directory, 'backup'), uploads = path.join(directory, 'uploads');
  fs.mkdirSync(backup, { mode: 0o700 }); fs.chownSync(backup, 1001, 1001);
  fs.writeFileSync(path.join(backup, 'questions-before.json'), JSON.stringify({ datasetSha256: bundle.digest }), { mode: 0o600 });
  fs.mkdirSync(uploads, { mode: 0o755 }); fs.chownSync(uploads, 1000, 1000);
  // Stop before any DB operation: exercise the real public-asset copy and modes.
  await assert.rejects(apply({ transaction: async () => { throw new Error('TEST_STOP_BEFORE_DB'); } }, bundle, backup, uploads), /TEST_STOP_BEFORE_DB/);
  const avatar = path.join(uploads, 'private-avatar.jpg');
  fs.writeFileSync(avatar, 'private avatar', { mode: 0o600 }); fs.chownSync(avatar, 1000, 1000);
  const file = path.join(uploads, 'hsk1-workbook-63d36e483fa6-p023-l04-q01-optB.webp');
  const image = spawnSync(process.execPath, ['-e', 'require("node:fs").readFileSync(process.argv[1]);', file], { uid: 1000, gid: 1000, encoding: 'utf8' });
  assert.equal(image.status, 0, image.stderr);
  for (const asset of bundle.assets.values()) assert.equal(fs.statSync(path.join(uploads, asset.name)).mode & 0o777, 0o644);
  assert.equal(fs.statSync(avatar).mode & 0o777, 0o600);
  assert.equal(fs.statSync(path.join(backup, 'questions-before.json')).mode & 0o777, 0o600);
  console.log('WORKBOOK_LINUX_PERMISSIONS_OK: private extraction rejected by UID 1000, verified by maintenance UID; all 805 images readable by API, backup/other uploads remain private.');
}
test().catch(error => { console.error(error); process.exitCode = 1; });
