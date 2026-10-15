// Mount this file in /app of the existing API image. Credentials come from .env.
// Requires the exact existing admin ID and email; never creates/promotes a user.
const bcrypt = require('bcryptjs');
const { isEmail } = require('class-validator');

class RecoveryError extends Error {}

async function resetAdminLogin(db, { id, expectedEmail, email, password }) {
  if (!Number.isSafeInteger(id) || id < 1 || !isEmail(expectedEmail || '')) {
    throw new RecoveryError('Supply the existing admin ID and email.');
  }
  if (!isEmail(email || '') || email.length > 255) {
    throw new RecoveryError('Set a valid SEED_ADMIN_EMAIL in .env.');
  }
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new RecoveryError('SEED_ADMIN_PASSWORD must have at least 12 characters and at most 72 UTF-8 bytes.');
  }
  const hash = await bcrypt.hash(password, 12);
  await db.transaction(async (manager) => {
    const [admin] = await manager.query(
      'SELECT id, email, "roleId", "statusId", provider, "deletedAt" FROM "user" WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!admin || admin.email !== expectedEmail || admin.roleId !== 1 || admin.statusId !== 1 || admin.provider !== 'email' || admin.deletedAt !== null) {
      throw new RecoveryError('Existing account does not match an active email admin. No account changed.');
    }
    const conflicts = await manager.query(
      'SELECT id FROM "user" WHERE id <> $1 AND (LOWER(email) = $2 OR LOWER(username) = $2)',
      [id, email],
    );
    if (conflicts.length) {
      throw new RecoveryError('New email belongs to another account. Choose another SEED_ADMIN_EMAIL.');
    }
    await manager.query(
      'UPDATE "user" SET email = $2::varchar, password = $3, "emailVerifiedAt" = CASE WHEN email = $2::varchar THEN "emailVerifiedAt" ELSE NULL END, "updatedAt" = NOW() WHERE id = $1',
      [id, email, hash],
    );
    await manager.query(
      'UPDATE "session" SET "deletedAt" = NOW(), "updatedAt" = NOW() WHERE "userId" = $1 AND "deletedAt" IS NULL',
      [id],
    );
  });
}

async function run() {
  const { AppDataSource: db } = require('./dist/database/data-source.js');
  db.setOptions({ synchronize: false, dropSchema: false, migrationsRun: false, logging: false });
  await db.initialize();
  try {
    await resetAdminLogin(db, {
      id: Number(process.argv[2]),
      expectedEmail: process.argv[3],
      email: process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase(),
      password: process.env.SEED_ADMIN_PASSWORD,
    });
    console.log('ADMIN_LOGIN_UPDATED: Log in with the SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD from .env. Previous sessions revoked.');
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  run().catch((error) => {
    if (error instanceof RecoveryError) {
      console.error(error.message);
    } else {
      // Do not log the raw error: TypeORM errors include query parameters.
      const code = error?.driverError?.code || error?.code;
      const safeCode = typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'UNKNOWN';
      console.error(`ADMIN_LOGIN_UPDATE_FAILED code=${safeCode}. Check database availability, migrations and email conflicts.`);
    }
    process.exitCode = 1;
  });
}

module.exports = { resetAdminLogin };
