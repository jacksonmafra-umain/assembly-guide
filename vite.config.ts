import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // the demo film project and tool scratch live in the repo but are not part of the app
  server: { watch: { ignored: ['**/video/**', '**/.superpowers/**'] } },
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
});
