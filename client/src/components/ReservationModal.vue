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
          <button
            v-if="editableReservation.id"
            type="button"
            class="delete-button"
            @click="handleDelete"
          >削除</button>
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

const emit = defineEmits(['close', 'save', 'delete']);

const editableReservation = ref({
  patient_name: '',
  handwriting: null,
  date: null,
  time_min: null,
  column_index: null
});
const patientNameInput = ref(null);
const handwritingCanvas = ref(null);
const ctx = ref(null);
const isDrawing = ref(false);

// Initialize canvas on mount
onMounted(() => {
  if (handwritingCanvas.value) {
    ctx.value = handwritingCanvas.value.getContext('2d');
    setupCanvasContextAndDimensions();
  }
});

watch(() => props.show, (newVal) => {
  if (newVal) {
    // Safely merge reservation data with defaults
    editableReservation.value = {
      patient_name: '',
      handwriting: null,
      date: null,
      time_min: null,
      column_index: null,
      ...props.reservation
    };
    
    nextTick(() => {
      try {
        patientNameInput.value?.focus();
        setupCanvasContextAndDimensions(); // Ensure canvas is set up when modal opens
        
        // If there's existing handwriting, load it onto the canvas
        if (editableReservation.value.handwriting && ctx.value) {
          const img = new Image();
          img.onload = () => {
            if (ctx.value && handwritingCanvas.value) {
              ctx.value.clearRect(0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height);
              // 元の画像のサイズで描画するために、幅と高さを指定しない
              ctx.value.drawImage(img, 0, 0);
            }
          };
          img.onerror = () => {
            console.error('Failed to load handwriting image');
          };
          img.src = `/api/handwriting/${editableReservation.value.handwriting}`;
        } else {
          clearCanvas(); // Clear canvas if no existing handwriting
        }
      } catch (error) {
        console.error('Error during modal setup:', error);
      }
    });
  } else {
    // Reset canvas when modal closes
    clearCanvas();
  }
});

const setupCanvasContextAndDimensions = () => {
  if (!handwritingCanvas.value) return; // キャンバス要素がない場合は処理しない

  // ctx.value が null の場合、またはキャンバスが変更された場合に再取得
  if (!ctx.value || ctx.value.canvas !== handwritingCanvas.value) {
    ctx.value = handwritingCanvas.value.getContext('2d');
    if (!ctx.value) {
      console.error('Failed to get 2D context for canvas.');
      return;
    }
  }

  const canvas = handwritingCanvas.value;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  // Reset transformation matrix to prevent cumulative scaling
  ctx.value.setTransform(1, 0, 0, 1, 0, 0);

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.value.scale(dpr, dpr);

  // Log canvas dimensions and DPR for debugging
  console.log('Canvas setup:', {
    dpr,
    rectWidth: rect.width,
    rectHeight: rect.height,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
  });

  // Re-apply drawing styles after setting dimensions
  ctx.value.lineWidth = 2;
  ctx.value.lineCap = 'round';
  ctx.value.strokeStyle = 'black';
  ctx.value.fillStyle = 'white';
};

const getEventPos = (event) => {
  const rect = handwritingCanvas.value.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;
  return {
    x: (clientX - rect.left),
    y: (clientY - rect.top),
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
  if (ctx.value) {
    ctx.value.closePath();
  }
};

const clearCanvas = () => {
  if (ctx.value && handwritingCanvas.value) {
    ctx.value.clearRect(0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height);
    ctx.value.fillStyle = 'white';
    ctx.value.fillRect(0, 0, handwritingCanvas.value.width, handwritingCanvas.value.height); // Reset white background

    // Re-apply drawing styles after clearing
    ctx.value.lineWidth = 2;
    ctx.value.lineCap = 'round';
    ctx.value.strokeStyle = 'black';
    ctx.value.fillStyle = 'white';
    console.log('Canvas cleared and styles reapplied.');
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

const handleDelete = () => {
  if (confirm('この予約を削除してもよろしいですか？')) {
    emit('delete', editableReservation.value.id);
    close();
  }
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

button[type="button"].delete-button {
  background-color: #dc3545;
  color: white;
}
</style>
