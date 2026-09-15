import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  clearScreen: false,
  // The point-cloud engine lives in the design-system package (which has no
  // node_modules of its own); resolve the heavy dependency from the app's
  // install so the lazy import stays one explicitly-loaded chunk.
  resolve: {
    alias: {
      three: fileURLToPath(new URL("./node_modules/three", import.meta.url)),
    },
  },
  server: {
    port: 1421,
    strictPort: true,
    // The design-system package lives outside the app root; its assets
    // (the loading mark) must serve in dev.
    fs: {
      allow: [fileURLToPath(new URL("../..", import.meta.url))],
    },
  },
  build: {
    target: "es2021",
  },
  define: {
    // U0.6 walk gate (map §3 D10): the `__cradle.walk` channel mounts only
    // in dev/walk bundles — `vite serve` (dev) or `WALK=1 vite build` (the
    // walk bundle the runner previews). A plain production build bakes
    // `false`, which dead-code-eliminates the dynamic import in Cradle.tsx
    // so the channel chunk is never emitted at all (the grep proof lives in
    // walk/README.md).
    __CRADLE_WALK__: JSON.stringify(command === "serve" || process.env.WALK === "1"),
  },
}));
