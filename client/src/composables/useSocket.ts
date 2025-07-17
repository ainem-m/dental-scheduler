import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import io, { type Socket } from 'socket.io-client';

interface SocketComposable {
  isConnected: Ref<boolean>;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  socketEmit: (event: string, ...args: any[]) => void;
  emit: (event: string, ...args: any[]) => void;
  joinDateRoom: (date: string) => void;
}

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
const socket: Socket = io(SOCKET_URL);

export function useSocket(): SocketComposable {
  const isConnected = ref(socket.connected);

  function on(event: string, callback: (...args: any[]) => void): void {
    socket.on(event, callback);
  }

  function off(event: string, callback?: (...args: any[]) => void): void {
    socket.off(event, callback);
  }

  function emit(event: string, ...args: any[]): void {
    socket.emit(event, ...args);
  }

  function joinDateRoom(date: string): void {
    emit('join-date-room', date);
  }

  const handleConnect = (): void => {
    isConnected.value = true;
  };

  const handleDisconnect = (): void => {
    isConnected.value = false;
  };

  onMounted(() => {
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
  });

  onUnmounted(() => {
    socket.off('connect', handleConnect);
    socket.off('disconnect', handleDisconnect);
  });

  return {
    isConnected,
    on,
    off,
    socketEmit: emit,
    emit,
    joinDateRoom,
  };
}