// Run with NODE_PATH=backend/node_modules and a disposable TEST_DATABASE_URL.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const { DataSource } = require('typeorm');
const bcrypt = require('bcryptjs');
const { resetAdminLogin } = require('./reset-admin-login.cjs');

const schema = `recovery_${randomUUID().replaceAll('-', '')}`;
let db;
const input = { id: 1, expectedEmail: `${randomUUID()}@test.invalid`, email: `${randomUUID()}@test.invalid`, password: randomBytes(24).toString('base64url') };
const otherEmail = `${randomUUID()}@test.invalid`;

before(async () => {
  assert.ok(process.env.TEST_DATABASE_URL, 'Use an isolated test PostgreSQL instance.');
  db = new DataSource({ type: 'postgres', url: process.env.TEST_DATABASE_URL, logging: false, extra: { options: `-c search_path=${schema}` } });
  await db.initialize();
  await db.query(`CREATE SCHEMA "${schema}"`);
  await db.query('CREATE TABLE "user" (id integer PRIMARY KEY, email character varying UNIQUE, username character varying UNIQUE, password character varying, "roleId" integer, "statusId" integer, provider character varying, "deletedAt" timestamp, "updatedAt" timestamp, "emailVerifiedAt" timestamp)');
  await db.query('CREATE TABLE "session" (id integer PRIMARY KEY, "userId" integer, "deletedAt" timestamp, "updatedAt" timestamp)');
});

after(async () => {
  if (db?.isInitialized) {
    try {
      await db.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally { await db.destroy(); }
  }
});

beforeEach(async () => {
  await db.query('TRUNCATE "session", "user"');
  await db.query('INSERT INTO "user" (id, email, username, password, "roleId", "statusId", provider, "emailVerifiedAt") VALUES (1, $1, $1, $2, 1, 1, $3, NOW())', [input.expectedEmail, 'old-hash', 'email']);
  await db.query('INSERT INTO "session" (id, "userId") VALUES (1, 1), (2, 2)');
});

test('updates credentials, preserves identity and revokes only admin sessions', async () => {
  await resetAdminLogin(db, input);
  const [user] = await db.query('SELECT * FROM "user" WHERE id = 1');
  assert.equal(user.email, input.email);
  assert.equal(user.username, input.expectedEmail);
  assert.equal(user.roleId, 1);
  assert.equal(user.statusId, 1);
  assert.equal(user.emailVerifiedAt, null);
  assert.equal(await bcrypt.compare(input.password, user.password), true);
  const sessions = await db.query('SELECT * FROM "session" ORDER BY id');
  assert.ok(sessions[0].deletedAt);
  assert.equal(sessions[1].deletedAt, null);
});

test('refuses stale expected email without changing credentials', async () => {
  await assert.rejects(resetAdminLogin(db, { ...input, expectedEmail: `${randomUUID()}@test.invalid` }), /does not match/);
  assert.equal((await db.query('SELECT password FROM "user" WHERE id = 1'))[0].password, 'old-hash');
});

test('keeps email verification when only the password changes', async () => {
  await resetAdminLogin(db, { ...input, email: input.expectedEmail });
  const [user] = await db.query('SELECT * FROM "user" WHERE id = 1');
  assert.ok(user.emailVerifiedAt);
  assert.equal(await bcrypt.compare(input.password, user.password), true);
});

test('refuses inactive, non-admin, deleted and external provider accounts', async () => {
  for (const change of ['"roleId" = 2', '"statusId" = 2', '"deletedAt" = NOW()', "provider = 'google'"]) {
    await db.query('UPDATE "user" SET "roleId" = 1, "statusId" = 1, "deletedAt" = NULL, provider = $1', ['email']);
    await db.query(`UPDATE "user" SET ${change} WHERE id = 1`);
    await assert.rejects(resetAdminLogin(db, input), /does not match/);
    assert.equal((await db.query('SELECT password FROM "user" WHERE id = 1'))[0].password, 'old-hash');
  }
});

test('rejects another account email or username including case differences', async () => {
  await db.query('INSERT INTO "user" (id, email, username) VALUES (2, $1, $2)', [input.email.toUpperCase(), otherEmail]);
  await assert.rejects(resetAdminLogin(db, input), /another account/);
  await assert.rejects(resetAdminLogin(db, { ...input, email: otherEmail }), /another account/);
});

test('rolls credential update back when session revocation fails', async () => {
  await db.query('ALTER TABLE "session" ADD CONSTRAINT test_revoke_failure CHECK ("deletedAt" IS NULL)');
  try {
    await assert.rejects(resetAdminLogin(db, input), { code: '23514' });
    const [user] = await db.query('SELECT email, password FROM "user" WHERE id = 1');
    assert.equal(user.email, input.expectedEmail);
    assert.equal(user.password, 'old-hash');
  } finally { await db.query('ALTER TABLE "session" DROP CONSTRAINT test_revoke_failure'); }
});

test('rejects invalid email and passwords beyond bcrypt UTF-8 limit', async () => {
  await assert.rejects(resetAdminLogin(db, { ...input, email: 'bad' }), /valid SEED_ADMIN_EMAIL/);
  await assert.rejects(resetAdminLogin(db, { ...input, password: 'short' }), /at least 12/);
  await assert.rejects(resetAdminLogin(db, { ...input, password: '你'.repeat(25) }), /72 UTF-8/);
});
