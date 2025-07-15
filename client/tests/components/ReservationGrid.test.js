import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ReservationGrid from '../../src/components/ReservationGrid.vue';
import { useGridDrawer } from '../../src/composables/useGridDrawer';
import { useSocket } from '../../src/composables/useSocket';

// Mock composables
vi.mock('../../src/composables/useGridDrawer');
vi.mock('../../src/composables/useSocket');

// Mock prompt
global.prompt = vi.fn();

describe('ReservationGrid.vue', () => {
  let mockInitializeCanvas;
  let mockDrawGrid;
  let mockGetCoordinatesFromMouseEvent;
  let mockSocketOn;
  let mockSocketOff;
  let mockSocketEmit;
  let mockIsConnected;

  beforeEach(() => {
    // Reset mocks for useGridDrawer
    mockInitializeCanvas = vi.fn();
    mockDrawGrid = vi.fn();
    mockGetCoordinatesFromMouseEvent = vi.fn();
    useGridDrawer.mockReturnValue({
      initializeCanvas: mockInitializeCanvas,
      drawGrid: mockDrawGrid,
      getCoordinatesFromMouseEvent: mockGetCoordinatesFromMouseEvent,
    });

    // Reset mocks for useSocket
    mockSocketOn = vi.fn();
    mockSocketOff = vi.fn();
    mockSocketEmit = vi.fn();
    mockIsConnected = { value: true }; // Mock reactive ref
    useSocket.mockReturnValue({
      isConnected: mockIsConnected,
      on: mockSocketOn,
      off: mockSocketOff,
      emit: mockSocketEmit,
    });

    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      clearRect: vi.fn(),
    }));
    
    // Reset prompt mock
    global.prompt.mockClear();
  });

  it('renders canvas and connection status', () => {
    const wrapper = mount(ReservationGrid);
    expect(wrapper.find('canvas').exists()).toBe(true);
    expect(wrapper.find('.status').text()).toContain('接続済み');
  });

  it('initializes canvas, grid, and socket listeners on mount', () => {
    mount(ReservationGrid);
    expect(mockInitializeCanvas).toHaveBeenCalled();
    expect(mockDrawGrid).toHaveBeenCalled();
    expect(mockSocketOn).toHaveBeenCalledWith('new-reservation', expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith('initial-reservations', expect.any(Function));
    expect(mockSocketEmit).toHaveBeenCalledWith('get-initial-reservations');
  });

  it('removes socket listeners on unmount', () => {
    const wrapper = mount(ReservationGrid);
    wrapper.unmount();
    expect(mockSocketOff).toHaveBeenCalledWith('new-reservation', expect.any(Function));
    expect(mockSocketOff).toHaveBeenCalledWith('initial-reservations', expect.any(Function));
  });

  it('handles canvas click and emits create-reservation event', async () => {
    const wrapper = mount(ReservationGrid);
    const canvas = wrapper.find('canvas');

    const mockCoords = { time_min: 540, column_index: 2 };
    mockGetCoordinatesFromMouseEvent.mockReturnValue(mockCoords);
    global.prompt.mockReturnValue('Test Patient');

    await canvas.trigger('click');

    expect(mockGetCoordinatesFromMouseEvent).toHaveBeenCalled();
    expect(global.prompt).toHaveBeenCalledWith('患者名を入力してください:');
    expect(mockSocketEmit).toHaveBeenCalledWith('create-reservation', {
      date: new Date().toISOString().split('T')[0],
      time_min: mockCoords.time_min,
      column_index: mockCoords.column_index,
      patient_name: 'Test Patient',
      handwriting: null,
    });
  });

  it('does not emit event if prompt is cancelled', async () => {
    const wrapper = mount(ReservationGrid);
    const canvas = wrapper.find('canvas');

    mockGetCoordinatesFromMouseEvent.mockReturnValue({ time_min: 540, column_index: 2 });
    global.prompt.mockReturnValue(null);

    await canvas.trigger('click');

    expect(mockGetCoordinatesFromMouseEvent).toHaveBeenCalled();
    expect(global.prompt).toHaveBeenCalled();
    // Ensure emit was not called for 'create-reservation'
    const createReservationCall = mockSocketEmit.mock.calls.find(call => call[0] === 'create-reservation');
    expect(createReservationCall).toBeUndefined();
  });
});
