import { defineConfig, devices } from "@playwright/test";

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
  },
});
