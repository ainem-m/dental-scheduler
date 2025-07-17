<script setup>
import { computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ReservationModal from './components/ReservationModal.vue'; // Import the modal

const router = useRouter();
const route = useRoute();

const currentDate = computed(() => route.params.date);

const changeDate = (days) => {
  const newDate = new Date(currentDate.value);
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
  newReservationData.value = {
    date: currentDate.value, // Pre-fill current date
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
    <router-view
      :date="currentDate"
      :newReservationToPlace="newReservationData"
      :isPlacingNewReservation="isPlacingNewReservation"
      @newReservationPlaced="onNewReservationPlaced"
    />
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
