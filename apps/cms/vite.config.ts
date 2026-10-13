import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Reads VITE_* variables from the repo-root .env. Secrets without the VITE_ prefix are never exposed.
export default defineConfig({
  plugins: [react()],
  envDir: '../../',
  server: { port: 3001, strictPort: true },
});
