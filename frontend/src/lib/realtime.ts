import { io, type Socket } from 'socket.io-client';

let sharedSocket: Socket | null = null;

function trimTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function getSocketBaseUrl(): string {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitSocketUrl) {
    return trimTrailingSlash(explicitSocketUrl);
  }

  const apiUrl = import.meta.env.VITE_API_URL;
  if (apiUrl && /^https?:\/\//.test(apiUrl)) {
    try {
      const parsed = new URL(apiUrl);
      return trimTrailingSlash(`${parsed.protocol}//${parsed.host}`);
    } catch {
      // Fall through to defaults below.
    }
  }

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:4000';
  }

  return window.location.origin;
}

export function createRealtimeSocket(): Socket {
  if (!sharedSocket) {
    const socketUrl = getSocketBaseUrl();
    sharedSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
    });
  }

  return sharedSocket;
}
