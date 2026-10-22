import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { GameService, PkEvent } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { StatusEnum } from '../statuses/statuses.enum';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';

interface ClientIdentity {
  userId: number;
  hskLevel: number;
  payload: JwtPayloadType;
  resumeRoomId?: string;
}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@WebSocketGateway({
  cors: {
    origin:
      process.env.APP_CORS_ORIGINS?.split(',').map((origin) => origin.trim()) ||
      '*',
  },
  namespace: '/game',
})
export class GameGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer() server: Namespace;
  private readonly logger = new Logger(GameGateway.name);
  private readonly clientUsers = new Map<string, ClientIdentity>();
  private readonly matchmakingClients = new Set<string>();
  private sweepTimer: NodeJS.Timeout;
  private presenceTimer: NodeJS.Timeout;
  private stopEvents: () => void;
  private sweeping = false;

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  onModuleInit() {
    this.stopEvents = this.gameService.subscribeEvents((event) =>
      this.broadcast(event),
    );
    this.sweepTimer = setInterval(() => {
      void this.sweep();
    }, 500);
    this.presenceTimer = setInterval(() => {
      void this.refreshAuthorizedPresence().catch((error) =>
        this.logger.error('Unable to refresh game presence', error),
      );
    }, 10000);
    this.sweepTimer.unref();
    this.presenceTimer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.sweepTimer);
    clearInterval(this.presenceTimer);
    this.stopEvents?.();
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      const token: unknown =
        client.handshake.auth?.token ||
        (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined);
      if (typeof token !== 'string' || !token)
        throw new Error('Missing credentials');
      const payload = await this.jwtService.verifyAsync<JwtPayloadType>(token, {
        secret: this.configService.getOrThrow('auth.secret', { infer: true }),
        algorithms: ['HS256'],
      });
      const user = await this.jwtStrategy.validate(payload);
      const userId = Number(user.id);
      const hskLevel = Number(client.handshake.query.hskLevel ?? 1);
      if (
        Number(user.status?.id) !== StatusEnum.active ||
        !Number.isSafeInteger(userId) ||
        userId < 1 ||
        !Number.isInteger(hskLevel) ||
        hskLevel < 1 ||
        hskLevel > 9 ||
        payload.exp * 1000 <= Date.now()
      )
        throw new Error('Invalid game credentials');
      const resumeRoomId =
        typeof client.handshake.query.roomId === 'string' &&
        UUID.test(client.handshake.query.roomId)
          ? client.handshake.query.roomId
          : undefined;
      const count = await this.gameService.handleUserConnect(
        userId,
        hskLevel,
        client.id,
      );
      if (!client.connected) {
        const disconnected = await this.gameService.handleUserDisconnect(
          userId,
          hskLevel,
          client.id,
        );
        await this.gameService.dispatch(disconnected.events);
        return;
      }
      this.clientUsers.set(client.id, {
        userId,
        hskLevel,
        payload,
        resumeRoomId,
      });
      await client.join(this.userRoom(userId));
      client.emit('pk_connected', {
        userId,
        hskLevel,
        count,
        serverNow: Date.now(),
      });
      this.server.emit('online_count_update', { hskLevel, count });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const identity = this.clientUsers.get(client.id);
    this.clientUsers.delete(client.id);
    this.matchmakingClients.delete(client.id);
    if (!identity) return;
    try {
      const disconnected = await this.gameService.handleUserDisconnect(
        identity.userId,
        identity.hskLevel,
        client.id,
      );
      this.server.emit('online_count_update', {
        hskLevel: identity.hskLevel,
        count: disconnected.count,
      });
      await this.gameService.dispatch(disconnected.events);
    } catch (error) {
      this.logger.error('Failed to remove disconnected game user', error);
    }
  }

  @SubscribeMessage('find_match')
  async handleFindMatch(@ConnectedSocket() client: Socket) {
    if (this.matchmakingClients.has(client.id))
      return { ok: false, message: 'Đang tìm đối thủ.' };
    this.matchmakingClients.add(client.id);
    try {
      const identity = await this.authorize(client);
      const result = await this.gameService.findMatch(
        identity.userId,
        identity.hskLevel,
        identity.resumeRoomId,
      );
      identity.resumeRoomId = undefined;
      if (result.matchFound) {
        const sockets = [...this.clientUsers]
          .filter(([, user]) => result.match.users.includes(user.userId))
          .map(([socketId]) => this.server.sockets.get(socketId))
          .filter((socket): socket is Socket => Boolean(socket));
        await Promise.all(
          sockets.map((socket) => socket.join(result.match.roomId)),
        );
        await this.gameService.dispatch(result.events);
      }
      return { ok: true };
    } catch (error) {
      const message = this.message(error);
      client.emit('exception', { message });
      return { ok: false, message };
    } finally {
      this.matchmakingClients.delete(client.id);
    }
  }

  @SubscribeMessage('player_ready')
  async handleReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      const identity = await this.authorize(client);
      const roomId = this.roomId(body);
      const events = await this.gameService.ready(identity.userId, roomId);
      await this.gameService.dispatch(events);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.message(error) };
    }
  }

  @SubscribeMessage('submit_answer')
  async handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    try {
      const identity = await this.authorize(client);
      const roomId = this.roomId(body);
      const answer = body as { questionId?: unknown; optionId?: unknown };
      if (
        !Number.isSafeInteger(answer.questionId) ||
        Number(answer.questionId) < 1 ||
        typeof answer.optionId !== 'string' ||
        !answer.optionId ||
        answer.optionId.length > 128
      )
        throw new Error('Đáp án không hợp lệ.');
      const events = await this.gameService.answer(
        identity.userId,
        roomId,
        Number(answer.questionId),
        answer.optionId,
      );
      await this.gameService.dispatch(events);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.message(error) };
    }
  }

  @SubscribeMessage('cancel_match')
  async handleCancel(@ConnectedSocket() client: Socket) {
    try {
      const identity = await this.authorize(client);
      await this.gameService.dispatch(
        await this.gameService.cancelMatch(identity.userId, identity.hskLevel),
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, message: this.message(error) };
    }
  }

  private async authorize(client: Socket): Promise<ClientIdentity> {
    const identity = this.clientUsers.get(client.id);
    if (!identity || identity.payload.exp * 1000 <= Date.now()) {
      client.disconnect(true);
      throw new Error('Phiên đăng nhập đã hết hạn.');
    }
    try {
      const user = await this.jwtStrategy.validate(identity.payload);
      if (
        Number(user.id) !== identity.userId ||
        Number(user.status?.id) !== StatusEnum.active
      )
        throw new Error('Inactive account');
      return identity;
    } catch {
      client.disconnect(true);
      throw new Error('Phiên đăng nhập không còn hiệu lực.');
    }
  }

  private roomId(body: unknown): string {
    const roomId = (body as { roomId?: unknown } | null)?.roomId;
    if (typeof roomId !== 'string' || !UUID.test(roomId))
      throw new Error('Mã trận đấu không hợp lệ.');
    return roomId;
  }

  private broadcast(event: PkEvent) {
    if (!this.server) return;
    // One emit per account-room reaches all of that account's devices. Redis
    // distributes committed events to other backend instances as well.
    this.server
      .to(event.userIds.map((userId) => this.userRoom(userId)))
      .emit(event.event, event.payload);
  }

  private async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      await this.gameService.dispatch(await this.gameService.advanceExpired());
    } catch (error) {
      this.logger.error('Unable to advance expired PK turns', error);
    } finally {
      this.sweeping = false;
    }
  }

  private async refreshAuthorizedPresence() {
    const users: { socketId: string; userId: number; hskLevel: number }[] = [];
    for (const [socketId] of this.clientUsers) {
      const socket = this.server?.sockets.get(socketId);
      if (!socket?.connected) continue;
      try {
        const identity = await this.authorize(socket);
        users.push({
          socketId,
          userId: identity.userId,
          hskLevel: identity.hskLevel,
        });
      } catch {
        /* authorize disconnects expired or revoked sessions. */
      }
    }
    await this.gameService.refreshPresence(users);
  }

  private userRoom(userId: number): string {
    return `pk_user_${userId}`;
  }
  private message(error: unknown): string {
    return error instanceof Error
      ? error.message
      : 'Không thể xử lý trận PK. Vui lòng thử lại.';
  }
}
