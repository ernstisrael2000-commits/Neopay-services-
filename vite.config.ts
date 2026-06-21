import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  const hmrConfig = (() => {
    if (env.REPLIT_DEV_DOMAIN) {
      return { clientPort: 443, protocol: 'wss' as const, host: env.REPLIT_DEV_DOMAIN };
    }
    if (env.HMR_HOST) {
      return { host: env.HMR_HOST };
    }
    return true;
  })();

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.RECAPTCHA_SITE_KEY': JSON.stringify(env.RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || ''),
      'process.env.FIREBASE_VAPID_KEY': JSON.stringify(env.FIREBASE_VAPID_KEY || process.env.FIREBASE_VAPID_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: [
        'react', 'react-dom', 'react-dom/client',
        'firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage',
        'lucide-react', 'sonner', 'motion/react',
        'clsx', 'tailwind-merge', 'class-variance-authority',
      ],
      esbuildOptions: {
        sourcemap: false,
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage', 'firebase/messaging'],
            'vendor-ui': ['lucide-react', 'sonner', 'motion'],
            'vendor-charts': ['recharts'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
          },
        },
      },
      target: 'es2020',
      minify: 'esbuild',
      cssMinify: true,
    },
    server: {
      hmr: hmrConfig,
      host: '0.0.0.0',
      allowedHosts: true,
      watch: {
        ignored: ['**/.local/**', '**/.cache/**', '**/node_modules/**', '**/dist/**'],
      },
    },
  };
});
