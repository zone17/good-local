import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// The design system is the source of truth at ../design — the app imports
// its tokens and components directly so there is exactly one copy.
// Dev-only: serve the lean check-in entry for /c/{slug} scans. In production the
// host rewrites /c/:path* → /checkin.html (e.g. Vercel `rewrites` in
// vercel.json: { "source": "/c/(.*)", "destination": "/checkin.html" }). This
// plugin reproduces that rewrite for `vite dev` so the QR target resolves.
function checkinRewrite() {
  return {
    name: "gl-checkin-rewrite",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && /^\/c\//.test(req.url)) {
          req.url = "/checkin.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), checkinRewrite()],
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
      output: {
        // Isolate React into a named vendor chunk so the size gate can attribute
        // the shared runtime accurately to each entry's real graph (R7/SC-008),
        // and so a deterministic chunk name replaces the entry-derived "Button".
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "react-vendor";
          }
        },
      },
    },
  },
  server: {
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
});
