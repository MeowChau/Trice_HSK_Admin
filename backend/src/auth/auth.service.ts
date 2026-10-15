import {
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import ms from 'ms';
import crypto from 'crypto';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { AuthUpdateDto } from './dto/auth-update.dto';
import { AuthProvidersEnum } from './auth-providers.enum';
import { SocialInterface } from '../social/interfaces/social.interface';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { NullableType } from '../utils/types/nullable.type';
import { LoginResponseDto } from './dto/login-response.dto';
import { ConfigService } from '@nestjs/config';
import { JwtRefreshPayloadType } from './strategies/types/jwt-refresh-payload.type';
import { JwtPayloadType } from './strategies/types/jwt-payload.type';
import { UsersService } from '../users/users.service';
import { AllConfigType } from '../config/config.type';
import { MailService } from '../mail/mail.service';
import { RoleEnum } from '../roles/roles.enum';
import { Session } from '../session/domain/session';
import { SessionService } from '../session/session.service';
import { StatusEnum } from '../statuses/statuses.enum';
import { User } from '../users/domain/user';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByLogin(loginDto.email);

    if (!user) {
      throw this.invalidLoginException({
        email: 'notFound',
      });
    }

    if (user.provider !== AuthProvidersEnum.email) {
      throw this.invalidLoginException({
        email: `needLoginViaProvider:${user.provider}`,
      });
    }

    if (!user.password) {
      throw this.invalidLoginException({
        password: 'incorrectPassword',
      });
    }

    const isValidPassword = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isValidPassword) {
      throw this.invalidLoginException({
        password: 'incorrectPassword',
      });
    }

    this.assertActive(user);

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = await this.sessionService.create({
      user,
      hash,
    });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: user.role,
      status: user.status,
      sessionId: session.id,
      hash,
    });

    return {
      refreshToken,
      token,
      tokenExpires,
      user,
    };
  }

  async validateSocialLogin(
    authProvider: string,
    socialData: SocialInterface,
  ): Promise<LoginResponseDto> {
    let user: NullableType<User> = null;
    const socialEmail = socialData.email?.toLowerCase();
    let userByEmail: NullableType<User> = null;

    if (socialEmail && !socialData.emailVerified) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotVerified',
        },
      });
    }

    if (socialEmail) {
      userByEmail = await this.usersService.findByEmail(socialEmail);
    }

    if (socialData.id) {
      user = await this.usersService.findBySocialIdAndProvider({
        socialId: socialData.id,
        provider: authProvider,
      });
    }

    if (user) {
      this.assertActive(user);
      if (socialEmail && !userByEmail) {
        user.email = socialEmail;
      }
      await this.usersService.update(user.id, { email: user.email });
    } else if (userByEmail) {
      user = userByEmail;
      this.assertActive(user);
    } else if (socialData.id) {
      const role = {
        id: RoleEnum.user,
      };
      const status = {
        id: StatusEnum.pending,
      };

      user = await this.usersService.create({
        email: socialEmail ?? null,
        username: socialEmail
          ? socialEmail.split('@')[0]
          : `user_${socialData.id}`,
        socialId: socialData.id,
        provider: authProvider,
        emailVerifiedAt: socialEmail ? new Date() : null,
        role,
        status,
      });

      user = await this.usersService.findById(user.id);
    }

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    this.assertActive(user);

    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = await this.sessionService.create({
      user,
      hash,
    });

    const {
      token: jwtToken,
      refreshToken,
      tokenExpires,
    } = await this.getTokensData({
      id: user.id,
      role: user.role,
      status: user.status,
      sessionId: session.id,
      hash,
    });

    return {
      refreshToken,
      token: jwtToken,
      tokenExpires,
      user,
    };
  }

  async register(dto: AuthRegisterLoginDto): Promise<void> {
    const user = await this.usersService.create({
      ...dto,
      email: dto.email,
      role: {
        id: RoleEnum.user,
      },
      status: {
        id: StatusEnum.pending,
      },
    });

    await this.sendConfirmationEmail(user);
  }

  async resendConfirmation(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);
    if (
      !user ||
      user.provider !== AuthProvidersEnum.email ||
      user.emailVerifiedAt
    ) {
      return;
    }
    await this.sendConfirmationEmail(user);
  }

  private async sendConfirmationEmail(user: User): Promise<void> {
    if (!user.email) return;

    const hash = await this.jwtService.signAsync(
      {
        confirmEmailUserId: user.id,
        purpose: 'confirm-email',
        email: user.email,
      },
      {
        secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
          infer: true,
        }),
        expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
          infer: true,
        }),
      },
    );

    await this.mailService.userSignUp({
      to: user.email,
      data: {
        hash,
      },
    });
  }

  async confirmEmail(hash: string): Promise<void> {
    const data = await this.verifyEmailToken(hash, 'confirm-email');
    const user = await this.usersService.findById(data.confirmEmailUserId);
    if (!user) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }
    if (user.email !== data.email) throw this.invalidHashException();
    if (!user.emailVerifiedAt) {
      await this.usersService.update(user.id, { emailVerifiedAt: new Date() });
    }
  }

  async confirmNewEmail(hash: string): Promise<void> {
    const data = await this.verifyEmailToken(hash, 'change-email');
    const user = await this.usersService.findById(data.confirmEmailUserId);

    if (!user) {
      throw new NotFoundException({
        status: HttpStatus.NOT_FOUND,
        error: `notFound`,
      });
    }

    if (user.email !== data.email || !data.newEmail) {
      throw this.invalidHashException();
    }
    await this.usersService.update(user.id, {
      email: data.newEmail,
      emailVerifiedAt: new Date(),
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      const uniformErrors = this.configService.getOrThrow(
        'auth.uniformErrors',
        { infer: true },
      );

      // With uniform errors enabled we do not reveal whether the email is
      // registered: respond exactly like the success case and skip the mail.
      if (uniformErrors) {
        return;
      }

      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          email: 'emailNotExists',
        },
      });
    }

    const tokenExpiresIn = this.configService.getOrThrow('auth.forgotExpires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const hash = await this.jwtService.signAsync(
      {
        forgotUserId: user.id,
      },
      {
        secret: this.getForgotSecret(user),
        expiresIn: tokenExpiresIn,
      },
    );

    await this.mailService.forgotPassword({
      to: email,
      data: {
        hash,
        tokenExpires,
      },
    });
  }

  async resetPassword(hash: string, password: string): Promise<void> {
    let userId: User['id'] | undefined;

    try {
      const jwtData = this.jwtService.decode<{
        forgotUserId?: User['id'];
      } | null>(hash);

      userId = jwtData?.forgotUserId;
    } catch {
      userId = undefined;
    }

    let user: NullableType<User> = null;

    if (userId !== undefined && userId !== null) {
      try {
        user = await this.usersService.findById(userId);
      } catch {
        user = null;
      }
    }

    if (!user) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    try {
      await this.jwtService.verifyAsync(hash, {
        secret: this.getForgotSecret(user),
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    await this.usersService.update(user.id, { password });
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.id);
  }

  async update(
    userJwtPayload: JwtPayloadType,
    userDto: AuthUpdateDto,
  ): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.id);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          user: 'userNotFound',
        },
      });
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'missingOldPassword',
          },
        });
      }

      if (!currentUser.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      }

      const isValidOldPassword = await bcrypt.compare(
        userDto.oldPassword,
        currentUser.password,
      );

      if (!isValidOldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            oldPassword: 'incorrectOldPassword',
          },
        });
      }
    }

    if (userDto.email && userDto.email !== currentUser.email) {
      const userByEmail = await this.usersService.findByEmail(userDto.email);

      if (userByEmail && userByEmail.id !== currentUser.id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: 'emailExists',
          },
        });
      }

      const hash = await this.jwtService.signAsync(
        {
          confirmEmailUserId: currentUser.id,
          newEmail: userDto.email,
          purpose: 'change-email',
          email: currentUser.email,
        },
        {
          secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.confirmEmailExpires', {
            infer: true,
          }),
        },
      );

      await this.mailService.confirmNewEmail({
        to: userDto.email,
        data: {
          hash,
        },
      });
    }

    const changes = { ...userDto };
    delete changes.email;
    delete changes.oldPassword;

    await this.usersService.update(userJwtPayload.id, changes, {
      excludeSessionId: userJwtPayload.sessionId,
    });

    return this.usersService.findById(userJwtPayload.id);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, 'sessionId' | 'hash'>,
  ): Promise<Omit<LoginResponseDto, 'user'>> {
    const hash = crypto
      .createHash('sha256')
      .update(randomStringGenerator())
      .digest('hex');

    const session = await this.sessionService.updateByHash(
      { id: data.sessionId, hash: data.hash },
      { hash },
    );

    if (!session) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(session.user.id);

    if (!user?.role || Number(user.status?.id) !== StatusEnum.active) {
      throw new UnauthorizedException();
    }

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.user.id,
      role: {
        id: user.role.id,
      },
      status: user.status
        ? {
            id: user.status.id,
          }
        : undefined,
      sessionId: session.id,
      hash,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async softDelete(userJwtPayload: JwtPayloadType): Promise<void> {
    await this.usersService.remove(userJwtPayload.id);
  }

  async logout(data: Pick<JwtPayloadType, 'sessionId'>) {
    return this.sessionService.deleteById(data.sessionId);
  }

  private invalidLoginException(
    errors: Record<string, string>,
  ): UnprocessableEntityException {
    const uniformErrors = this.configService.getOrThrow('auth.uniformErrors', {
      infer: true,
    });

    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: uniformErrors
        ? {
            email: 'incorrectEmailOrPassword',
            password: 'incorrectEmailOrPassword',
          }
        : errors,
    });
  }

  private assertActive(user: User): void {
    if (Number(user.status?.id) !== StatusEnum.active) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { status: 'accountNotActive' },
      });
    }
  }

  private invalidHashException(): UnprocessableEntityException {
    return new UnprocessableEntityException({
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      errors: { hash: 'invalidHash' },
    });
  }

  private async verifyEmailToken(
    hash: string,
    purpose: 'confirm-email' | 'change-email',
  ): Promise<{
    confirmEmailUserId: User['id'];
    email: string | null;
    newEmail?: string;
  }> {
    try {
      const data = await this.jwtService.verifyAsync<Record<string, unknown>>(
        hash,
        {
          secret: this.configService.getOrThrow('auth.confirmEmailSecret', {
            infer: true,
          }),
          algorithms: ['HS256'],
        },
      );
      const id = data.confirmEmailUserId;
      const validId =
        (typeof id === 'number' && Number.isInteger(id) && id > 0) ||
        (typeof id === 'string' && /^[a-f\d]{24}$/i.test(id));
      if (
        !validId ||
        data.purpose !== purpose ||
        (data.email !== null && typeof data.email !== 'string') ||
        (purpose === 'confirm-email' && !data.email) ||
        (purpose === 'change-email' &&
          (typeof data.newEmail !== 'string' || !data.newEmail))
      ) {
        throw this.invalidHashException();
      }
      return {
        confirmEmailUserId: id as User['id'],
        email: data.email as string | null,
        newEmail: typeof data.newEmail === 'string' ? data.newEmail : undefined,
      };
    } catch {
      throw this.invalidHashException();
    }
  }

  private getForgotSecret(user: User): string {
    // The secret embeds the current password hash, so every outstanding
    // reset link stops verifying as soon as the password changes — this is
    // what makes reset links single-use without storing anything extra.
    const forgotSecret = this.configService.getOrThrow('auth.forgotSecret', {
      infer: true,
    });

    return `${forgotSecret}${user.password ?? ''}`;
  }

  private async getTokensData(data: {
    id: User['id'];
    role: User['role'];
    status?: User['status'];
    sessionId: Session['id'];
    hash: Session['hash'];
  }) {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', {
      infer: true,
    });

    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        {
          id: data.id,
          role: data.role,
          // JwtStrategy replaces this snapshot with the current database status.
          status: data.status,
          sessionId: data.sessionId,
        },
        {
          secret: this.configService.getOrThrow('auth.secret', { infer: true }),
          expiresIn: tokenExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', {
            infer: true,
          }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', {
            infer: true,
          }),
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }
}
