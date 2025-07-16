import { ref, watch } from 'vue';

export function useGridDrawer(canvasRef, reservations, config, state, ctx) {
  function getContext() {
    return ctx.value;
  }

  function drawGrid() {
    console.log('drawGrid called');
    if (!ctx.value) {
      console.log('ctx is null in drawGrid');
      return;
    }
    const context = ctx.value;
    const canvas = canvasRef.value;

    console.log('Drawing grid with context:', context);
    
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
  }

  // 予約を描画する
  const drawReservations = async () => {
    console.log('drawReservations called with:', reservations);
    const context = ctx.value;
    if (!context) {
      console.log('context is null in drawReservations');
      return;
    }

    const imagePromises = reservations.map(res => {
      return new Promise(async (resolve) => {
        const x = config.timeColumnWidth + res.column_index * state.cellWidth;
        const y = config.headerHeight + ((res.time_min - config.startHour * 60) / config.timeSlotInterval) * state.cellHeight;

        // 1. Draw background
        context.fillStyle = 'rgba(0, 123, 255, 0.8)';
        context.fillRect(x, y, state.cellWidth, state.cellHeight);

        // 2. Draw handwriting if it exists
        if (res.handwriting) {
          try {
            const img = new Image();
            await new Promise((imgResolve, imgReject) => {
              img.onload = imgResolve;
              img.onerror = () => {
                console.error(`画像の読み込みに失敗: ${res.handwriting}`);
                imgReject(); // Reject on error
              };
              img.src = `/api/handwriting/${res.handwriting}`;
            });
            context.drawImage(img, x, y, state.cellWidth, state.cellHeight);
          } catch (error) {
            // Continue even if image fails to load
          }
        }

        // 3. Draw patient name on top
        if (res.patient_name) {
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.font = 'bold 14px Arial';
          context.strokeStyle = 'black'; // Black stroke for contrast
          context.lineWidth = 3;
          context.strokeText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight / 2);
          context.fillStyle = 'white'; // White fill
          context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight / 2);
        }
        
        resolve();
      });
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
