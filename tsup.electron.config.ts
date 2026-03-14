// Purpose: Bundle Electron main and preload sources into runnable ESM output for the desktop runtime.
// Out of scope: Renderer bundling, release packaging, and type checking.
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "main/index": "src/main/index.ts",
    "preload/index": "src/preload/index.ts"
  },
  format: ["esm"],
  outDir: "dist-electron",
  platform: "node",
  target: "node20",
  bundle: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: false,
  shims: false,
  external: ["electron", "electron/main", "electron/common", "electron/renderer", "better-sqlite3"]
});
