import { ref, watch } from 'vue';

export function useGridDrawer(canvasRef, reservations, config, state) {
  const ctx = ref(null);

  function getContext() {
    return ctx.value;
  }

  function drawGrid() {
    if (!ctx.value) return;
    const context = ctx.value;
    const canvas = canvasRef.value;

    context.clearRect(0, 0, state.canvasWidth, state.canvasHeight);
    context.strokeStyle = config.lineColor;
    context.lineWidth = config.lineWidth;
    context.font = '14px Arial';
    context.fillStyle = '#333';

    // Draw Vertical Lines (Columns)
    for (let i = 0; i <= config.columns; i++) {
      const x = config.timeColumnWidth + i * state.cellWidth;
      context.beginPath();
      context.moveTo(x, config.headerHeight);
      context.lineTo(x, state.canvasHeight);
      context.stroke();
    }

    // Draw Horizontal Lines (Time Slots)
    for (let i = 0; i <= state.totalSlots; i++) {
      const y = config.headerHeight + i * state.cellHeight;
      context.beginPath();
      context.moveTo(config.timeColumnWidth, y);
      context.lineTo(state.canvasWidth, y);
      context.stroke();
    }
    
    // 描画スタイルを再度手書き用に設定
    context.strokeStyle = '#000';
    context.lineWidth = 2;

    drawReservations();
  }

  // 予約を描画する
  const drawReservations = async () => {
    const context = ctx.value;
    if (!context) return;

    context.font = '12px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    const imagePromises = reservations.value.map(res => {
      const x = config.timeColumnWidth + res.column_index * state.cellWidth;
      const y = config.headerHeight + ((res.time_min - config.startHour * 60) / config.timeSlotInterval) * state.cellHeight;

      if (res.handwriting) {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            context.fillStyle = 'rgba(0, 123, 255, 0.8)';
            context.fillRect(x, y, state.cellWidth, state.cellHeight);
            context.drawImage(img, x, y, state.cellWidth, state.cellHeight);

            if (res.patient_name) {
              context.fillStyle = 'white';
              context.font = '12px Arial';
              context.textAlign = 'center';
              context.textBaseline = 'middle';
              context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight / 2);
            }
            resolve();
          };
          img.onerror = () => {
            console.error(`画像の読み込みに失敗: ${res.handwriting}`);
            resolve(); // エラー時もPromiseを解決
          };
          img.src = `/api/handwriting/${res.handwriting}`;
        });
      } else if (res.patient_name) {
        context.fillStyle = 'rgba(0, 123, 255, 0.8)';
        context.fillRect(x, y, state.cellWidth, state.cellHeight);
        context.fillStyle = 'white';
        context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight / 2);
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    await Promise.all(imagePromises);
  }
  
  function getCoordinatesFromMouseEvent(event) {
    const canvas = canvasRef.value;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < config.timeColumnWidth || y < config.headerHeight) {
      return null;
    }

    const columnIndex = Math.floor((x - config.timeColumnWidth) / state.cellWidth);
    const timeSlotIndex = Math.floor((y - config.headerHeight) / state.cellHeight);
    const timeInMinutes = config.startHour * 60 + timeSlotIndex * config.timeSlotInterval;
    
    if (columnIndex >= 0 && columnIndex < config.columns) {
      return {
        column_index: columnIndex,
        time_min: timeInMinutes,
      };
    }
    return null;
  }
  
  watch(reservations, drawGrid, { deep: true });

  return {
    drawGrid,
    drawReservations,
    getCoordinatesFromMouseEvent,
    getContext, // エクスポートする
  };
}
