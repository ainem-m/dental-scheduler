<template>
  <div class="status">
    接続状態: {{ isConnected ? '接続済み' : '切断' }}
  </div>
  <canvas ref="reservationCanvas" @click="handleCanvasClick" class="reservation-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useGridDrawer } from '../composables/useGridDrawer';
import { useSocket } from '../composables/useSocket';

const reservationCanvas = ref(null);
const reservations = ref([]); // 予約状態をコンポーネントで管理

const { 
  initializeCanvas, 
  drawGrid, 
  getCoordinatesFromMouseEvent,
} = useGridDrawer(reservationCanvas, reservations); // reservations を渡す

const { isConnected, on, off, emit } = useSocket();

// --- Socket イベントハンドラ ---
const handleNewReservation = (newReservation) => {
  reservations.value.push(newReservation);
};

const handleInitialReservations = (initialReservations) => {
  reservations.value = initialReservations;
};

onMounted(() => {
  initializeCanvas();
  drawGrid();
  
  // Socketイベントリスナーを登録
  on('new-reservation', handleNewReservation);
  on('initial-reservations', handleInitialReservations);

  // 初期データをリクエスト
  emit('get-initial-reservations');
});

onUnmounted(() => {
  // コンポーネント破棄時にリスナーを解除
  off('new-reservation', handleNewReservation);
  off('initial-reservations', handleInitialReservations);
});

function handleCanvasClick(event) {
  const coords = getCoordinatesFromMouseEvent(event);
  if (coords) {
    const patientName = prompt('患者名を入力してください:');
    if (patientName) {
      const newReservation = {
        date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        time_min: coords.time_min,
        column_index: coords.column_index,
        patient_name: patientName,
        handwriting: null,
      };
      // サーバーに新しい予約を送信
      emit('create-reservation', newReservation);
    }
  }
}
</script>

<style scoped>
.reservation-canvas {
  border: 1px solid black;
  cursor: pointer;
}
.status {
  margin-bottom: 10px;
  padding: 5px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
}
</style>
