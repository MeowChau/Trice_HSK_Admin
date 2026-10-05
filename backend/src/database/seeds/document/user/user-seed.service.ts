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
    private readonly model: Model<UserSchemaClass>) { }
    async run() {
        const admin = await this.model.findOne({
            email: historyPrivateCredential("SEED_ADMIN_EMAIL"),
        });
        if (!admin) {
            const salt = await bcrypt.genSalt();
            const password = await bcrypt.hash(historyPrivateCredential("SEED_ADMIN_PASSWORD"), salt);
            const data = new this.model({
                email: historyPrivateCredential("SEED_ADMIN_EMAIL"),
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
        const user = await this.model.findOne({
            email: 'john.doe@example.com',
        });
        if (!user) {
            const salt = await bcrypt.genSalt();
            const password = await bcrypt.hash('secret', salt);
            const data = new this.model({
                email: 'john.doe@example.com',
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
function historyPrivateCredential(name: string): string {
    const value = process.env[name];
    if (!value)
        throw new Error("Required private configuration: " + name);
    return value;
}
