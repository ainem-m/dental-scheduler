<template>
  <div class="grid-container">
    <canvas ref="canvas" @mousedown="onMouseDown"></canvas>
  </div>
  <ReservationModal
    :show="isModalVisible"
    :reservation="selectedReservation"
    @close="isModalVisible = false"
    @save="handleSaveReservation"
  />
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import ReservationModal from './ReservationModal.vue';

const canvas = ref(null);
const ctx = ref(null);

// --- State ---
const reservations = reactive([]);
const isModalVisible = ref(false);
const selectedReservation = ref({});
const currentDate = ref(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD

// --- Grid Configuration ---
const config = reactive({
  columns: 10,
  startHour: 9,
  endHour: 18,
  timeSlotInterval: 15, // in minutes
  headerHeight: 50,
  timeColumnWidth: 80,
  lineColor: '#ccc',
  lineWidth: 1,
});

// --- Derived Properties ---
const state = reactive({
  canvasWidth: 0,
  canvasHeight: 0,
  cellWidth: 0,
  cellHeight: 0,
  totalSlots: 0,
});

// --- API Functions ---
const fetchReservations = async () => {
  try {
    const response = await fetch(`/api/reservations?date=${currentDate.value}`);
    if (!response.ok) throw new Error('Failed to fetch reservations');
    const data = await response.json();
    reservations.splice(0, reservations.length, ...data); // Replace array content
    draw();
  } catch (error) {
    console.error(error);
  }
};

const saveReservation = async (reservation) => {
  try {
    const response = await fetch('/api/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation),
    });
    if (!response.ok) throw new Error('Failed to save reservation');
    const newReservation = await response.json();
    
    // Add to local state
    const index = reservations.findIndex(r => r.id === newReservation.id);
    if (index !== -1) {
        reservations[index] = newReservation;
    } else {
        reservations.push(newReservation);
    }
    
    draw();
  } catch (error) {
    console.error(error);
  }
};


// --- Drawing Functions ---

const drawGrid = () => {
  if (!ctx.value) return;
  const context = ctx.value;

  // Clear canvas
  context.clearRect(0, 0, state.canvasWidth, state.canvasHeight);

  // --- Draw Vertical Lines (Columns) ---
  for (let i = 0; i <= config.columns; i++) {
    const x = config.timeColumnWidth + i * state.cellWidth;
    context.beginPath();
    context.moveTo(x, config.headerHeight);
    context.lineTo(x, state.canvasHeight);
    context.strokeStyle = config.lineColor;
    context.lineWidth = config.lineWidth;
    context.stroke();
  }

  // --- Draw Horizontal Lines (Time Slots) ---
  for (let i = 0; i <= state.totalSlots; i++) {
    const y = config.headerHeight + i * state.cellHeight;
    context.beginPath();
    context.moveTo(config.timeColumnWidth, y);
    context.lineTo(state.canvasWidth, y);
    context.strokeStyle = config.lineColor;
    context.lineWidth = config.lineWidth;
    context.stroke();
  }
};

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

const drawReservations = () => {
  if (!ctx.value) return;
  const context = ctx.value;

  reservations.forEach(res => {
    const x = config.timeColumnWidth + res.column_index * state.cellWidth;
    const y = config.headerHeight + ((res.time_min - config.startHour * 60) / config.timeSlotInterval) * state.cellHeight;
    
    context.fillStyle = 'rgba(0, 123, 255, 0.8)';
    context.fillRect(x, y, state.cellWidth, state.cellHeight);

    if (res.handwriting) {
      const img = new Image();
      img.onload = () => {
        context.drawImage(img, x, y, state.cellWidth, state.cellHeight);
        // If patient name also exists, draw it on top of the image
        if (res.patient_name) {
          context.fillStyle = 'white'; // Or a contrasting color
          context.font = '12px Arial';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight / 2);
        }
      };
      img.src = `/api/handwriting/${res.handwriting}`;
    } else if (res.patient_name) {
      context.fillStyle = 'white';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight / 2);
    }
  });
};

const setupCanvas = () => {
  const dpr = window.devicePixelRatio || 1;
  const parent = canvas.value.parentElement;
  const rect = parent.getBoundingClientRect();

  state.canvasWidth = rect.width;
  state.canvasHeight = rect.height;

  canvas.value.width = state.canvasWidth * dpr;
  canvas.value.height = state.canvasHeight * dpr;
  
  ctx.value.scale(dpr, dpr);

  canvas.value.style.width = `${state.canvasWidth}px`;
  canvas.value.style.height = `${state.canvasHeight}px`;

  // Recalculate derived properties
  state.totalSlots = ((config.endHour - config.startHour) * 60) / config.timeSlotInterval;
  state.cellWidth = (state.canvasWidth - config.timeColumnWidth) / config.columns;
  state.cellHeight = (state.canvasHeight - config.headerHeight) / state.totalSlots;
  
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
  const rect = canvas.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;

  if (x < config.timeColumnWidth || y < config.headerHeight) return;

  const columnIndex = Math.floor((x - config.timeColumnWidth) / state.cellWidth);
  const timeSlotIndex = Math.floor((y - config.headerHeight) / state.cellHeight);

  const timeMin = config.startHour * 60 + timeSlotIndex * config.timeSlotInterval;

  selectedReservation.value = {
    date: currentDate.value,
    time_min: timeMin,
    column_index: columnIndex,
    patient_name: ''
  };

  isModalVisible.value = true;
};

const handleSaveReservation = (savedReservation) => {
  saveReservation(savedReservation);
  isModalVisible.value = false;
};

// --- Lifecycle ---
onMounted(() => {
  ctx.value = canvas.value.getContext('2d');
  setupCanvas();
  fetchReservations();
  window.addEventListener('resize', setupCanvas);
});

</script>

<style scoped>
.grid-container {
  width: 100%;
  height: 80vh; /* Example height */
  border: 1px solid black;
}
canvas {
  display: block;
}
</style>