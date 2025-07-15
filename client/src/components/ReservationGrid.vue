<template>
  <canvas ref="reservationCanvas" class="reservation-canvas"></canvas>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const reservationCanvas = ref(null);

onMounted(() => {
  const canvas = reservationCanvas.value;
  const ctx = canvas.getContext('2d');

  // Canvas のサイズを設定
  canvas.width = 800;
  canvas.height = 600;

  // 例として四角を描画
  ctx.fillStyle = 'blue';
  ctx.fillRect(50, 50, 100, 100);
});
</script>

<style scoped>
.reservation-canvas {
  border: 1px solid black;
}
</style>