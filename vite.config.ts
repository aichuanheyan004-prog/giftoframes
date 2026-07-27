import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        guide: 'guide/index.html',
        privacy: 'privacy/index.html',
        terms: 'terms/index.html',
        notFound: '404.html'
      }
    }
  },
  test: {
    include: ['tests/unit/**/*.test.ts']
  }
});
