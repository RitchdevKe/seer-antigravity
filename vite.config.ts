import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['seer.myshule.ke', 'demo.myshule.ke', 'localhost'],
        watch: {
          ignored: ['**/data/**', '**/scratch/**', '**/nerdy_cookies.json', '**/*.json', '**/.*/**', '**/node_modules/**'],
        }
      },
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

