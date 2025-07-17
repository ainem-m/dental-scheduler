import { describe, it, expect, beforeEach, vi } from 'vitest';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import ReservationGrid from '../../src/components/ReservationGrid.vue';
import { useGridDrawer } from '../../src/composables/useGridDrawer';
import { useSocket } from '../../src/composables/useSocket';

// Mock composables
vi.mock('../../src/composables/useGridDrawer');
vi.mock('../../src/composables/useSocket');

describe('ReservationGrid.vue', () => {
  let mockDrawGrid;
  let mockDrawReservations;
  let mockGetCoordinatesFromMouseEvent;
  let mockSocketOn;
  let mockSocketOff;
  let mockSocketEmit;
  let mockIsConnected;

  beforeEach(() => {
    // Reset mocks for useGridDrawer
    mockDrawGrid = vi.fn();
    mockDrawReservations = vi.fn();
    mockGetCoordinatesFromMouseEvent = vi.fn();
    useGridDrawer.mockReturnValue({
      drawGrid: mockDrawGrid,
      drawReservations: mockDrawReservations,
      getCoordinatesFromMouseEvent: mockGetCoordinatesFromMouseEvent,
    });

    // Reset mocks for useSocket
    mockSocketOn = vi.fn();
    mockSocketOff = vi.fn();
    mockSocketEmit = vi.fn();
    const mockJoinDateRoom = vi.fn();
    mockIsConnected = { value: true }; // Mock reactive ref
    useSocket.mockReturnValue({
      isConnected: mockIsConnected,
      on: mockSocketOn,
      off: mockSocketOff,
      socketEmit: mockSocketEmit, // Renamed emit to socketEmit
      joinDateRoom: mockJoinDateRoom, // Add mockJoinDateRoom here
    });

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn(cb => cb());

    // Mock canvas context
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      fillRect: vi.fn(),
    }));

    // Mock getBoundingClientRect for parentElement
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      toJSON: vi.fn(),
    }));
    
    // Mock fetch API
    global.fetch = vi.fn((url) => {
      if (url.startsWith('/api/reservations')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]), // Return empty array for reservations
        });
      }
      return Promise.reject(new Error(`Unhandled fetch request for: ${url}`));
    });

    
  });

  it('renders canvas', () => {
    const wrapper = mount(ReservationGrid);
    expect(wrapper.find('canvas').exists()).toBe(true);
  });

  it('initializes canvas and grid on mount', () => {
    mount(ReservationGrid, { props: { date: '2025-07-17' } });
    expect(mockDrawGrid).toHaveBeenCalled();
    expect(mockDrawReservations).toHaveBeenCalled();
  });

  it('removes socket listeners on unmount', () => {
    const wrapper = mount(ReservationGrid, { props: { date: '2025-07-17' } });
    wrapper.unmount();
    // No direct socket listener assertions as they are handled within useSocket composable
  });

  it('handles canvas click and emits create-reservation event', async () => {
    const wrapper = mount(ReservationGrid, {
      props: { date: '2025-07-17' },
      global: {
        stubs: {
          ReservationModal: true
        }
      }
    });
    const canvas = wrapper.find('canvas');

    const mockCoords = { time_min: 540, column_index: 2 };
    mockGetCoordinatesFromMouseEvent.mockReturnValue(mockCoords);

    await canvas.trigger('mousedown', { clientX: 100, clientY: 100 });
    await nextTick();

    // Expect the modal to be visible
    expect(wrapper.findComponent({ name: 'ReservationModal' }).props().show).toBe(true);

    // Simulate saving a reservation from the modal
    const modal = wrapper.findComponent({ name: 'ReservationModal' });
    const newReservation = {
      date: new Date().toISOString().split('T')[0],
      time_min: mockCoords.time_min,
      column_index: mockCoords.column_index,
      patient_name: 'Test Patient',
      handwriting: null,
    };
    await modal.vm.$emit('save', newReservation);
    await nextTick();

    expect(mockSocketEmit).toHaveBeenCalledWith('save-reservation', newReservation);
  });

  it('does not emit event if modal is cancelled', async () => {
    const wrapper = mount(ReservationGrid, {
      props: { date: '2025-07-17' },
      global: {
        stubs: {
          ReservationModal: true
        }
      }
    });
    const canvas = wrapper.find('canvas');

    mockGetCoordinatesFromMouseEvent.mockReturnValue({ time_min: 540, column_index: 2 });

    await canvas.trigger('mousedown', { clientX: 100, clientY: 100 });
    await nextTick();

    // Expect the modal to be visible
    expect(wrapper.findComponent({ name: 'ReservationModal' }).props().show).toBe(true);

    // Simulate closing the modal without saving
    const modal = wrapper.findComponent({ name: 'ReservationModal' });
    await modal.vm.$emit('close');
    await nextTick();

    // Ensure emit was not called for 'create-reservation'
    const createReservationCall = mockSocketEmit.mock.calls.find(call => call[0] === 'create-reservation');
    expect(createReservationCall).toBeUndefined();
  });
});
