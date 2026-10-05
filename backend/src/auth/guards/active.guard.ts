import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { StatusEnum } from '../../statuses/statuses.enum';

@Injectable()
export class ActiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    // Tokens issued before `status` was added to the JWT payload have no
    // status at all. Treat them as stale credentials (401) instead of a
    // permission problem (403), so the client refreshes them and retries
    // rather than telling an active user their account is not approved.
    if (!user.status?.id) {
      throw new UnauthorizedException();
    }

    if (Number(user.status.id) !== StatusEnum.active) {
      throw new ForbiddenException(
        'Tài khoản của bạn chưa được duyệt (trạng thái: PENDING) hoặc đã bị khóa.',
      );
    }

    return true;
  }
}
