// Назначение: Собирает Electron main, preload и worker entrypoints в ESM-файлы для desktop runtime.
// Не входит: Сборка renderer, packaging релиза и TypeScript typecheck.
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "main/index": "src/main/index.ts",
    "main/workers/prompt-vectors/prompt-vector.worker": "src/main/workers/prompt-vectors/prompt-vector.worker.ts",
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
  external: [
    "electron",
    "electron/main",
    "electron/common",
    "electron/renderer",
    "better-sqlite3",
    "@lancedb/lancedb",
    "@xenova/transformers"
  ]
});
