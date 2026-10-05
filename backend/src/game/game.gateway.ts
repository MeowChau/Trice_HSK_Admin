import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '../config/config.type';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Map to store client sockets: socketId -> userId
  private clientUsers = new Map<string, { userId: number; hskLevel: number }>();

  constructor(
    private readonly gameService: GameService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers.authorization;
      let userId = 0;
      let hskLevel = 1;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const payload = this.jwtService.verify(token, {
          secret: this.configService.get('auth.secret', { infer: true }),
        });
        userId = payload.id;
        // In a real app, you would fetch user from DB here to get currentHskLevel
        // Assuming we pass it in handshake query or default to 1 for now.
        hskLevel = parseInt(client.handshake.query.hskLevel as string, 10) || 1;
      } else {
        // Fallback for testing without token
        userId = Math.floor(Math.random() * 1000000);
        hskLevel = parseInt(client.handshake.query.hskLevel as string, 10) || 1;
      }

      this.clientUsers.set(client.id, { userId, hskLevel });

      const count = await this.gameService.handleUserConnect(userId, hskLevel);

      // Emit online count to all clients in the same namespace
      this.server.emit('online_count_update', { hskLevel, count });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userInfo = this.clientUsers.get(client.id);
    if (userInfo) {
      this.clientUsers.delete(client.id);
      const count = await this.gameService.handleUserDisconnect(
        userInfo.userId,
        userInfo.hskLevel,
      );
      this.server.emit('online_count_update', {
        hskLevel: userInfo.hskLevel,
        count,
      });
    }
  }

  @SubscribeMessage('find_match')
  async handleFindMatch(@ConnectedSocket() client: Socket) {
    const userInfo = this.clientUsers.get(client.id);
    if (!userInfo) return;

    const result = await this.gameService.findMatch(
      userInfo.userId,
      userInfo.hskLevel,
    );

    if (result.matchFound) {
      // Find the sockets for the users matched
      const matchedSockets: Socket[] = [];
      this.clientUsers.forEach((info, socketId) => {
        if (result.users!.includes(info.userId)) {
          const socket = this.server.sockets.sockets.get(socketId);
          if (socket) matchedSockets.push(socket);
        }
      });

      // Join room and emit match_found
      matchedSockets.forEach((s) => {
        void s.join(result.roomId!);
      });

      this.server.to(result.roomId!).emit('match_found', {
        roomId: result.roomId,
        questions: result.questions,
        users: result.users,
      });
    }
  }
}
