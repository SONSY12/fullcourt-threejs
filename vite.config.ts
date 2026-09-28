import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.FULLCOURT_NATIVE === '1' ? './' : '/fullcourt-threejs/',
  build: {
    target: 'es2022',
  },
});
