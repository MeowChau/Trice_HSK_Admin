const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { createRequire } = require('node:module');
const directory = process.env.IMPORT_DIRECTORY || '/transfer';

async function run() {
  const manifest = JSON.parse(fs.readFileSync(`${directory}/manifest.json`, 'utf8'));
  if (manifest.formatVersion !== 1 || !manifest.normalized) throw new Error('Expected a tested, normalized data archive.');
  for (const [file, expected] of [['database.dump', manifest.databaseSha256], ['uploads.tar.gz', manifest.uploadsSha256]]) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(`${directory}/${file}`)).digest('hex');
    if (!/^[a-f0-9]{64}$/.test(expected || '') || actual !== expected) throw new Error(`Checksum mismatch: ${file}`);
  }
  if (process.argv[2] === 'files') {
    console.log('IMPORT_FILES_OK');
    return;
  }
  if (process.argv[2] !== 'database' || !/^tricehsk_import_[a-z0-9_]+$/.test(process.env.DATABASE_NAME || '') || process.env.DATABASE_URL) {
    throw new Error('Use the isolated import database.');
  }
  const appRequire = createRequire(path.join(process.env.IMPORT_APP_ROOT || '/app', 'package.json'));
  const { AppDataSource: db } = appRequire('./dist/database/data-source.js');
  const { resetAdminLogin } = require('./reset-admin-login.cjs');
  db.setOptions({ synchronize: false, dropSchema: false, migrationsRun: false, logging: false });
  await db.initialize();
  try {
    const counts = await db.transaction(async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      const counts = {};
      for (const [key, table] of Object.entries({ users: 'user', vocabulary: 'vocabulary', practiceSets: 'practice_set', exams: 'exam', files: 'file', auditLogs: 'audit_log' })) {
        const [{ count }] = await manager.query(`SELECT count(*) FROM "${table}"`);
        counts[key] = Number(count);
        if (!Number.isSafeInteger(manifest.counts?.[key]) || counts[key] !== manifest.counts[key]) throw new Error(`Row count mismatch: ${key}`);
      }
      return counts;
    });
    // Windows uploads stored backslashes; public URLs on Linux use forward slashes.
    await db.query('UPDATE "file" SET path = REPLACE(path, CHR(92), $1) WHERE path LIKE $2', ['/', '/api/v1/files%']);
    const files = await db.query('SELECT path FROM "file"');
    for (const file of files) {
      if (file.path.startsWith('/api/v1/files/')) {
        const relative = file.path.slice('/api/v1/files/'.length);
        if (!manifest.uploadPaths?.includes(relative)) throw new Error('A database file reference is missing from the upload archive.');
      }
    }
    const admins = await db.query('SELECT id, email FROM "user" WHERE "roleId" = 1 AND "statusId" = 1 AND provider = $1 AND "deletedAt" IS NULL', ['email']);
    if (admins.length !== 1) throw new Error('Expected exactly one active email admin; select an admin manually before switching.');
    await resetAdminLogin(db, {
      id: admins[0].id,
      expectedEmail: admins[0].email,
      email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD,
    });
    await db.query('UPDATE "session" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "deletedAt" IS NULL');
    console.log(`IMPORT_DATABASE_OK: ${JSON.stringify(counts)}. Current VPS admin credentials preserved; previous sessions revoked.`);
  } finally { await db.destroy(); }
}

run().catch((error) => {
  console.error(error?.driverError ? `IMPORT_VERIFY_FAILED database code=${error.driverError.code || 'UNKNOWN'}` : `IMPORT_VERIFY_FAILED: ${error?.message || 'Unknown error'}`);
  process.exitCode = 1;
});
