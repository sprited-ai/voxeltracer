import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Library build: framework-agnostic bundle (three.js included) usable from
// <script> tags (UMD global `voxeltracer`) or any bundler (ESM).
export default defineConfig({
  publicDir: false,
  plugins: [
    dts({
      include: ['src/index.ts', 'src/core', 'src/Renderer', 'src/Data', 'src/Enums'],
      exclude: ['src/**/*.test.ts'],
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'voxeltracer',
      fileName: 'voxeltracer',
      formats: ['es', 'umd'],
    },
    outDir: 'dist',
    sourcemap: true,
  },
});
