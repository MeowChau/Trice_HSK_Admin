import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Socket } from 'socket.io';
import { GameGateway } from './game.gateway';
import { GameService, type PkEvent } from './game.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

describe('GameGateway authentication and rooms', () => {
  let gateway: GameGateway;
  const game = {
    handleUserConnect: jest.fn(),
    handleUserDisconnect: jest.fn(),
    findMatch: jest.fn(),
    dispatch: jest.fn(),
    subscribeEvents: jest.fn(),
  };
  const jwt = { verifyAsync: jest.fn() };
  const strategy = { validate: jest.fn() };
  const sockets = new Map<string, Socket>();
  const broadcast = { emit: jest.fn() };
  const server = { sockets, emit: jest.fn(), to: jest.fn(() => broadcast) };
  const payload = {
    id: 7,
    sessionId: 10,
    role: { id: 2 },
    status: { id: 1 },
    exp: 9999999999,
  };

  function client(
    id = 'socket-one',
    token?: string,
    hskLevel: string = '1',
  ): Socket {
    return {
      id,
      connected: true,
      handshake: {
        headers: {},
        auth: token ? { token } : {},
        query: { hskLevel },
      },
      disconnect: jest.fn(),
      emit: jest.fn(),
      join: jest.fn().mockResolvedValue(undefined),
    } as unknown as Socket;
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    sockets.clear();
    server.to.mockReturnValue(broadcast);
    jwt.verifyAsync.mockResolvedValue(payload);
    strategy.validate.mockResolvedValue(payload);
    game.handleUserConnect.mockResolvedValue(1);
    game.handleUserDisconnect.mockResolvedValue({ count: 0, events: [] });
    game.dispatch.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        GameGateway,
        { provide: GameService, useValue: game },
        { provide: JwtService, useValue: jwt },
        { provide: JwtStrategy, useValue: strategy },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'unit-test-secret' },
        },
      ],
    }).compile();
    gateway = module.get(GameGateway);
    gateway.server = server as unknown as Namespace;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  it('should disconnect unauthenticated clients instead of assigning a random user ID', async () => {
    const socket = client();
    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(game.handleUserConnect).not.toHaveBeenCalled();
  });

  it('should reject inactive accounts', async () => {
    strategy.validate.mockResolvedValue({ ...payload, status: { id: 2 } });
    const socket = client('blocked', 'token');
    await gateway.handleConnection(socket);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(game.handleUserConnect).not.toHaveBeenCalled();
  });

  it.each(['0', '10', '1.5', 'nope'])(
    'should reject invalid HSK level %s',
    async (hskLevel) => {
      const socket = client('invalid-level', 'token', hskLevel);
      await gateway.handleConnection(socket);
      expect(socket.disconnect).toHaveBeenCalledWith(true);
      expect(game.handleUserConnect).not.toHaveBeenCalled();
    },
  );

  it('should pass socket identity to online accounting and cleanup', async () => {
    const socket = client('socket-one', 'token');
    await gateway.handleConnection(socket);
    await gateway.handleDisconnect(socket);
    expect(game.handleUserConnect).toHaveBeenCalledWith(7, 1, 'socket-one');
    expect(game.handleUserDisconnect).toHaveBeenCalledWith(7, 1, 'socket-one');
    expect(socket.join).toHaveBeenCalledWith('pk_user_7');
    expect(server.emit).toHaveBeenLastCalledWith('online_count_update', {
      hskLevel: 1,
      count: 0,
    });
    expect(game.dispatch).toHaveBeenCalledWith([]);
  });

  it('should use namespace sockets and await joining before dispatching a match', async () => {
    const socket = client('socket-one', 'token');
    sockets.set(socket.id, socket);
    await gateway.handleConnection(socket);
    const match = {
      revision: 1,
      roomId: 'room-1',
      users: [7, 8],
      players: [],
      readyUserIds: [],
      index: 0,
      stage: 'waiting' as const,
      turnUserId: 7,
      deadline: Date.now() + 60000,
      scores: [],
      serverNow: Date.now(),
      questions: [],
    };
    const events: PkEvent[] = [
      { userIds: match.users, event: 'match_found', payload: match },
    ];
    game.findMatch.mockResolvedValue({
      matchFound: true,
      match,
      events,
    });
    let finishJoin!: () => void;
    const join = new Promise<void>((resolve) => {
      finishJoin = resolve;
    });
    jest.spyOn(socket, 'join').mockReturnValue(join);
    const pending = gateway.handleFindMatch(socket);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(socket.join).toHaveBeenCalledWith('room-1');
    expect(game.dispatch).not.toHaveBeenCalled();
    finishJoin();
    await expect(pending).resolves.toEqual({ ok: true });
    expect(game.findMatch).toHaveBeenCalledWith(7, 1, undefined);
    expect(game.dispatch).toHaveBeenCalledWith(events);
  });

  it('should broadcast committed match events to account rooms and unsubscribe on shutdown', () => {
    let receiveEvent!: (event: PkEvent) => void;
    const stopEvents = jest.fn();
    game.subscribeEvents.mockImplementation((listener) => {
      receiveEvent = listener;
      return stopEvents;
    });
    gateway.onModuleInit();
    const event: PkEvent = {
      userIds: [7, 8],
      event: 'match_cancelled',
      payload: { roomId: 'room-1', message: 'Cancelled' },
    };
    receiveEvent(event);
    expect(server.to).toHaveBeenCalledWith(['pk_user_7', 'pk_user_8']);
    expect(broadcast.emit).toHaveBeenCalledWith(event.event, event.payload);
    expect(stopEvents).not.toHaveBeenCalled();
    gateway.onModuleDestroy();
    expect(stopEvents).toHaveBeenCalledTimes(1);
  });

  it('should disconnect accounts blocked after connecting', async () => {
    const socket = client('socket-one', 'token');
    await gateway.handleConnection(socket);
    strategy.validate.mockResolvedValue({ ...payload, status: { id: 2 } });
    await gateway.handleFindMatch(socket);
    expect(socket.disconnect).toHaveBeenCalledWith(true);
    expect(game.findMatch).not.toHaveBeenCalled();
  });
});
