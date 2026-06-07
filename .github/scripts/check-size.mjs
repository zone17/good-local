// Enforces the SC-008 bundle budgets against app/dist by measuring each HTML
// entry's ACTUAL JavaScript graph (the entry chunk + every shared chunk it
// loads), not a filename heuristic. This counts the React vendor chunk against
// the check-in entry honestly (R7).
//   - check-in entry (checkin.html): <= 60 KB gzipped JS
//   - main entry (index.html):       <= 130 KB gzipped JS
// Prints SKIP when an entry's HTML is absent. Fails (exit 1) only when a present
// entry exceeds its budget.

import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const CHECKIN_BUDGET = 61440; // 60 KB
const MAIN_BUDGET = 133120; // 130 KB

const distDir = "app/dist";

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

async function gzipSize(file) {
  return gzipSync(await readFile(file)).length;
}

// Extract the <script type="module" src> + modulepreload JS that an HTML entry
// pulls. Vite emits the entry script plus <link rel="modulepreload"> for each
// shared chunk in the entry's import graph, so this captures the true payload.
async function entryJs(htmlPath) {
  let html;
  try {
    html = await readFile(htmlPath, "utf8");
  } catch {
    return null; // entry absent
  }
  const refs = new Set();
  const scriptRe = /<script[^>]+src="([^"]+\.js)"/g;
  const preloadRe = /<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g;
  let m;
  while ((m = scriptRe.exec(html))) refs.add(m[1]);
  while ((m = preloadRe.exec(html))) refs.add(m[1]);
  return [...refs].map((r) => join(distDir, r.replace(/^\//, "")));
}

let failed = false;

async function checkEntry(label, htmlName, budget) {
  const files = await entryJs(join(distDir, htmlName));
  if (files === null) {
    console.log(`SKIP ${label}: ${htmlName} not found in build`);
    return;
  }
  let total = 0;
  for (const f of files) {
    try {
      total += await gzipSize(f);
    } catch {
      // referenced file missing — surface it loudly.
      console.error(`  -> ${label}: referenced asset missing: ${f}`);
      failed = true;
    }
  }
  const ok = total <= budget;
  console.log(
    `${ok ? "OK" : "FAIL"} ${label}: ${kb(total)} gzipped (budget ${kb(budget)})` +
      `\n     files: ${files.join(", ")}`,
  );
  if (!ok) {
    failed = true;
    console.error(`  -> ${label} exceeds budget by ${kb(total - budget)}.`);
  }
}

try {
  await stat(distDir);
} catch {
  console.error(`Build output ${distDir} not found. Run the app build first.`);
  process.exit(1);
}

await checkEntry("check-in entry JS", "checkin.html", CHECKIN_BUDGET);
await checkEntry("main entry JS", "index.html", MAIN_BUDGET);

if (failed) {
  console.error("\nBundle size budget exceeded.");
  process.exit(1);
}
console.log("\nAll present entries within budget.");
