<template>
  <div style="background: purple; padding: 20px; color: white;">
    <h1>SIMPLE TEST COMPONENT WORKING!</h1>
    <p>Date prop: {{ date }}</p>
    <p>If you see this, the route props are working</p>
  </div>
</template>

<script setup>
console.log('SimpleTest component script setup started');

const props = defineProps({
  date: {
    type: String,
    required: true,
  },
});

console.log('SimpleTest component props received:', props.date);
</script>