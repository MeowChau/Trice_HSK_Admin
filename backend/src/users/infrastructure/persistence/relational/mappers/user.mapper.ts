import { FileEntity } from '../../../../../files/infrastructure/persistence/relational/entities/file.entity';

import { FileMapper } from '../../../../../files/infrastructure/persistence/relational/mappers/file.mapper';
import { RoleEntity } from '../../../../../roles/infrastructure/persistence/relational/entities/role.entity';
import { StatusEntity } from '../../../../../statuses/infrastructure/persistence/relational/entities/status.entity';
import { User } from '../../../../domain/user';
import { UserEntity } from '../entities/user.entity';

export class UserMapper {
  static toDomain(raw: UserEntity): User {
    const domainEntity = new User();
    domainEntity.emailVerifiedAt = raw.emailVerifiedAt;

    domainEntity.id = raw.id;
    domainEntity.email = raw.email;
    domainEntity.password = raw.password;
    domainEntity.provider = raw.provider;
    domainEntity.socialId = raw.socialId;
    domainEntity.username = raw.username;
    domainEntity.fullName = raw.fullName;
    domainEntity.position = raw.position;
    domainEntity.firstName = raw.firstName;
    domainEntity.lastName = raw.lastName;
    domainEntity.level = raw.level;
    domainEntity.currentExp = raw.currentExp;
    domainEntity.avatarFrame = raw.avatarFrame;
    domainEntity.currentHskLevel = raw.currentHskLevel;
    domainEntity.targetHskLevel = raw.targetHskLevel;
    domainEntity.dailyStudyTime = raw.dailyStudyTime;
    domainEntity.studentCode = raw.studentCode;
    if (raw.photo) {
      domainEntity.photo = FileMapper.toDomain(raw.photo);
    }
    domainEntity.role = raw.role;
    domainEntity.status = raw.status;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    domainEntity.deletedAt = raw.deletedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: User): UserEntity {
    let role: RoleEntity | undefined = undefined;

    if (domainEntity.role) {
      role = new RoleEntity();
      role.id = Number(domainEntity.role.id);
    }

    let photo: FileEntity | undefined | null = undefined;

    if (domainEntity.photo) {
      photo = new FileEntity();
      photo.id = domainEntity.photo.id;
      photo.path = domainEntity.photo.path;
    } else if (domainEntity.photo === null) {
      photo = null;
    }

    let status: StatusEntity | undefined = undefined;

    if (domainEntity.status) {
      status = new StatusEntity();
      status.id = Number(domainEntity.status.id);
    }

    const persistenceEntity = new UserEntity();
    persistenceEntity.emailVerifiedAt = domainEntity.emailVerifiedAt;

    if (domainEntity.id && typeof domainEntity.id === 'number') {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.email = domainEntity.email;
    persistenceEntity.password = domainEntity.password;
    persistenceEntity.provider = domainEntity.provider;
    persistenceEntity.socialId = domainEntity.socialId;
    persistenceEntity.username = domainEntity.username;
    persistenceEntity.fullName = domainEntity.fullName ?? null;
    persistenceEntity.position = domainEntity.position ?? null;
    persistenceEntity.firstName = domainEntity.firstName ?? null;
    persistenceEntity.lastName = domainEntity.lastName ?? null;
    if (domainEntity.level !== undefined)
      persistenceEntity.level = domainEntity.level;
    if (domainEntity.currentExp !== undefined)
      persistenceEntity.currentExp = domainEntity.currentExp;
    persistenceEntity.avatarFrame = domainEntity.avatarFrame;
    persistenceEntity.currentHskLevel = domainEntity.currentHskLevel ?? null;
    persistenceEntity.targetHskLevel = domainEntity.targetHskLevel ?? null;
    persistenceEntity.dailyStudyTime = domainEntity.dailyStudyTime ?? null;
    if (domainEntity.studentCode !== undefined) {
      persistenceEntity.studentCode = domainEntity.studentCode;
    }
    persistenceEntity.photo = photo;
    persistenceEntity.role = role;
    persistenceEntity.status = status;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    persistenceEntity.deletedAt = domainEntity.deletedAt;
    return persistenceEntity;
  }
}
