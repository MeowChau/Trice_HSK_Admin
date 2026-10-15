import {
  HttpStatus,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { NullableType } from '../utils/types/nullable.type';
import { FilterUserDto, SortUserDto } from './dto/query-user.dto';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { User } from './domain/user';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { AuthProvidersEnum } from '../auth/auth-providers.enum';
import { FilesService } from '../files/files.service';
import { RoleEnum } from '../roles/roles.enum';
import { StatusEnum } from '../statuses/statuses.enum';
import { IPaginationOptions } from '../utils/types/pagination-options';
import { FileType } from '../files/domain/file';
import { Role } from '../roles/domain/role';
import { Status } from '../statuses/domain/status';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { SessionService } from '../session/session.service';
import { Session } from '../session/domain/session';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly filesService: FilesService,
    private readonly auditLogsService: AuditLogsService,
    private readonly sessionService: SessionService,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    const password = await bcrypt.hash(
      createUserDto.password ?? randomBytes(24).toString('base64url'),
      await bcrypt.genSalt(),
    );

    let email: string | null = null;

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        createUserDto.email,
      );
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }
      email = createUserDto.email;
    } else if (createUserDto.username) {
      email = `${createUserDto.username.toLowerCase()}@tricehsk.edu.vn`;
    }

    let photo: FileType | null | undefined = undefined;

    if (createUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        createUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
      photo = fileObject;
    } else if (createUserDto.photo === null) {
      photo = null;
    }

    let role: Role = { id: RoleEnum.user };

    if (createUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(createUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: createUserDto.role.id,
      };
    }

    let status: Status = { id: StatusEnum.pending };

    if (createUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(createUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: createUserDto.status.id,
      };
    }

    const studentCode = createUserDto.studentCode ?? null;

    const createdUser = await this.usersRepository.create({
      // Do not remove comment below.
      // <creating-property-payload />
      emailVerifiedAt: createUserDto.emailVerifiedAt,

      email: email,
      password: password,
      photo: photo,
      role: role,
      status: status,
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
      socialId: createUserDto.socialId,
      username:
        createUserDto.username || createUserDto.email || 'user_' + Date.now(),
      fullName: createUserDto.fullName ?? null,
      position: createUserDto.position ?? null,
      firstName: createUserDto.firstName ?? null,
      lastName: createUserDto.lastName ?? null,
      level: createUserDto.level ?? 1,
      currentExp: createUserDto.currentExp ?? 0,
      avatarFrame: createUserDto.avatarFrame ?? null,
      studentCode,
      currentHskLevel: createUserDto.currentHskLevel ?? null,
      targetHskLevel: createUserDto.targetHskLevel ?? null,
      dailyStudyTime: createUserDto.dailyStudyTime ?? null,
    });

    const isTeacher = createdUser.role?.id === RoleEnum.teacher;
    this.auditLogsService.record({
      action: 'CREATE',
      entityType: isTeacher ? 'TEACHER' : 'STUDENT',
      entityId: String(createdUser.id),
      summary: `Thêm mới tài khoản ${isTeacher ? 'giảng viên' : 'học viên'} ${createdUser.fullName || createdUser.email}`,
      newData: {
        email: createdUser.email,
        fullName: createdUser.fullName,
        position: createdUser.position,
      },
      changedFields: ['email', 'fullName', 'position'],
    });

    return createdUser;
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  findByLogin(login: string): Promise<NullableType<User>> {
    return this.usersRepository.findByLogin(login);
  }

  findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: User['socialId'];
    provider: User['provider'];
  }): Promise<NullableType<User>> {
    return this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
  }

  async update(
    id: User['id'],
    updateUserDto: UpdateUserDto,
    options?: { excludeSessionId: Session['id'] },
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.usersRepository.findById(id);

      if (userObject && userObject?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      if (userObject && userObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailAlreadyExists',
          },
        });
      }

      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let photo: FileType | null | undefined = undefined;

    if (updateUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        updateUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: 'imageNotExists',
          },
        });
      }
      photo = fileObject;
    } else if (updateUserDto.photo === null) {
      photo = null;
    }

    let role: Role | undefined = undefined;

    if (updateUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(updateUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: 'roleNotExists',
          },
        });
      }

      role = {
        id: updateUserDto.role.id,
      };
    }

    let status: Status | undefined = undefined;

    if (updateUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(updateUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: 'statusNotExists',
          },
        });
      }

      status = {
        id: updateUserDto.status.id,
      };
    }

    const studentCode = updateUserDto.studentCode;

    const oldUser = await this.usersRepository.findById(id);

    const updatedUser = await this.usersRepository.update(id, {
      // Do not remove comment below.
      // <updating-property-payload />
      emailVerifiedAt:
        updateUserDto.emailVerifiedAt !== undefined
          ? updateUserDto.emailVerifiedAt
          : email !== undefined && email !== oldUser?.email
            ? null
            : undefined,

      email,
      password,
      photo,
      role,
      status,
      provider: updateUserDto.provider,
      socialId: updateUserDto.socialId,
      username: updateUserDto.username,
      fullName: updateUserDto.fullName,
      position: updateUserDto.position,
      firstName: updateUserDto.firstName,
      lastName: updateUserDto.lastName,
      level: updateUserDto.level,
      currentExp: updateUserDto.currentExp,

      avatarFrame: updateUserDto.avatarFrame,
      currentHskLevel: updateUserDto.currentHskLevel,
      targetHskLevel: updateUserDto.targetHskLevel,
      dailyStudyTime: updateUserDto.dailyStudyTime,
      studentCode,
    });

    if (password && updatedUser) {
      if (options) {
        await this.sessionService.deleteByUserIdWithExclude({
          userId: id,
          excludeSessionId: options.excludeSessionId,
        });
      } else {
        await this.sessionService.deleteByUserId({ userId: id });
      }
    }

    if (updatedUser) {
      const isTeacher = updatedUser.role?.id === RoleEnum.teacher;
      const changed: string[] = [];
      const oldSnap: Record<string, unknown> = {};
      const newSnap: Record<string, unknown> = {};

      if (
        updateUserDto.fullName !== undefined &&
        updateUserDto.fullName !== oldUser?.fullName
      ) {
        changed.push('fullName');
        oldSnap.fullName = oldUser?.fullName;
        newSnap.fullName = updateUserDto.fullName;
      }
      if (
        updateUserDto.position !== undefined &&
        updateUserDto.position !== oldUser?.position
      ) {
        changed.push('position');
        oldSnap.position = oldUser?.position;
        newSnap.position = updateUserDto.position;
      }
      if (
        updateUserDto.status !== undefined &&
        updateUserDto.status.id !== oldUser?.status?.id
      ) {
        changed.push('status');
        oldSnap.status =
          oldUser?.status?.name ||
          (oldUser?.status?.id === 1 ? 'Active' : 'Inactive');
        newSnap.status =
          updatedUser.status?.name ||
          (updateUserDto.status.id === 1 ? 'Active' : 'Inactive');
      }

      let summary = `Cập nhật thông tin ${isTeacher ? 'giảng viên' : 'người dùng'} ${updatedUser.fullName || updatedUser.email}`;
      if (changed.includes('position')) {
        summary = `Đổi chức vụ giảng viên ${updatedUser.fullName || updatedUser.email} thành ${updatedUser.position}`;
      } else if (changed.includes('status')) {
        summary = `Đổi trạng thái tài khoản ${updatedUser.fullName || updatedUser.email} thành ${updatedUser.status?.name}`;
      }

      this.auditLogsService.record({
        action: changed.includes('status') ? 'STATUS_CHANGE' : 'UPDATE',
        entityType: isTeacher ? 'TEACHER' : 'STUDENT',
        entityId: String(id),
        summary,
        oldData: oldSnap,
        newData: newSnap,
        changedFields: changed.length > 0 ? changed : ['profile'],
      });
    }

    return updatedUser;
  }

  async remove(id: User['id']): Promise<void> {
    const user = await this.usersRepository.findById(id);
    await this.usersRepository.remove(id);
    await this.sessionService.deleteByUserId({ userId: id });
    if (user) {
      const isTeacher = user.role?.id === RoleEnum.teacher;
      this.auditLogsService.record({
        action: 'DELETE',
        entityType: isTeacher ? 'TEACHER' : 'STUDENT',
        entityId: String(id),
        summary: `Xóa tài khoản ${isTeacher ? 'giảng viên' : 'người dùng'} ${user.fullName || user.email}`,
        oldData: { email: user.email, fullName: user.fullName },
        changedFields: ['deleted'],
      });
    }
  }

  async issueTempPassword(id: User['id']): Promise<string> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'User not found',
        },
      });
    }

    // Use cryptographic randomness for temporary credentials.
    const tempPassword = randomBytes(12).toString('base64url');

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    await this.usersRepository.update(id, {
      password: hashedPassword,
    });
    await this.sessionService.deleteByUserId({ userId: id });

    const isTeacher = user.role?.id === RoleEnum.teacher;
    this.auditLogsService.record({
      action: 'RESET_PASSWORD',
      entityType: isTeacher ? 'TEACHER' : 'STUDENT',
      entityId: String(id),
      summary: `Cấp lại mật khẩu tạm thời cho ${isTeacher ? 'giảng viên' : 'học viên'} ${user.fullName || user.email}`,
      newData: { email: user.email },
      changedFields: ['password'],
    });

    return tempPassword;
  }
}
