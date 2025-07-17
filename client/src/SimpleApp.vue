<template>
  <div style="border: 3px solid blue; padding: 20px;">
    <h1>SIMPLE APP TEST</h1>
    <p>This is a completely minimal test</p>
    <div style="border: 2px solid purple; padding: 10px; margin: 10px;">
      <h3>Router View Area:</h3>
      <router-view v-slot="{ Component, route }">
        <div style="border: 1px solid orange; padding: 5px;">
          <p>Router-view slot component: {{ Component ? 'Found' : 'None' }}</p>
          <p>Route name: {{ route?.name || 'None' }}</p>
          <component :is="Component" v-if="Component" />
          <p v-else>No component to render</p>
        </div>
      </router-view>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';

console.log('SimpleApp.vue loaded');

const route = useRoute();
const router = useRouter();

console.log('SimpleApp route:', route);
console.log('SimpleApp router:', router);
</script>