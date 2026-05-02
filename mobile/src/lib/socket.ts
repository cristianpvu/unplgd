import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from '../api/client';
import { getCachedToken, loadToken } from './authStore';

// Singleton socket. Mentinem o singura conexiune in app — sesiunile/rooms sunt
// scoped prin event-uri "hunt:join" / "hunt:leave".
let socket: Socket | null = null;
let connecting: Promise<Socket> | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket && socket.connected) return socket;
  if (connecting) return connecting;

  connecting = (async () => {
    const token = getCachedToken() ?? (await loadToken());
    const s = io(API_BASE_URL, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        s.off('connect_error', onError);
        resolve();
      };
      const onError = (err: Error) => {
        s.off('connect', onConnect);
        reject(err);
      };
      s.once('connect', onConnect);
      s.once('connect_error', onError);
    });
    socket = s;
    connecting = null;
    return s;
  })();

  try {
    return await connecting;
  } catch (e) {
    connecting = null;
    throw e;
  }
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connecting = null;
}
