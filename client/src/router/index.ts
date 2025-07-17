import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import ReservationGrid from '../components/ReservationGrid.vue';

const getToday = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: `/reservations/${getToday()}`,
  },
  {
    path: '/reservations/:date',
    name: 'ReservationDate',
    component: ReservationGrid,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;