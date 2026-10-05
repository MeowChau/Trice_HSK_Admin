import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { RoleEnum } from '../../../../roles/roles.enum';
import { StatusEnum } from '../../../../statuses/statuses.enum';
import { UserEntity } from '../../../../users/infrastructure/persistence/relational/entities/user.entity';
@Injectable()
export class UserSeedService {
    constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>) { }
    async run() {
        const countAdmin = await this.repository.count({
            where: {
                role: {
                    id: RoleEnum.admin,
                },
            },
        });
        if (!countAdmin) {
            const salt = await bcrypt.genSalt();
            const password = await bcrypt.hash(historyPrivateCredential("SEED_ADMIN_PASSWORD"), salt);
            await this.repository.save(this.repository.create({
                email: historyPrivateCredential("SEED_ADMIN_EMAIL"),
                password,
                role: {
                    id: RoleEnum.admin,
                    name: 'Admin',
                },
                status: {
                    id: StatusEnum.active,
                    name: 'Active',
                },
            }));
        }
        const countUser = await this.repository.count({
            where: {
                role: {
                    id: RoleEnum.user,
                },
            },
        });
        if (!countUser) {
            const salt = await bcrypt.genSalt();
            const password = await bcrypt.hash('secret', salt);
            await this.repository.save(this.repository.create({
                email: 'john.doe@example.com',
                password,
                role: {
                    id: RoleEnum.user,
                    name: 'Admin',
                },
                status: {
                    id: StatusEnum.active,
                    name: 'Active',
                },
            }));
        }
    }
}
function historyPrivateCredential(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error("Required private configuration: " + name);
    return value;
}
