import { createApp, h } from 'vue'
import './style.css'

console.log('main.js: 歯科スケジューラーアプリ復旧 - ReservationGridを直接レンダリング');

// ReservationGridコンポーネントを直接インポート
import ReservationGrid from './components/ReservationGrid.vue';

console.log('ReservationGrid.vue import:', ReservationGrid);

// 今日の日付を取得
const today = new Date().toISOString().slice(0, 10);

// シンプルなラッパーアプリ
const DentalSchedulerApp = {
  setup() {
    console.log('DentalSchedulerApp setup called');
    return () => h('div', [
      h('header', { style: { padding: '20px', backgroundColor: '#f4f4f4', borderBottom: '1px solid #ddd' } }, [
        h('h1', { style: { textAlign: 'center', margin: '0' } }, '歯科予約システム'),
        h('p', { style: { textAlign: 'center', margin: '10px 0 0 0' } }, `日付: ${today}`)
      ]),
      h('main', { style: { padding: '20px' } }, [
        h(ReservationGrid, { date: today })
      ])
    ]);
  }
};

const app = createApp(DentalSchedulerApp);

// Vue DevToolsエラーを無視するエラーハンドラー
app.config.errorHandler = (error, vm, info) => {
  if (error.message && error.message.includes('__vrv_devtools')) {
    console.warn('Vue DevTools error (ignoring):', error.message);
    return;
  }
  console.error('Vue Error:', error, info);
};

app.mount('#app');
console.log('main.js: App mounted without Vue Router');
