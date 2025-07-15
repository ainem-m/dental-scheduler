import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';

const socket = io('http://localhost:3000'); // TODO: Make URL configurable

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
    // Consider if socket.disconnect() is needed here
  });

  return {
    isConnected,
    on,
    off,
    emit,
  };
}
