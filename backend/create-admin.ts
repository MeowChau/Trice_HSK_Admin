import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { AppDataSource } from './src/database/data-source';
import { UserEntity } from './src/users/infrastructure/persistence/relational/entities/user.entity';
import { SessionEntity } from './src/session/infrastructure/persistence/relational/entities/session.entity';
import { RoleEnum } from './src/roles/roles.enum';
import { StatusEnum } from './src/statuses/statuses.enum';

async function run(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const plainPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !plainPassword || plainPassword.length < 12) {
    throw new Error(
      'Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (at least 12 characters) before creating an admin',
    );
  }
  AppDataSource.setOptions({ synchronize: false });
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (manager) => {
      const repo = manager.getRepository(UserEntity);
      const existing = await repo.findOne({ where: { email } });
      const user = repo.create({
        ...existing,
        username: existing?.username || email,
        email,
        password: await bcrypt.hash(plainPassword, 12),
        role: { id: RoleEnum.admin },
        status: { id: StatusEnum.active },
      });
      await repo.save(user);
      if (existing)
        await manager
          .getRepository(SessionEntity)
          .softDelete({ user: { id: existing.id } });
    });
    console.log('Admin account saved successfully');
  } finally {
    await AppDataSource.destroy();
  }
}

void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Admin account creation failed',
  );
  process.exitCode = 1;
});
