import { defineConfig } from 'vite';

// Static prototype — index.html at the root is the entry point.
// No framework plugins needed; Vite handles ES modules, CSS, and HMR.
export default defineConfig({
  server: {
    open: true,
  },
});
