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
    console.log('Grid config:', config);
    console.log('Grid state:', state);
    
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

  // ヘッダーを描画する
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

        // 2. Draw handwriting if it exists (top half of the cell)
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
            context.drawImage(img, x, y, state.cellWidth, state.cellHeight / 2); // Draw in top half
          } catch (error) {
            // Continue even if image fails to load
          }
        }

        // 3. Draw patient name on top (bottom half of the cell)
        if (res.patient_name) {
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.font = 'bold 10px Arial'; // Smaller font for patient name
          context.strokeStyle = 'black'; // Black stroke for contrast
          context.lineWidth = 2;
          context.strokeText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight * 3 / 4); // Draw in bottom half
          context.fillStyle = 'white'; // White fill
          context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight * 3 / 4); // Draw in bottom half
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
    drawHeaders,
    drawReservations,
    getCoordinatesFromMouseEvent,
    getContext, // エクスポートする
  };
}
