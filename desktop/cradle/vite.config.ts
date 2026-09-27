import { fileURLToPath } from "node:url";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { ensureExpressionsApp } from "./scripts/ensure-expressions-app.mjs";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react(), {
    name: "candidate-hosted-expressions",
    apply: "build",
    // A direct `vite build` (or `npm ci --ignore-scripts`) skips the prebuild
    // hook; the embedded application is installed and built here instead of
    // refusing the bundle.
    buildStart() { ensureExpressionsApp({build: true}); },
    writeBundle(output) {
      const source = fileURLToPath(new URL("./expressions-app/dist", import.meta.url));
      if (!existsSync(resolve(source, "index.html"))) throw new Error("Build this checkout's Expressions application before bundling the desktop (npm run build:expressions).");
      cpSync(source, resolve(output.dir ?? "dist", "expressions"), {recursive: true});
    },
  }],
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
    rollupOptions: {
      output: {
        // The point-cloud engine and its three.js runtime are shared by
        // several lazily loaded bodies (the stage's engine surface, the
        // Expression composer, knowledge/page projections, K9). Left to
        // Rollup they would be hoisted into the entry chunk as common code;
        // named chunks keep them off the startup path — loaded by the first
        // body that needs them, never by the shell.
        manualChunks(id) {
          if (id.includes("/node_modules/three/")) return "three";
          if (id.includes("/expressions-engine/")) return "expressions-engine";
          return undefined;
        },
      },
    },
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
