import { createRouter, createWebHistory } from 'vue-router';
import ReservationGrid from '../components/ReservationGrid.vue';

const getToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const routes = [
  {
    path: '/',
    redirect: `/reservations/${getToday()}`,
  },
  {
    path: '/reservations/:date',
    name: 'ReservationDate',
    component: ReservationGrid,
    props: true, // Allows :date to be passed as a prop to the component
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
