<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal-content">
      <h3>予約情報入力</h3>
      <form @submit.prevent="save">
        <div class="form-group">
          <label for="patient-name">患者名</label>
          <input
            id="patient-name"
            v-model="editableReservation.patient_name"
            type="text"
            ref="patientNameInput"
          />
        </div>

        <div class="form-group">
          <label>手書き入力</label>
          <canvas
            ref="handwritingCanvas"
            class="handwriting-canvas"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart="startDrawing"
            @touchmove="draw"
            @touchend="stopDrawing"
            @touchcancel="stopDrawing"
          ></canvas>
          <div class="canvas-actions">
            <button type="button" @click="clearCanvas">クリア</button>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" @click="close">キャンセル</button>
          <button type="submit">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue';

const props = defineProps({
  show: Boolean,
  reservation: Object,
});

const emit = defineEmits(['close', 'save']);

const editableReservation = ref({});
const patientNameInput = ref(null);
const handwritingCanvas = ref(null);
const ctx = ref(null);
const isDrawing = ref(false);

// Initialize canvas on mount
onMounted(() => {
  if (handwritingCanvas.value) {
    ctx.value = handwritingCanvas.value.getContext('2d');
    setupCanvas();
  }
});

watch(() => props.show, (newVal) => {
  if (newVal) {
    editableReservation.value = { ...props.reservation };
    nextTick(() => {
      patientNameInput.value?.focus();
      setupCanvas(); // Ensure canvas is set up when modal opens
      // If there's existing handwriting, load it onto the canvas
      if (editableReservation.value.handwriting) {
        const img = new Image();
        img.onload = () => {
          ctx.value.clearRect(0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height);
          ctx.value.drawImage(img, 0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height);
        };
        img.src = `/api/handwriting/${editableReservation.value.handwriting}`;
      } else {
        clearCanvas(); // Clear canvas if no existing handwriting
      }
    });
  } else {
    // Reset canvas when modal closes
    clearCanvas();
  }
});

const setupCanvas = () => {
  if (!handwritingCanvas.value) return;
  const canvas = handwritingCanvas.value;

  // Initialize ctx.value if it's not already set
  if (!ctx.value) {
    ctx.value = handwritingCanvas.value.getContext('2d');
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.value.scale(dpr, dpr);

  ctx.value.lineWidth = 2;
  ctx.value.lineCap = 'round';
  ctx.value.strokeStyle = 'black';
  ctx.value.fillStyle = 'white';
  ctx.value.fillRect(0, 0, canvas.width, canvas.height); // Set white background
};

const getEventPos = (event) => {
  const rect = handwritingCanvas.value.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: (clientX - rect.left) / (window.devicePixelRatio || 1),
    y: (clientY - rect.top) / (window.devicePixelRatio || 1),
  };
};

const startDrawing = (event) => {
  isDrawing.value = true;
  const pos = getEventPos(event);
  ctx.value.beginPath();
  ctx.value.moveTo(pos.x, pos.y);
  event.preventDefault(); // Prevent scrolling on touch devices
};

const draw = (event) => {
  if (!isDrawing.value) return;
  const pos = getEventPos(event);
  ctx.value.lineTo(pos.x, pos.y);
  ctx.value.stroke();
  event.preventDefault(); // Prevent scrolling on touch devices
};

const stopDrawing = () => {
  isDrawing.value = false;
  ctx.value.closePath();
};

const clearCanvas = () => {
  if (ctx.value && handwritingCanvas.value) {
    ctx.value.clearRect(0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height);
    ctx.value.fillStyle = 'white';
    ctx.value.fillRect(0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height); // Reset white background
  }
};

const save = async () => {
  // Always attempt to upload handwriting if drawn
  if (handwritingCanvas.value.toDataURL('image/png') !== getBlankCanvasDataURL()) {
    const blob = await new Promise(resolve => handwritingCanvas.value.toBlob(resolve, 'image/png'));
    const formData = new FormData();
    formData.append('handwriting', blob, 'handwriting.png');

    try {
      const response = await fetch('/api/handwriting', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to upload handwriting');
      const data = await response.json();
      editableReservation.value.handwriting = data.filename; // Store the filename returned by the server
    } catch (error) {
      console.error('Handwriting upload error:', error);
      alert('手書き画像のアップロードに失敗しました。');
      return; // Prevent saving reservation if upload fails
    }
  } else {
    // If canvas is blank and there was no existing handwriting, clear it
    if (!props.reservation?.handwriting) {
      editableReservation.value.handwriting = null;
    }
  }

  emit('save', editableReservation.value);
  close();
};

const getBlankCanvasDataURL = () => {
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = handwritingCanvas.value.width;
  tempCanvas.height = handwritingCanvas.value.height;
  tempCtx.fillStyle = 'white';
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
  return tempCanvas.toDataURL('image/png');
};

const close = () => {
  emit('close');
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  width: 400px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
}

.form-group input[type="text"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.input-method-toggle {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.input-method-toggle label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.handwriting-canvas {
  border: 1px solid #ccc;
  background-color: white;
  width: 100%;
  height: 150px; /* Adjust as needed */
  cursor: crosshair;
}

.canvas-actions {
  margin-top: 0.5rem;
  text-align: right;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 2rem;
}

button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button[type="submit"] {
  background-color: #007bff;
  color: white;
}

button[type="button"] {
  background-color: #f0f0f0;
}
</style>
