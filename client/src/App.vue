<script setup>
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';

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
  </header>
  <main>
    <router-view />
  </main>
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
</style>
