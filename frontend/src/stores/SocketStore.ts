import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface SocketState {
  socket: Socket | null;
  connect: () => void;
  disconnect: () => void;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,

  connect: () => {
    // Reuse if already connected
    if (get().socket) return;

    const s = io(SOCKET_URL, { transports: ['websocket'], withCredentials: true });
    set({ socket: s });
  },

  disconnect: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ socket: null });
    }
  },
}));
