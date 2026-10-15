import { Logger } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import type { JwtPayloadType } from '../auth/strategies/types/jwt-payload.type';
import { StatusEnum } from '../statuses/statuses.enum';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';

@WebSocketGateway({
  cors: {
    origin:
      process.env.APP_CORS_ORIGINS?.split(',').map((origin) => origin.trim()) ||
      '*',
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Namespace;
  private readonly logger = new Logger(GameGateway.name);
  private readonly clientUsers = new Map<
    string,
    { userId: number; hskLevel: number; payload: JwtPayloadType }
  >();
  private readonly matchmakingClients = new Set<string>();

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly jwtStrategy: JwtStrategy,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

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
        hskLevel > 9
      ) {
        throw new Error('Invalid game credentials');
      }
      const count = await this.gameService.handleUserConnect(
        userId,
        hskLevel,
        client.id,
      );
      if (!client.connected) {
        await this.gameService.handleUserDisconnect(
          userId,
          hskLevel,
          client.id,
        );
        return;
      }
      this.clientUsers.set(client.id, { userId, hskLevel, payload });
      this.server.emit('online_count_update', { hskLevel, count });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userInfo = this.clientUsers.get(client.id);
    this.clientUsers.delete(client.id);
    this.matchmakingClients.delete(client.id);
    if (!userInfo) return;
    try {
      const count = await this.gameService.handleUserDisconnect(
        userInfo.userId,
        userInfo.hskLevel,
        client.id,
      );
      this.server.emit('online_count_update', {
        hskLevel: userInfo.hskLevel,
        count,
      });
    } catch (error) {
      this.logger.error('Failed to remove disconnected game user', error);
    }
  }

  @SubscribeMessage('find_match')
  async handleFindMatch(@ConnectedSocket() client: Socket) {
    const userInfo = this.clientUsers.get(client.id);
    if (!userInfo || this.matchmakingClients.has(client.id)) return;
    this.matchmakingClients.add(client.id);
    try {
      const user = await this.jwtStrategy.validate(userInfo.payload);
      if (
        userInfo.payload.exp * 1000 <= Date.now() ||
        Number(user.status?.id) !== StatusEnum.active
      ) {
        client.disconnect(true);
        return;
      }
      const result = await this.gameService.findMatch(
        userInfo.userId,
        userInfo.hskLevel,
      );
      if (!result.matchFound) return;
      const matchedSockets = [...this.clientUsers.entries()]
        .filter(
          ([, info]) =>
            info.hskLevel === userInfo.hskLevel &&
            result.users.includes(info.userId),
        )
        .map(([socketId]) => this.server.sockets.get(socketId))
        .filter((socket): socket is Socket => Boolean(socket));
      await Promise.all(
        matchedSockets.map((socket) => socket.join(result.roomId)),
      );
      this.server.to(result.roomId).emit('match_found', result);
    } catch (error) {
      this.logger.error('Game matchmaking failed', error);
      client.emit('match_error', { message: 'Unable to find a match' });
    } finally {
      this.matchmakingClients.delete(client.id);
    }
  }
}
