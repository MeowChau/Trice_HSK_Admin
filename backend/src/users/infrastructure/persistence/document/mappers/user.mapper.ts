import { User } from '../../../../domain/user';

import { UserSchemaClass } from '../entities/user.schema';
import { FileSchemaClass } from '../../../../../files/infrastructure/persistence/document/entities/file.schema';
import { FileMapper } from '../../../../../files/infrastructure/persistence/document/mappers/file.mapper';
import { Role } from '../../../../../roles/domain/role';
import { Status } from '../../../../../statuses/domain/status';
import { RoleSchema } from '../../../../../roles/infrastructure/persistence/document/entities/role.schema';
import { StatusSchema } from '../../../../../statuses/infrastructure/persistence/document/entities/status.schema';

export class UserMapper {
  static toDomain(raw: UserSchemaClass): User {
    const domainEntity = new User();
    domainEntity.emailVerifiedAt = raw.emailVerifiedAt;

    domainEntity.id = raw._id.toString();
    domainEntity.email = raw.email;
    domainEntity.password = raw.password;
    domainEntity.provider = raw.provider;
    domainEntity.socialId = raw.socialId;
    domainEntity.username = raw.username;
    domainEntity.level = raw.level;
    domainEntity.currentExp = raw.currentExp;
    domainEntity.avatarFrame = raw.avatarFrame;
    domainEntity.currentHskLevel = raw.currentHskLevel;
    domainEntity.targetHskLevel = raw.targetHskLevel;
    domainEntity.dailyStudyTime = raw.dailyStudyTime;
    if (raw.photo) {
      domainEntity.photo = FileMapper.toDomain(raw.photo);
    } else if (raw.photo === null) {
      domainEntity.photo = null;
    }

    if (raw.role) {
      domainEntity.role = new Role();
      domainEntity.role.id = raw.role._id;
    }

    if (raw.status) {
      domainEntity.status = new Status();
      domainEntity.status.id = raw.status._id;
    }

    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;

    return domainEntity;
  }

  static toPersistence(domainEntity: User): UserSchemaClass {
    let role: RoleSchema | undefined = undefined;

    if (domainEntity.role) {
      role = new RoleSchema();
      role._id = domainEntity.role.id.toString();
    }

    let photo: FileSchemaClass | null | undefined = undefined;

    if (domainEntity.photo) {
      photo = new FileSchemaClass();
      photo._id = domainEntity.photo.id;
      photo.path = domainEntity.photo.path;
    } else if (domainEntity.photo === null) {
      photo = null;
    }

    let status: StatusSchema | undefined = undefined;

    if (domainEntity.status) {
      status = new StatusSchema();
      status._id = domainEntity.status.id.toString();
    }

    const persistenceSchema = new UserSchemaClass();
    persistenceSchema.emailVerifiedAt = domainEntity.emailVerifiedAt;

    if (domainEntity.id && typeof domainEntity.id === 'string') {
      persistenceSchema._id = domainEntity.id;
    }
    persistenceSchema.email = domainEntity.email;
    persistenceSchema.password = domainEntity.password;
    persistenceSchema.provider = domainEntity.provider;
    persistenceSchema.socialId = domainEntity.socialId;
    persistenceSchema.username = domainEntity.username;
    persistenceSchema.level = domainEntity.level;
    persistenceSchema.currentExp = domainEntity.currentExp;
    persistenceSchema.avatarFrame = domainEntity.avatarFrame;
    persistenceSchema.currentHskLevel = domainEntity.currentHskLevel;
    persistenceSchema.targetHskLevel = domainEntity.targetHskLevel;
    persistenceSchema.dailyStudyTime = domainEntity.dailyStudyTime;
    persistenceSchema.photo = photo;
    persistenceSchema.role = role;
    persistenceSchema.status = status;
    persistenceSchema.createdAt = domainEntity.createdAt;
    persistenceSchema.updatedAt = domainEntity.updatedAt;
    persistenceSchema.deletedAt = domainEntity.deletedAt;
    return persistenceSchema;
  }
}
