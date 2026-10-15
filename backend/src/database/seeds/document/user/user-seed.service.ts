import { getSeedCredentials } from '../../seed-credentials';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { RoleEnum } from '../../../../roles/roles.enum';
import { StatusEnum } from '../../../../statuses/statuses.enum';
import { UserSchemaClass } from '../../../../users/infrastructure/persistence/document/entities/user.schema';

@Injectable()
export class UserSeedService {
  constructor(
    @InjectModel(UserSchemaClass.name)
    private readonly model: Model<UserSchemaClass>,
  ) {}

  async run() {
    const adminCredentials = getSeedCredentials('admin')!;
    const userCredentials = getSeedCredentials('user');
    const admin = await this.model.findOne({
      email: adminCredentials.email,
    });

    if (!admin) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(adminCredentials.password, salt);

      const data = new this.model({
        email: adminCredentials.email,
        username: adminCredentials.username,
        password: password,
        role: {
          _id: RoleEnum.admin.toString(),
        },
        status: {
          _id: StatusEnum.active.toString(),
        },
      });
      await data.save();
    }

    if (!userCredentials) return;

    const user = await this.model.findOne({
      email: userCredentials.email,
    });

    if (!user) {
      const salt = await bcrypt.genSalt();
      const password = await bcrypt.hash(userCredentials.password, salt);

      const data = new this.model({
        email: userCredentials.email,
        username: userCredentials.username,
        password: password,
        role: {
          _id: RoleEnum.user.toString(),
        },
        status: {
          _id: StatusEnum.active.toString(),
        },
      });

      await data.save();
    }
  }
}
