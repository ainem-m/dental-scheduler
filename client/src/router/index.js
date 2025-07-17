import { createRouter, createWebHashHistory } from 'vue-router';

console.log('Creating minimal router...');

// Define an inline component to test - using render function instead of template
import { h } from 'vue';

const InlineTestComponent = {
  name: 'InlineTestComponent',
  setup() {
    console.log('InlineTestComponent setup called');
    return () => h('div', { 
      style: { 
        background: 'red', 
        padding: '20px', 
        color: 'white' 
      } 
    }, [
      h('h1', 'INLINE COMPONENT WORKS!'),
      h('p', 'This is an inline component with render function')
    ]);
  }
};

const routes = [
  {
    path: '/',
    name: 'Home',
    component: InlineTestComponent
  },
  {
    path: '/test',
    name: 'Test',
    component: InlineTestComponent
  },
  {
    path: '/reservations/:date',
    name: 'ReservationDate',
    component: InlineTestComponent,
    props: true
  }
];

console.log('Routes defined:', routes);

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

console.log('Router created successfully:', router);
console.log('Router routes:', router.getRoutes());

// Simplified navigation guards for debugging
router.beforeEach((to, from, next) => {
  console.log('Router beforeEach:', from.path, '->', to.path);
  console.log('Route to match:', to);
  console.log('Route matched records:', to.matched);
  next();
});

router.afterEach((to, from) => {
  console.log('Router afterEach completed:', to.path);
  console.log('Final route matched records:', to.matched);
  if (to.matched.length > 0) {
    console.log('First matched record:', to.matched[0]);
    console.log('Component in matched record:', to.matched[0].components?.default);
  }
});

export default router;
