import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Relative base keeps the build working from any GitHub Pages project subpath.
  base: './',
  build: { target: 'es2022', sourcemap: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
