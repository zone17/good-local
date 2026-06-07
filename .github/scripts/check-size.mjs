// Enforces the SC-008 bundle budgets against app/dist.
//   - check-in entry JS (files matching /checkin/i): <= 60 KB gzipped
//   - main entry JS (everything else): <= 130 KB gzipped
// Prints SKIP when an entry pattern is absent (the checkin.html entry may not
// exist yet). Fails (exit 1) only when a present entry exceeds its budget.

import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const CHECKIN_BUDGET = 61440; // 60 KB
const MAIN_BUDGET = 133120; // 130 KB

const distDir = "app/dist";
const assetsDir = join(distDir, "assets");

async function listJs(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listJs(full)));
    } else if (e.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

async function gzipSize(file) {
  const buf = await readFile(file);
  return gzipSync(buf).length;
}

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

const files = [...(await listJs(assetsDir)), ...(await listJs(distDir))]
  .filter((f, i, a) => a.indexOf(f) === i);

if (files.length === 0) {
  try {
    await stat(distDir);
    console.log(`No JS assets found under ${distDir} — nothing to measure.`);
  } catch {
    console.error(`Build output ${distDir} not found. Run the app build first.`);
    process.exit(1);
  }
}

const checkinFiles = files.filter((f) => /checkin/i.test(f));
const mainFiles = files.filter((f) => !/checkin/i.test(f));

let failed = false;

async function checkGroup(label, group, budget) {
  if (group.length === 0) {
    console.log(`SKIP ${label}: no matching entry in build`);
    return;
  }
  let total = 0;
  for (const f of group) total += await gzipSize(f);
  const ok = total <= budget;
  const verb = ok ? "OK" : "FAIL";
  console.log(
    `${verb} ${label}: ${kb(total)} gzipped (budget ${kb(budget)})` +
      `\n     files: ${group.join(", ")}`,
  );
  if (!ok) {
    failed = true;
    console.error(
      `  -> ${label} exceeds budget by ${kb(total - budget)}.`,
    );
  }
}

await checkGroup("check-in entry JS", checkinFiles, CHECKIN_BUDGET);
await checkGroup("main entry JS", mainFiles, MAIN_BUDGET);

if (failed) {
  console.error("\nBundle size budget exceeded.");
  process.exit(1);
}
console.log("\nAll present entries within budget.");
