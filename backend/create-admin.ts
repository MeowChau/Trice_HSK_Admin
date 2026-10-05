import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserEntity } from './src/users/infrastructure/persistence/relational/entities/user.entity';
const AppDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432', 10),
    username: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'secret',
    database: process.env.DATABASE_NAME || 'api',
    entities: [UserEntity],
    synchronize: false,
});
async function run() {
    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository(UserEntity);
    const email = historyPrivateCredential("SEED_ADMIN_EMAIL");
    const plainPassword = historyPrivateCredential("SEED_ADMIN_PASSWORD");
    let user = await repo.findOne({ where: { email } });
    const salt = await bcrypt.genSalt();
    const password = await bcrypt.hash(plainPassword, salt);
    if (!user) {
        user = repo.create({
            firstName: 'Admin',
            lastName: 'Deptrai',
            email,
            password,
            role: {
                id: 1, // RoleEnum.admin
                name: 'Admin',
            },
            status: {
                id: 1, // StatusEnum.active
                name: 'Active',
            },
        });
    }
    else {
        user.password = password;
        user.role = { id: 1, name: 'Admin' } as any;
        user.status = { id: 1, name: 'Active' } as any;
    }
    await repo.save(user);
    console.log(`Admin user created/updated successfully: ${email}`);
    process.exit(0);
}
run().catch(err => {
    console.error(err);
    process.exit(1);
});
function historyPrivateCredential(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error("Required private configuration: " + name);
    return value;
}
