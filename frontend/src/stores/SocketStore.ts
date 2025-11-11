import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connect: (url: string) => void;
  ensure: (url: string) => void;
  disconnect: () => void;
  isConnected: () => boolean;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,

  connect: (url: string) => {
    const existing = get().socket;
    if (existing) {
      if (!existing.connected) existing.connect(); // why: reconnect if an instance exists but is offline
      return;
    }

    const s = io(url, {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });

    set({ socket: s });

    s.on('connect', () => console.log('[socket] connected:', s.id));
    s.on('reconnect', attempt => console.log('[socket] reconnected', attempt));
    s.on('connect_error', err => console.warn('[socket] connect_error:', err?.message || err));
    s.on('reconnect_error', err =>
      console.warn('[socket] reconnect_error:', err?.message || err)
    );
    s.on('disconnect', reason => console.log('[socket] disconnected:', reason));
  },

  ensure: (url: string) => {
    const s = get().socket;
    if (!s || !s.connected) get().connect(url); // why: guarantee a live socket for post-refresh flows
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ socket: null });
    }
  },

  isConnected: () => {
    const s = get().socket;
    return !!s && s.connected;
  },
}));
