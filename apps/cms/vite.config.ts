import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(__dirname, '../../');
  const env = loadEnv(mode, rootEnvDir, '');

  return {
    plugins: [react()],
    envDir: rootEnvDir,
    resolve: {
      alias: {
        '@images': path.resolve(__dirname, '../web/public/images'),
      },
    },
    server: {
      port: Number(env.CMS_PORT) || 3001,
      strictPort: false,
    },
  };
});