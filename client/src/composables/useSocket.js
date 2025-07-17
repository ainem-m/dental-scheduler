import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';

// Use environment variable for the socket server URL, with a fallback
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
const socket = io(SOCKET_URL);

export function useSocket() {
  const isConnected = ref(socket.connected);

  function on(event, callback) {
    socket.on(event, callback);
  }

  function off(event, callback) {
    socket.off(event, callback);
  }

  function emit(event, ...args) {
    socket.emit(event, ...args);
  }

  function joinDateRoom(date) {
    emit('join-date-room', date);
  }

  const handleConnect = () => {
    isConnected.value = true;
  };

  const handleDisconnect = () => {
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
    socketEmit: emit, // Alias for consistency with ReservationGrid
    emit,
    joinDateRoom, // Expose the new function
  };
}
