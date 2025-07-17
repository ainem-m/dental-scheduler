<template>
  <div class="grid-container">
    <div v-if="isPlacingNewReservation" class="selection-mode-overlay">
      <p>予約枠を選択してください</p>
      <button @click="cancelNewReservationPlacement">キャンセル</button>
    </div>
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
  newReservationToPlace: {
    type: Object,
    default: null,
  },
  isPlacingNewReservation: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['newReservationPlaced', 'fetch-reservations', 'save-reservation']);

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
const { drawGrid, drawHeaders, drawReservations, getCoordinatesFromMouseEvent } = useGridDrawer(canvas, reservations, config, state, ctx);
const { on, off, socketEmit, joinDateRoom } = useSocket();

// --- Data Fetching ---
const fetchDataForDate = (date) => {
  currentDate.value = date;
  joinDateRoom(date);
  socketEmit('fetch-reservations', date);
};

// --- Socket.IO Functions ---
const saveReservation = (reservation) => {
  socketEmit('save-reservation', reservation);
};

const deleteReservation = (id) => {
  socketEmit('delete-reservation', id);
};

// --- Socket.IO Event Handlers ---
const setupSocketListeners = () => {
  on('reservations-updated', (updatedReservations) => {
    const filteredReservations = updatedReservations.filter(r => r.date === currentDate.value);
    reservations.splice(0, reservations.length, ...filteredReservations);
    draw();
  });
};


// --- Drawing Functions ---


const setupCanvas = () => {
  if (!canvas.value || !ctx.value) {
    return;
  }
  
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.value.parentElement;
  const rect = parent.getBoundingClientRect();

  state.canvasWidth = rect.width;
  state.totalSlots = ((config.endHour - config.startHour) * 60) / config.timeSlotInterval;
  state.cellHeight = config.cellHeightFixed;
  state.canvasHeight = config.headerHeight + state.totalSlots * state.cellHeight;

  canvas.value.width = state.canvasWidth * dpr;
  canvas.value.height = state.canvasHeight * dpr;
  
  ctx.value.scale(dpr, dpr);

  canvas.value.style.width = `${state.canvasWidth}px`;
  canvas.value.style.height = `${state.canvasHeight}px`;

  state.cellWidth = (state.canvasWidth - config.timeColumnWidth) / config.columns;
  
  draw();
};

const draw = () => {
  requestAnimationFrame(() => {
    if (!ctx.value) {
      return;
    }
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

  if (props.isPlacingNewReservation) {
    // Selection mode: place the new reservation if the slot is empty
    if (existingReservation) {
      return;
    } else {
      // Slot is empty, place the new reservation
      const reservationToSave = {
        ...props.newReservationToPlace,
        date: currentDate.value, // Ensure the date is current
        time_min: coordinates.time_min,
        column_index: coordinates.column_index,
      };
      saveReservation(reservationToSave);
      emit('newReservationPlaced'); // Signal App.vue to exit selection mode
    }
  } else {
    // Normal mode: open modal for existing or new reservation
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
  }
};

const handleSaveReservation = (savedReservation) => {
  saveReservation(savedReservation);
  isModalVisible.value = false;
};

const handleDeleteReservation = (id) => {
  deleteReservation(id);
  isModalVisible.value = false;
};

const cancelNewReservationPlacement = () => {
  emit('newReservationPlaced'); // Signal App.vue to exit selection mode and clear data
};

// --- Lifecycle & Watchers ---
watch(() => props.date, (newDate) => {
  fetchDataForDate(newDate);
}, { immediate: true });


onMounted(() => {
  if (canvas.value) {
    ctx.value = canvas.value.getContext('2d');
  }
  
  setupSocketListeners();
  fetchDataForDate(props.date);
  
  setupCanvas();
  window.addEventListener('resize', setupCanvas);
});

onUnmounted(() => {
  window.removeEventListener('resize', setupCanvas);
  off('reservations-updated');
});

</script>

<style scoped>
.grid-container {
  width: 100%;
  height: 80vh; /* Example height */
  border: 1px solid black;
  overflow-y: auto; /* 縦スクロールを有効にする */
  position: relative; /* For positioning the overlay */
}
canvas {
  display: block;
}

.selection-mode-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(255, 255, 255, 0.8); /* Semi-transparent white */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10; /* Above the canvas */
  font-size: 1.5rem;
  color: #333;
  text-align: center;
}

.selection-mode-overlay button {
  margin-top: 1rem;
  padding: 0.8rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
}

.selection-mode-overlay button:hover {
  background-color: #0056b3;
}
</style>