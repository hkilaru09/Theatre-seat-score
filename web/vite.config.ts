/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works under https://hkilaru09.github.io/Theatre-seat-score/
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
