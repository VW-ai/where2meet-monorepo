import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Next resolves this marker itself; tests run outside its bundler.
      'server-only': 'next/dist/compiled/server-only/empty.js',
    },
  },
});
