// Run read-only inside the existing API image with this file mounted in /app.
// Never prints passwords, password hashes or session tokens.
const bcrypt = require('bcryptjs');
const { AppDataSource } = require('./dist/database/data-source.js');
const { UserEntity } = require('./dist/users/infrastructure/persistence/relational/entities/user.entity.js');

async function run() {
  const configuredEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword = process.env.SEED_ADMIN_PASSWORD;
  const loginEmail = process.argv[2]?.trim().toLowerCase() || configuredEmail;
  AppDataSource.setOptions({
    synchronize: false,
    dropSchema: false,
    migrationsRun: false,
    logging: false,
  });
  await AppDataSource.initialize();
  try {
    const report = await AppDataSource.transaction(async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');
      const users = manager.getRepository(UserEntity);
      const configuredUser = configuredEmail
        ? await users.findOne({ where: { email: configuredEmail } }) : null;
      const loginUser = loginEmail === configuredEmail ? configuredUser
        : loginEmail ? await users.findOne({ where: { email: loginEmail } }) : null;
      const admins = await users.find({
        where: { role: { id: 1 } },
        select: { id: true, email: true },
        take: 10,
      });
      return {
        configuredAdminEmail: configuredEmail || null,
        configuredAdminExists: Boolean(configuredUser),
        configuredPasswordMatchesStoredPassword:
          configuredPassword && configuredUser?.password
            ? await bcrypt.compare(configuredPassword, configuredUser.password) : null,
        loginEmail: loginEmail || null,
        loginAccountExists: Boolean(loginUser),
        loginAccountRoleId: loginUser?.role?.id || null,
        loginAccountStatusId: loginUser?.status?.id || null,
        loginAccountProvider: loginUser?.provider || null,
        adminAccounts: admins.map((user) => ({ id: user.id, email: user.email })),
      };
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await AppDataSource.destroy();
  }
}

run().catch(() => {
  console.error('Cannot inspect admin account. Check database availability and deployed schema.');
  process.exitCode = 1;
});
