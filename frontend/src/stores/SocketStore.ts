import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connect: (url: string) => void;
  disconnect: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,

  connect: (url: string) => {
    // Reuse if already connected
    if (get().socket) return;

    const s = io(url, { transports: ['websocket'], withCredentials: true });
    set({ socket: s });

    s.on('connect', () => console.log('[socket] connected:', s.id));
    s.on('disconnect', () => console.log('[socket] disconnected'));
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ socket: null });
    }
  },
}));
