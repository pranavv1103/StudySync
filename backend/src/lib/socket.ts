import type { Server } from 'socket.io';

let io: Server | null = null;

export function initializeSocket(server: Server) {
  io = server;

  io.on('connection', (socket) => {
    socket.on('join-workspace', (payload: { workspaceId?: string; userId?: string }) => {
      if (payload.workspaceId) {
        socket.join(`workspace:${payload.workspaceId}`);
      }

      if (payload.userId) {
        socket.join(`user:${payload.userId}`);
      }
    });

    socket.emit('system:ready', {
      message: 'StudySync realtime channel connected',
    });
  });
}

export function emitWorkspaceEvent(workspaceId: string, event: string, payload: unknown) {
  io?.to(`workspace:${workspaceId}`).emit(event, payload);
}

export function emitUserEvent(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
