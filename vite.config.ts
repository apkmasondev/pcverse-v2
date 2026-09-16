import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages cannot send headers, so the production page carries its policy in a meta tag.
// Everything is self-hosted. `wasm-unsafe-eval` is required by the bundled meshopt decoder;
// inline styles come from positioned HTML labels in the 3D scene.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function securityMeta(): Plugin {
  return {
    name: 'pcverse-security-meta',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
        injectTo: 'head-prepend',
      },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head' },
    ],
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), securityMeta()],
  base: '/pcverse-v2/',
  build: {
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        codeSplitting: {
          minSize: 20 * 1024,
          maxSize: 700 * 1024,
          groups: [
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              entriesAware: true,
            },
          ],
        },
      },
    },
  },
});
