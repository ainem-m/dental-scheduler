<template>
  <div class="status">
    接続状態: {{ isConnected ? '接続済み' : '切断' }}
  </div>
  <canvas 
    ref="reservationCanvas" 
    @mousedown="startDrawing"
    @mousemove="draw"
    @mouseup="stopDrawing"
    @mouseleave="stopDrawing"
    class="reservation-canvas"
  ></canvas>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useGridDrawer } from '../composables/useGridDrawer';
import { useSocket } from '../composables/useSocket';

const reservationCanvas = ref(null);
const reservations = ref([]);
const isDrawing = ref(false);

const { 
  initializeCanvas, 
  drawGrid, 
  getCoordinatesFromMouseEvent,
  getContext,
} = useGridDrawer(reservationCanvas, reservations);

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
  
  on('new-reservation', handleNewReservation);
  on('initial-reservations', handleInitialReservations);
  emit('get-initial-reservations');
});

onUnmounted(() => {
  off('new-reservation', handleNewReservation);
  off('initial-reservations', handleInitialReservations);
});

// --- 描画イベントハンドラ ---
function startDrawing(event) {
  const ctx = getContext();
  if (!ctx) return;

  isDrawing.value = true;
  const pos = getMousePos(event);
  
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y);
}

function draw(event) {
  if (!isDrawing.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const pos = getMousePos(event);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

async function stopDrawing(event) {
  if (!isDrawing.value) return;
  isDrawing.value = false;

  const canvas = reservationCanvas.value;
  const coords = getCoordinatesFromMouseEvent(event);

  if (!canvas || !coords) {
    drawGrid();
    return;
  }

  canvas.toBlob(async (blob) => {
    if (!blob) {
      drawGrid();
      return;
    }

    const formData = new FormData();
    formData.append('handwriting', blob, 'handwriting.png');

    try {
      const response = await fetch('/api/handwriting', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      
      const newReservation = {
        date: new Date().toISOString().split('T')[0],
        time_min: coords.time_min,
        column_index: coords.column_index,
        patient_name: null,
        handwriting: result.filename,
      };

      emit('create-reservation', newReservation);

    } catch (error) {
      console.error('Error uploading handwriting:', error);
      alert('手書き画像の保存に失敗しました。');
    } finally {
      // 予約作成の成否に関わらず、グリッドを再描画して手書きの線を消す
      drawGrid();
    }
  }, 'image/png');
}

function getMousePos(event) {
  const rect = reservationCanvas.value.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}
</script>

<style scoped>
.reservation-canvas {
  border: 1px solid black;
  cursor: crosshair;
}
.status {
  margin-bottom: 10px;
  padding: 5px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
}
</style>