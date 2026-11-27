import { StatusEnum } from '../../../../../statuses/statuses.enum';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { FindOptionsWhere, Repository, In, Not, IsNull, Raw } from 'typeorm';
import { RoleEnum } from '../../../../../roles/roles.enum';
import { UserEntity } from '../entities/user.entity';
import { NullableType } from '../../../../../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from '../../../../dto/query-user.dto';
import { User } from '../../../../domain/user';
import { UserRepository } from '../../user.repository';
import { assertHskStudyGoals } from '../../../../dto/study-goals.dto';
import { UserMapper } from '../mappers/user.mapper';
import { IPaginationOptions } from '../../../../../utils/types/pagination-options';

@Injectable()
export class UsersRelationalRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(data: User): Promise<User> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(UserEntity);
      const prepared = await this.assignStudentCode(repository, data);
      const newEntity = await repository.save(
        repository.create(UserMapper.toPersistence(prepared)),
      );
      return UserMapper.toDomain(newEntity);
    });
  }

  private async assignStudentCode(
    repository: Repository<UserEntity>,
    data: User,
  ): Promise<User> {
    // A student code is issued only after approval, including explicit assignments.
    if (Number(data.status?.id) !== StatusEnum.active) {
      if (data.studentCode) {
        throw new ConflictException(
          'Mã học viên chỉ được cấp khi tài khoản đã được duyệt.',
        );
      }
      return data;
    }
    // All allocations and explicit assignments use the same transaction-scoped lock.
    await repository.query('SELECT pg_advisory_xact_lock($1)', [839141]);
    if (data.studentCode) {
      const duplicate = await repository.findOne({
        where: { studentCode: data.studentCode },
        withDeleted: true,
      });
      if (duplicate && String(duplicate.id) !== String(data.id)) {
        throw new ConflictException('Student code already exists');
      }
      return data;
    }
    const result = await repository
      .createQueryBuilder('user')
      .withDeleted()
      .select('MAX(user.studentCode)', 'max')
      .getRawOne<{ max: number | string | null }>();
    const studentCode = Number(result?.max ?? 0) + 1;
    if (!Number.isSafeInteger(studentCode) || studentCode > 2147483647) {
      throw new ConflictException('Student code range exhausted');
    }
    return { ...data, studentCode };
  }

  private buildWhere(
    filterOptions?: FilterUserDto | null,
  ): FindOptionsWhere<UserEntity> {
    const where: FindOptionsWhere<UserEntity> = {};
    if (filterOptions?.statuses?.length) {
      where.status = {
        id: In(filterOptions.statuses.map((status) => Number(status.id))),
      };
    }

    if (filterOptions?.roles?.length) {
      where.role = {
        id: In(filterOptions.roles.map((role) => Number(role.id))),
      };
    }

    if (
      filterOptions?.currentHskLevel !== undefined &&
      filterOptions?.currentHskLevel !== null
    ) {
      where.currentHskLevel = filterOptions.currentHskLevel;
    }

    if (filterOptions?.position) {
      // Match the effective position exposed by UserMapper, including legacy
      // teachers whose missing position is displayed as Bậc 1.
      where.position = Raw(
        (alias) =>
          `CASE WHEN "user"."roleId" = :positionTeacherRole
            THEN COALESCE(NULLIF(BTRIM(${alias}), ''), :defaultTeacherPosition)
            ELSE NULLIF(BTRIM(${alias}), '') END = :position`,
        {
          positionTeacherRole: RoleEnum.teacher,
          defaultTeacherPosition: UserMapper.normalizeTeacherPosition(null),
          position: filterOptions.position.trim(),
        },
      );
    }

    if (filterOptions?.onlyDeleted) {
      where.deletedAt = Not(IsNull());
    }

    return where;
  }

  private includesDeleted(filterOptions?: FilterUserDto | null): boolean {
    return (
      filterOptions?.onlyDeleted === true ||
      filterOptions?.excludeDeleted !== true
    );
  }

  count(filterOptions?: FilterUserDto | null): Promise<number> {
    return this.usersRepository
      .createQueryBuilder('user')
      .setFindOptions({
        where: this.buildWhere(filterOptions),
        withDeleted: this.includesDeleted(filterOptions),
      })
      .getCount();
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    const query = this.usersRepository
      .createQueryBuilder('user')
      .setFindOptions({
        skip: (paginationOptions.page - 1) * paginationOptions.limit,
        take: paginationOptions.limit,
        where: this.buildWhere(filterOptions),
        relations: ['photo', 'role', 'status'],
        loadEagerRelations: false,
        withDeleted: this.includesDeleted(filterOptions),
      });

    // Sort in the database before pagination. Selected aliases also keep the
    // normalized expressions available to TypeORM's paginated relation query.
    for (const [index, sort] of (sortOptions ?? []).entries()) {
      const column = this.usersRepository.metadata.findColumnWithPropertyPath(
        sort.orderBy,
      );
      if (!column) continue;
      const escapedColumn = `"user"."${column.databaseName}"`;
      const expression =
        sort.orderBy === 'fullName'
          ? `LOWER(COALESCE(NULLIF(BTRIM(user.fullName), ''), NULLIF(BTRIM(user.firstName), '')))`
          : column.type === String
            ? `LOWER(NULLIF(BTRIM(${escapedColumn}), ''))`
            : escapedColumn;
      const alias = `user_sort_${index}`;
      query
        .addSelect(expression, alias)
        .addOrderBy(alias, sort.order, 'NULLS LAST');
    }
    // Equal names and timestamps must not move between pages.
    if (!sortOptions?.some((sort) => sort.orderBy === 'id')) {
      query.addOrderBy('user.id', 'DESC');
    }
    const entities = await query.getMany();

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id: Number(id) },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByLogin(login: string): Promise<NullableType<User>> {
    const userByEmail = await this.findByEmail(login);
    if (userByEmail) return userByEmail;
    const entity = await this.usersRepository.findOne({
      where: { username: login },
    });
    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    if (!socialId || !provider) return null;

    const entity = await this.usersRepository.findOne({
      where: { socialId, provider },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    return this.usersRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(UserEntity);
      const entity = await repository.findOne({
        where: { id: Number(id) },
        lock: { mode: 'pessimistic_write', tables: ['user'] },
      });
      if (!entity) throw new NotFoundException('User not found');
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(
          ([key, value]) => key !== 'id' && value !== undefined,
        ),
      );
      const merged = {
        ...UserMapper.toDomain(entity),
        ...cleanPayload,
      };
      // Recheck against the locked row: a completed exam may have promoted it.
      if (
        payload.currentHskLevel !== undefined ||
        payload.targetHskLevel !== undefined
      ) {
        assertHskStudyGoals(merged.currentHskLevel, merged.targetHskLevel);
      }
      const needsStudentCode =
        (!merged.studentCode &&
          Number(merged.status?.id) === StatusEnum.active) ||
        (payload.studentCode !== undefined &&
          payload.studentCode !== entity.studentCode);
      const prepared = needsStudentCode
        ? await this.assignStudentCode(repository, merged)
        : merged;
      const updatedEntity = await repository.save(
        repository.create(UserMapper.toPersistence(prepared)),
      );
      return UserMapper.toDomain(updatedEntity);
    });
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.softDelete(id);
  }
}
