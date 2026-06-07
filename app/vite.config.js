import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The design system is the source of truth at ../design — the app imports
// its tokens and components directly so there is exactly one copy.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ds": fileURLToPath(new URL("../design", import.meta.url)),
    },
  },
  // Two entries (R7): the main SPA, and a lean check-in landing for /c/{slug}
  // scans so the register moment never pays for the dashboard bundle.
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        checkin: fileURLToPath(new URL("./checkin.html", import.meta.url)),
      },
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
});
