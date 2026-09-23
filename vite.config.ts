import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
  },
});
