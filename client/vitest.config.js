import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue({
    script: {
      defineModel: true,
      propsDestructure: true
    }
  })],
  test: {
    environment: 'jsdom',
    globals: true
  },
  esbuild: {
    target: 'es2020'
  }
})