/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Configuración de Vite + Vitest (Block 5, FEAT-001): la app no tenía testing
// de frontend configurado todavía, así que el setup de tests vive acá mismo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
