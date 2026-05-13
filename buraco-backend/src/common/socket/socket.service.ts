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
}
