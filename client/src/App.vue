<script setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ReservationModal from './components/ReservationModal.vue'; // Import the modal

const router = useRouter();
const route = useRoute();

const currentDate = computed(() => {
  const result = route.params.date || new Date().toISOString().slice(0, 10);
  console.log('currentDate computed:', result, 'from route params:', route.params.date);
  return result;
});

const changeDate = (days) => {
  const currentDateValue = currentDate.value;
  if (!currentDateValue) {
    console.error('Current date is undefined');
    return;
  }
  
  const newDate = new Date(currentDateValue);
  if (isNaN(newDate.getTime())) {
    console.error('Invalid date format:', currentDateValue);
    return;
  }
  
  newDate.setDate(newDate.getDate() + days);
  const dateString = newDate.toISOString().slice(0, 10);
  router.push({ name: 'ReservationDate', params: { date: dateString } });
};

const goToToday = () => {
  const today = new Date().toISOString().slice(0, 10);
  router.push({ name: 'ReservationDate', params: { date: today } });
};

// New state for handling new reservation creation
const showNewReservationModal = ref(false);
const newReservationData = ref(null); // Data filled in the modal, to be passed to grid for placement
const isPlacingNewReservation = ref(false); // Flag to indicate grid is in selection mode

const startNewReservation = () => {
  const dateValue = currentDate.value;
  if (!dateValue) {
    console.error('Current date is undefined when starting new reservation');
    return;
  }
  
  newReservationData.value = {
    date: dateValue, // Pre-fill current date
    patient_name: '',
    handwriting: null,
    time_min: null, // These will be filled upon slot selection
    column_index: null, // These will be filled upon slot selection
  };
  showNewReservationModal.value = true;
};

const handleNewReservationModalSave = (reservationDetails) => {
  newReservationData.value = reservationDetails; // Save the details from the modal
  showNewReservationModal.value = false; // Close the modal
  isPlacingNewReservation.value = true; // Enter selection mode in the grid
};

const handleNewReservationModalClose = () => {
  showNewReservationModal.value = false;
  newReservationData.value = null; // Clear data if modal is closed without saving
};

// This function will be called by ReservationGrid when a slot is selected
const onNewReservationPlaced = () => {
  isPlacingNewReservation.value = false; // Exit selection mode
  newReservationData.value = null; // Clear the data
};

// Ensure we have a valid date parameter on mount
onMounted(() => {
  console.log('App.vue onMounted called');
  console.log('Current route:', route.path, route.params);
  console.log('Router instance:', router);
  console.log('Route object:', route);
  
  // No automatic redirects for now - just log the state
});

// Watch for route changes
watch(() => route.path, (newPath, oldPath) => {
  console.log('Route path changed from', oldPath, 'to', newPath);
}, { immediate: true });

watch(() => route.params, (newParams, oldParams) => {
  console.log('Route params changed from', oldParams, 'to', newParams);
}, { immediate: true, deep: true });
</script>

<template>
  <header>
    <h1>Dental Scheduler</h1>
    <nav class="date-nav">
      <button @click="changeDate(-1)">◀ 前日</button>
      <div class="date-display">
        <h2>{{ currentDate }}</h2>
        <button @click="goToToday">今日</button>
      </div>
      <button @click="changeDate(1)">翌日 ▶</button>
    </nav>
    <div class="action-bar">
      <button @click="startNewReservation">新規予約 (詳細入力)</button>
    </div>
  </header>
  <main>
    <div style="border: 3px solid orange; padding: 20px; margin: 10px;">
      <h2>STATIC TEST IN APP.VUE</h2>
      <p>If you see this orange border, App.vue is rendering correctly</p>
      <p>Current route path: {{ route.path }}</p>
      <p>Current route name: {{ route.name }}</p>
      <p>Route params: {{ JSON.stringify(route.params) }}</p>
      <p>Route matched: {{ route.matched.length }} route(s)</p>
      <p>Router current route: {{ router.currentRoute.value.path }}</p>
      <p>Router matched: {{ router.currentRoute.value.matched.length }}</p>
    </div>
    <div style="border: 3px solid green; padding: 20px; margin: 10px;">
      <h3>ROUTER-VIEW CONTAINER</h3>
      <p>Simple router-view test:</p>
      <router-view />
    </div>
  </main>

  <!-- Modal for new reservation creation -->
  <ReservationModal
    :show="showNewReservationModal"
    :reservation="newReservationData"
    @close="handleNewReservationModalClose"
    @save="handleNewReservationModalSave"
  />
</template>

<style scoped>
header {
  padding: 1rem;
  background-color: #f4f4f4;
  border-bottom: 1px solid #ddd;
}
h1 {
  text-align: center;
  margin: 0 0 1rem;
}
.date-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
}
.date-display {
  display: flex;
  align-items: center;
  gap: 1rem;
}
button {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  background-color: #fff;
  cursor: pointer;
}
button:hover {
  background-color: #eee;
}
.action-bar {
  text-align: center;
  margin-top: 1rem;
}
</style>
