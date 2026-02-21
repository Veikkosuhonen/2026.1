import { defineConfig } from 'vite';
import topLevelAwait from "vite-plugin-top-level-await";
import path from "path";

export default defineConfig({
  plugins: [topLevelAwait()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 3000,
  },
  base: './',
  build: {
    target: 'esnext',
  },
});
