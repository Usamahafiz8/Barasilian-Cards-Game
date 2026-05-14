import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class SocketService {
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emitToRoom(room: string, event: string, data: unknown) {
    this.server?.to(room).emit(event, data);
  }

  async emitPerPlayer(room: string, event: string, dataFn: (userId: string) => Promise<unknown>) {
    if (!this.server) return;
    const sockets = await this.server.in(room).fetchSockets();
    await Promise.all(
      sockets.map(async (s) => {
        const userId = s.data.userId as string;
        if (!userId) return;
        try {
          s.emit(event, await dataFn(userId));
        } catch {
          // Socket disconnected — reconnect will sync
        }
      }),
    );
  }
}
