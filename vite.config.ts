// Purpose: Configure Vite for the React renderer bundle used inside the Electron window.
// Out of scope: Electron main/preload compilation and desktop packaging.
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  root: resolve(__dirname, "src/renderer"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  },
  build: {
    outDir: resolve(__dirname, "dist"),
    emptyOutDir: true
  }
});
