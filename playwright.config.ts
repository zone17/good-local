import { defineConfig, devices } from "@playwright/test";
import { execSync } from "node:child_process";

// The dev server (vite) needs VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY to talk
// to the local stack. We derive them from `supabase status -o env` at config-load
// time and pass them into the webServer env. This keeps the e2e self-contained:
// no manual .env editing needed as long as the local stack is running (see
// tests/e2e/.env-note.md). If the CLI is unavailable, we fall back to the
// documented local defaults so app/.env.local still works.
function supabaseEnv(): { url: string; anonKey: string } {
  try {
    const raw = execSync("supabase status -o env", { encoding: "utf8" });
    const get = (k: string) =>
      raw.split("\n").find((l) => l.startsWith(`${k}=`))?.split("=").slice(1).join("=").replace(/^"|"$/g, "");
    return {
      url: get("API_URL") || "http://127.0.0.1:54321",
      anonKey: get("ANON_KEY") || "",
    };
  } catch {
    return { url: "http://127.0.0.1:54321", anonKey: "" };
  }
}

const sb = supabaseEnv();

export default defineConfig({
  testDir: "tests/e2e",
  use: {
    baseURL: process.env.GL_APP_URL ?? "http://localhost:5173",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // slow3g: 3G-class profile for the timed check-in path (SC-002, SC-008).
      // Runs the same tests as chromium. launchOptions only marks intent here;
      // actual network throttling is applied per-test via CDP
      // (Network.emulateNetworkConditions) in the spec files.
      name: "slow3g",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--disable-http2"],
        },
      },
    },
  ],
  webServer: {
    command: "npm --prefix app run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: sb.url,
      VITE_SUPABASE_ANON_KEY: sb.anonKey,
    },
  },
});
