import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? (process.env.VITE_BASE_PATH ?? '/GestaoFamiliar/') : '/';
  const buildDate = new Date().toISOString();

  return {
    base,
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_BUILD_DATE__: JSON.stringify(buildDate),
      __APP_CREATOR__: JSON.stringify('AI-Cenas92'),
    },
    plugins: [
      {
        name: 'emit-version-json',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ version: pkg.version, buildDate }),
          });
        },
      },
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Gestão Familiar',
          short_name: 'Casa & Cozinha',
          description:
            'Gestão de stock doméstico, receitas próprias, ementa semanal e lista de compras — offline-first.',
          theme_color: '#0f766e',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait-primary',
          lang: 'pt-PT',
          start_url: base,
          scope: base,
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
