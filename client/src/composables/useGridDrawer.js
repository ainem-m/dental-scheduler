import { ref, watch } from 'vue';

export function useGridDrawer(canvasRef, reservations) {
  const ctx = ref(null);

  // --- 定数 ---
  const COLUMNS = 10;
  const START_HOUR = 9;
  const END_HOUR = 18;
  const ROW_HEIGHT = 20;
  const HEADER_HEIGHT = 30;
  const COLUMN_WIDTH = 100;
  const TIME_MARKER_WIDTH = 60;

  function getContext() {
    return ctx.value;
  }

  function initializeCanvas() {
    const canvas = canvasRef.value;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    ctx.value = context;
    
    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const totalRows = totalMinutes / 5;

    canvas.width = TIME_MARKER_WIDTH + COLUMNS * COLUMN_WIDTH;
    canvas.height = HEADER_HEIGHT + totalRows * ROW_HEIGHT;

    // 描画スタイルの設定
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2;
    context.strokeStyle = '#000'; // 手書き線の色
  }

  function drawGrid() {
    if (!ctx.value) return;
    const context = ctx.value;
    const canvas = canvasRef.value;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#e0e0e0'; // グリッド線の色
    context.lineWidth = 1; // グリッド線の太さ
    context.font = '12px sans-serif';
    context.fillStyle = '#333';

    const totalMinutes = (END_HOUR - START_HOUR) * 60;
    const totalRows = totalMinutes / 5;

    // 列ヘッダーと垂直線
    for (let i = 0; i <= COLUMNS; i++) {
      const x = TIME_MARKER_WIDTH + i * COLUMN_WIDTH;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
      if (i < COLUMNS) {
        context.fillText(`列 ${i + 1}`, x + 10, HEADER_HEIGHT - 10);
      }
    }

    // 時間マーカーと水平線
    for (let i = 0; i <= totalRows; i++) {
      const y = HEADER_HEIGHT + i * ROW_HEIGHT;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
      if (i % 3 === 0) {
        const minutes = i * 5;
        const hour = START_HOUR + Math.floor(minutes / 60);
        const minute = minutes % 60;
        const timeString = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        context.fillText(timeString, 5, y - 5);
      }
    }
    
    // 描画スタイルを再度手書き用に設定
    context.strokeStyle = '#000';
    context.lineWidth = 2;

    drawReservations();
  }

  // 予約を描画する
  function drawReservations() {
    const context = ctx.value;
    if (!context) return;

    context.font = '14px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    reservations.value.forEach(res => {
      const cellX = TIME_MARKER_WIDTH + res.column_index * COLUMN_WIDTH;
      const cellY = HEADER_HEIGHT + ((res.time_min - START_HOUR * 60) / 5) * ROW_HEIGHT;
      
      if (res.patient_name) {
        context.fillStyle = '#2563eb'; // 青色
        const textX = cellX + COLUMN_WIDTH / 2;
        const textY = cellY + ROW_HEIGHT / 2;
        context.fillText(res.patient_name, textX, textY);
      } else if (res.handwriting) {
        const img = new Image();
        img.onload = () => {
          // 画像をセルのサイズに合わせて描画
          context.drawImage(img, cellX, cellY, COLUMN_WIDTH, ROW_HEIGHT);
        };
        img.onerror = () => {
          console.error(`画像の読み込みに失敗: ${res.handwriting}`);
        };
        img.src = `/png/${res.handwriting}`;
      }
    });
  }
  
  function getCoordinatesFromMouseEvent(event) {
    const canvas = canvasRef.value;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < TIME_MARKER_WIDTH || y < HEADER_HEIGHT) {
      return null;
    }

    const columnIndex = Math.floor((x - TIME_MARKER_WIDTH) / COLUMN_WIDTH);
    const timeInMinutes = START_HOUR * 60 + Math.floor((y - HEADER_HEIGHT) / ROW_HEIGHT) * 5;
    
    if (columnIndex >= 0 && columnIndex < COLUMNS) {
      return {
        column_index: columnIndex,
        time_min: timeInMinutes,
      };
    }
    return null;
  }
  
  watch(reservations, drawGrid, { deep: true });

  return {
    initializeCanvas,
    drawGrid,
    getCoordinatesFromMouseEvent,
    getContext, // エクスポートする
  };
}
