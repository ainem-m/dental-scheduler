import { ref, watch, type Ref } from 'vue';

export interface GridConfig {
  columns: number;
  startHour: number;
  endHour: number;
  timeSlotInterval: number;
  headerHeight: number;
  timeColumnWidth: number;
  lineColor: string;
  lineWidth: number;
  cellHeightFixed: number;
}

export interface GridState {
  canvasWidth: number;
  canvasHeight: number;
  cellWidth: number;
  cellHeight: number;
  totalSlots: number;
}

export interface Reservation {
  id?: number;
  date: string;
  time_min: number;
  column_index: number;
  patient_name?: string;
  handwriting?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Coordinates {
  column_index: number;
  time_min: number;
}

export interface GridDrawerComposable {
  drawGrid: () => void;
  drawHeaders: () => void;
  drawReservations: () => Promise<void>;
  getCoordinatesFromMouseEvent: (event: MouseEvent) => Coordinates | null;
  getContext: () => CanvasRenderingContext2D | null;
}

export function useGridDrawer(
  canvasRef: Ref<HTMLCanvasElement | null>,
  reservations: Reservation[],
  config: GridConfig,
  state: GridState,
  ctx: Ref<CanvasRenderingContext2D | null>
): GridDrawerComposable {
  function getContext(): CanvasRenderingContext2D | null {
    return ctx.value;
  }

  function drawGrid(): void {
    if (!ctx.value) {
      return;
    }
    const context = ctx.value;
    
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
    
    // Reset drawing style
    context.strokeStyle = '#000';
    context.lineWidth = 2;
  }

  const drawHeaders = (): void => {
    if (!ctx.value) return;
    const context = ctx.value;
    context.font = '14px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#333';

    // Draw Column Headers (e.g., "診察台 1")
    for (let i = 0; i < config.columns; i++) {
        const x = config.timeColumnWidth + (i + 0.5) * state.cellWidth;
        const y = config.headerHeight / 2;
        context.fillText(`診察台 ${i + 1}`, x, y);
    }

    // Draw Time Headers (e.g., "09:00")
    context.textAlign = 'right';
    for (let i = 0; i <= state.totalSlots; i++) {
        if (i % (60 / config.timeSlotInterval) === 0) { // Draw hour labels
            const y = config.headerHeight + i * state.cellHeight;
            const hour = config.startHour + Math.floor(i * config.timeSlotInterval / 60);
            
            context.beginPath();
            context.moveTo(0, y);
            context.lineTo(state.canvasWidth, y);
            context.strokeStyle = '#999';
            context.lineWidth = 1.5;
            context.stroke();

            context.fillText(`${String(hour).padStart(2, '0')}:00`, config.timeColumnWidth - 10, y);
        }
    }
  };

  const drawReservations = async (): Promise<void> => {
    const context = ctx.value;
    if (!context) {
      return;
    }

    // Cache for loaded images to avoid repeated loading
    const imageCache = new Map<string, HTMLImageElement>();

    const imagePromises = reservations.map(res => {
      return new Promise<void>(async (resolve) => {
        const x = config.timeColumnWidth + res.column_index * state.cellWidth;
        const y = config.headerHeight + ((res.time_min - config.startHour * 60) / config.timeSlotInterval) * state.cellHeight;

        // Draw background
        context.fillStyle = 'rgba(0, 123, 255, 0.8)';
        context.fillRect(x, y, state.cellWidth, state.cellHeight);

        // Draw handwriting if it exists (top half of the cell)
        if (res.handwriting) {
          try {
            let img = imageCache.get(res.handwriting);
            if (!img) {
              img = new Image();
              await new Promise<void>((imgResolve, imgReject) => {
                img!.onload = () => {
                  imageCache.set(res.handwriting!, img!);
                  imgResolve();
                };
                img!.onerror = () => imgReject();
                img!.src = `/api/handwriting/${res.handwriting}`;
              });
            }
            context.drawImage(img, x, y, state.cellWidth, state.cellHeight / 2);
          } catch (error) {
            // Continue even if image fails to load
          }
        }

        // Draw patient name on top (bottom half of the cell)
        if (res.patient_name) {
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.font = 'bold 10px Arial';
          context.strokeStyle = 'black';
          context.lineWidth = 2;
          context.strokeText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight * 3 / 4);
          context.fillStyle = 'white';
          context.fillText(res.patient_name, x + state.cellWidth / 2, y + state.cellHeight * 3 / 4);
        }
        
        resolve();
      });
    });

    await Promise.all(imagePromises);
  };
  
  function getCoordinatesFromMouseEvent(event: MouseEvent): Coordinates | null {
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
    getContext,
  };
}