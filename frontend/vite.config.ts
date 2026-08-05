/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';

// Configuración de Vite + Vitest (Block 5, FEAT-001): la app no tenía testing
// de frontend configurado todavía, así que el setup de tests vive acá mismo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      // src/main.tsx y src/App.tsx son el bootstrap de la app (montaje de
      // React, configuración de rutas): no tienen lógica de negocio propia
      // testeable de forma aislada — ya quedan cubiertos indirectamente por
      // los tests de integración de LoginPage/ProtectedRoute/etc. Misma
      // convención que sigue el backend al excluir main.ts/app.module.ts.
      // Se extienden los defaults de Vitest (node_modules, dist, *.spec.ts,
      // archivos de config, etc.) en vez de reemplazarlos.
      exclude: [...coverageConfigDefaults.exclude, 'src/main.tsx', 'src/App.tsx'],
    },
  },
});
