import { getSeedCredentials } from '../../seed-credentials';
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
    private readonly repository: Repository<UserEntity>,
  ) {}

  async run() {
    const adminCredentials = getSeedCredentials('admin')!;
    const userCredentials = getSeedCredentials('user');
    const countAdmin = await this.repository.count({
      where: {
        role: {
          id: RoleEnum.admin,
        },
      },
    });

    if (!countAdmin) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(adminCredentials.password, salt);

      await this.repository.save(
        this.repository.create({
          email: adminCredentials.email,
          username: adminCredentials.username,
          password,
          role: {
            id: RoleEnum.admin,
            name: 'Admin',
          },
          status: {
            id: StatusEnum.active,
            name: 'Active',
          },
        }),
      );
    }

    if (!userCredentials) return;

    const countUser = await this.repository.count({
      where: {
        role: {
          id: RoleEnum.user,
        },
      },
    });

    if (!countUser) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(userCredentials.password, salt);

      await this.repository.save(
        this.repository.create({
          email: userCredentials.email,
          username: userCredentials.username,
          password,
          role: {
            id: RoleEnum.user,
            name: 'User',
          },
          status: {
            id: StatusEnum.active,
            name: 'Active',
          },
        }),
      );
    }
  }
}
