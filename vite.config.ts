import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base so the app works under https://kndlt.github.io/voxelviewer/
  base: './',
  build: {
    outDir: 'build',
  },
});
