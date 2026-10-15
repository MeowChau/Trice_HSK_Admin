import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { JwtPayloadType } from './types/jwt-payload.type';
import { AllConfigType } from '../../config/config.type';
import { SessionService } from '../../session/session.service';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService<AllConfigType>,
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.getOrThrow('auth.secret', { infer: true }),
      algorithms: ['HS256'],
    });
  }

  public async validate(payload: JwtPayloadType): Promise<JwtPayloadType> {
    if (!payload.id || !payload.sessionId) {
      throw new UnauthorizedException();
    }
    const session = await this.sessionService.findById(payload.sessionId);
    if (!session?.user || String(session.user.id) !== String(payload.id)) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(payload.id);
    if (!user || !user.role || !user.status) {
      throw new UnauthorizedException();
    }
    return { ...payload, role: user.role, status: user.status };
  }
}
