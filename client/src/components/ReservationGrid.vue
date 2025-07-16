<template>
  <div class="grid-container">
    <canvas ref="canvas" @mousedown="onMouseDown"></canvas>
  </div>
  <ReservationModal
    :show="isModalVisible"
    :reservation="selectedReservation"
    @close="isModalVisible = false"
    @save="handleSaveReservation"
    @delete="handleDeleteReservation"
  />
</template>

<script setup>
import { ref, onMounted, reactive, onUnmounted, watch } from 'vue';
import ReservationModal from './ReservationModal.vue';
import { useGridDrawer } from '../composables/useGridDrawer';
import { useSocket } from '../composables/useSocket';

const props = defineProps({
  date: {
    type: String,
    required: true,
  },
});

const canvas = ref(null);
const ctx = ref(null);

// --- State ---
const reservations = reactive([]);
const isModalVisible = ref(false);
const selectedReservation = ref({});
const currentDate = ref(props.date);

// --- Grid Configuration ---
const config = reactive({
  columns: 6,
  startHour: 9,
  endHour: 18,
  timeSlotInterval: 30, // in minutes
  headerHeight: 50,
  timeColumnWidth: 80,
  lineColor: '#ccc',
  lineWidth: 1,
  cellHeightFixed: 80, // 固定の予約枠の高さ
});

// --- Derived Properties ---
const state = reactive({
  canvasWidth: 0,
  canvasHeight: 0,
  cellWidth: 0,
  cellHeight: 0,
  totalSlots: 0,
});

// --- useGridDrawer から関数をインポート ---
const { drawGrid, drawReservations, getCoordinatesFromMouseEvent } = useGridDrawer(canvas, reservations, config, state, ctx);
const { on, off, emit, joinDateRoom } = useSocket();

// --- Data Fetching ---
const fetchDataForDate = (date) => {
  currentDate.value = date;
  joinDateRoom(date); // Join the room for the new date
  emit('fetch-reservations', date);
};

// --- Socket.IO Functions ---
const saveReservation = (reservation) => {
  emit('save-reservation', reservation);
};

const deleteReservation = (id) => {
  emit('delete-reservation', id);
};

// --- Socket.IO Event Handlers ---
onMounted(() => {
  on('reservations-updated', (updatedReservations) => {
    console.log('reservations-updated received:', updatedReservations);
    // Ensure we only show reservations for the currently viewed date
    const filteredReservations = updatedReservations.filter(r => r.date === currentDate.value);
    reservations.splice(0, reservations.length, ...filteredReservations);
    draw();
  });
});

onUnmounted(() => {
  off('reservations-updated');
});


// --- Drawing Functions ---

const drawHeaders = () => {
    if (!ctx.value) return;
    const context = ctx.value;
    context.font = '14px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#333';

    // --- Draw Column Headers (e.g., "診察台 1") ---
    for (let i = 0; i < config.columns; i++) {
        const x = config.timeColumnWidth + (i + 0.5) * state.cellWidth;
        const y = config.headerHeight / 2;
        context.fillText(`診察台 ${i + 1}`, x, y);
    }

    // --- Draw Time Headers (e.g., "09:00") ---
    context.textAlign = 'right';
    for (let i = 0; i <= state.totalSlots; i++) {
        if (i % (60 / config.timeSlotInterval) === 0) { // Draw hour labels
            const y = config.headerHeight + i * state.cellHeight;
            const hour = config.startHour + Math.floor(i * config.timeSlotInterval / 60);
            
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(state.canvasWidth, y);
            context.strokeStyle = '#999'; // Bolder line for hour marks
            context.lineWidth = 1.5;
            context.stroke();

            context.fillText(`${String(hour).padStart(2, '0')}:00`, config.timeColumnWidth - 10, y);
        }
    }
};

const setupCanvas = () => {
  console.log('setupCanvas called');
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.value.parentElement;
  const rect = parent.getBoundingClientRect();

  state.canvasWidth = rect.width;
  // Canvasの高さは固定のセル高さとスロット数に基づいて計算
  state.totalSlots = ((config.endHour - config.startHour) * 60) / config.timeSlotInterval;
  state.cellHeight = config.cellHeightFixed; // 固定のセル高さを設定
  state.canvasHeight = config.headerHeight + state.totalSlots * state.cellHeight;

  canvas.value.width = state.canvasWidth * dpr;
  canvas.value.height = state.canvasHeight * dpr;
  
  ctx.value.scale(dpr, dpr);

  canvas.value.style.width = `${state.canvasWidth}px`;
  canvas.value.style.height = `${state.canvasHeight}px`;

  // Recalculate derived properties
  state.cellWidth = (state.canvasWidth - config.timeColumnWidth) / config.columns;
  
  draw();
};

const draw = () => {
  requestAnimationFrame(() => {
    if (!ctx.value) return;
    ctx.value.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    drawGrid();
    drawHeaders();
    drawReservations();
  });
};

// --- Event Handlers ---

const onMouseDown = (event) => {
  const coordinates = getCoordinatesFromMouseEvent(event);
  if (!coordinates) return;

  const existingReservation = reservations.find(res =>
    res.time_min === coordinates.time_min &&
    res.column_index === coordinates.column_index
  );

  if (existingReservation) {
    selectedReservation.value = { ...existingReservation };
  } else {
    selectedReservation.value = {
      date: currentDate.value,
      time_min: coordinates.time_min,
      column_index: coordinates.column_index,
      patient_name: ''
    };
  }

  isModalVisible.value = true;
};

const handleSaveReservation = (savedReservation) => {
  saveReservation(savedReservation);
  isModalVisible.value = false;
};

const handleDeleteReservation = (id) => {
  deleteReservation(id);
  isModalVisible.value = false;
};

// --- Lifecycle & Watchers ---
watch(() => props.date, (newDate) => {
  fetchDataForDate(newDate);
}, { immediate: true });


onMounted(() => {
  ctx.value = canvas.value.getContext('2d');
  setupCanvas();
  window.addEventListener('resize', setupCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', setupCanvas);
});

</script>

<style scoped>
.grid-container {
  width: 100%;
  height: 80vh; /* Example height */
  border: 1px solid black;
  overflow-y: auto; /* 縦スクロールを有効にする */
}
canvas {
  display: block;
}
</style>