import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'tabcoord': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
});
