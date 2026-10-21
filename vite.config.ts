/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' gera caminhos relativos: a aplicação funciona em qualquer subpasta
// (por exemplo GitHub Pages em /infinity/) sem configuração extra.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Bibliotecas em pedaços próprios: mudam raramente, por isso ficam em cache entre versões da aplicação.
        // O three.js só é pedido pelas secções 3D.
        manualChunks(id) {
          if (id.includes('node_modules/three/')) return 'three';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
