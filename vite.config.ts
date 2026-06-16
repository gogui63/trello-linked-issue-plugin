import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        popup: resolve(__dirname, 'popup.html'),
        section: resolve(__dirname, 'section.html'),
        authorize: resolve(__dirname, 'authorize.html'),
      },
    },
  },
});
