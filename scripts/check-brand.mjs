// ===========================================================================
// check-brand.mjs — brand-compliance CI gate (SC-009, design/SKILL.md).
//
// Node-runnable from the repo root with no dependencies. Scans the patron- and
// owner-facing source under app/src and the design component library for the
// brand rules that the design skill says we must never break:
//
//   1. No emoji codepoints anywhere in UI source. Status icons are SVG, never
//      emoji. Detected with the Unicode Extended_Pictographic property.
//   2. No rating affordances. Discovery ranks by verified return visits only —
//      no stars, no `rating=` props. (The Icon catalog's "star" glyph KEY is an
//      allowed false positive: it's an icon-system entry, not a rating UI. See
//      the heuristic notes inline.)
//   3. No hype copy in patron-facing string literals: "Unlock exclusive",
//      "claim your", and exclamation marks inside JSX string literals. The voice
//      is plain person-to-person ("You're two visits from the regular's pour"),
//      never "Unlock exclusive rewards!".
//   4. Plural correctness: app/src/checkin and app/src/patron must format visit
//      and town counts through the visits()/townLabel() helpers, not raw
//      `${n} visits` template strings.
//
// Exit non-zero with a file:line report on any violation. The current tree must
// be clean. False positives are handled by REFINING the check (documented
// below), never by silently weakening it.
// ===========================================================================

import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();

const SCAN_ROOTS = ["app/src", "design/components"];
const SOURCE_RE = /\.(js|jsx)$/;

// ---------------------------------------------------------------------------
// File collection
// ---------------------------------------------------------------------------
async function collect(dir, out) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out; // a scan root may legitimately be absent
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await collect(full, out);
    else if (SOURCE_RE.test(e.name)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Heuristics
// ---------------------------------------------------------------------------

// Emoji: any Extended_Pictographic codepoint. This catches color emoji and the
// pictographic dingbats; it does NOT flag ordinary punctuation, the middot (·),
// or em dashes used throughout the copy.
const EMOJI_RE = /\p{Extended_Pictographic}/u;

// A line is "comment-ish" if, after trimming, it begins with a JS/JSX comment
// marker. Used to keep the exclamation-mark heuristic honest — we do not flag
// `// don't!` style prose, only patron-visible string literals.
function isCommentLine(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

// Pull the contents of single/double-quoted and JSX-attribute string literals
// from a line. We deliberately do NOT parse template literals here for the
// exclamation check (template literals carry interpolation/expressions where a
// `!` is almost always an operator, e.g. `!added`), keeping the heuristic from
// firing on code. JSX text exclamation (between > and <) is also checked.
function stringLiterals(line) {
  const out = [];
  const re = /"([^"]*)"|'([^']*)'/g;
  let m;
  while ((m = re.exec(line))) out.push(m[1] ?? m[2] ?? "");
  return out;
}

// JSX text nodes on a line: text that sits between a `>` and a `<`. Catches
// copy like `<div>Welcome back!</div>` that isn't a quoted literal.
function jsxTextNodes(line) {
  const out = [];
  const re = />([^<>{}]+)</g;
  let m;
  while ((m = re.exec(line))) out.push(m[1]);
  return out;
}

// Hype phrases (case-insensitive) that violate the plain-voice rule.
const HYPE_RE = /\bUnlock exclusive\b|\bclaim your\b/i;

// Rating affordance: a `rating=` prop (JSX) or a `star`/`stars` token used as
// rating UI. We must NOT flag the Icon component's catalog, where "star" is a
// legitimate glyph KEY (icon name), not a rating control. Detection rule:
//   - `rating=` anywhere → always a violation (no legit use in this brand).
//   - the word star(s) → violation ONLY when it appears as patron-visible JSX
//     text or as a non-icon prop value; the Icon catalog declares it as a quoted
//     map key (`"star":`) or a union member (`"star" |`), which we allow.
const RATING_PROP_RE = /\brating\s*=/;
const STAR_WORD_RE = /\bstars?\b/i;
// Allowlist contexts where the literal "star" is an icon-system identifier, not
// a rating affordance: a quoted object key, a Icon name= prop, or a TS union
// member. These are the only sanctioned appearances.
function isIconCatalogStar(line) {
  const t = line.trim();
  // `"star":` map key, `"star" |` union member, or `name="star"` icon usage.
  return (
    /["']stars?["']\s*:/.test(t) ||
    /["']stars?["']\s*\|/.test(t) ||
    /\bname\s*=\s*["']stars?["']/.test(t) ||
    /\|\s*["']stars?["']/.test(t)
  );
}

// Plural correctness: raw `${count} visits` template formatting in the
// patron/check-in surfaces, where a possibly-singular interpolated COUNT is
// glued straight to a hardcoded plural noun. The sanctioned path is the
// visits()/townLabel() helpers.
//
// REFINEMENT (documented, not a silent weakening): the canonical brand idiom
// `${visited} of ${total} towns` is NOT a violation — there the trailing noun
// agrees with the fixed total (always 12, always plural), never with the
// variable count. This idiom is used verbatim as plain JSX in PatronApp.jsx
// ("{townsVisited} of {townsTotal} Upper Delaware towns"). We therefore only
// flag a count interpolation IMMEDIATELY followed by the noun (`${n} visits`,
// `${n} town`), and exempt the "X of Y <noun>" shape.
const RAW_PLURAL_RE = /\$\{[^}]+\}\s+(visits?|towns?)\b/;
const OF_TOTAL_IDIOM_RE = /\$\{[^}]+\}\s+of\s+\$\{[^}]+\}\s+(visits?|towns?)\b/;
const PLURAL_SCAN_PREFIXES = ["app/src/checkin", "app/src/patron"];

// ---------------------------------------------------------------------------
// Scan
// ---------------------------------------------------------------------------
const violations = [];
function flag(file, lineNo, rule, detail) {
  violations.push({ file: relative(ROOT, file), lineNo, rule, detail });
}

async function scanFile(file) {
  const rel = relative(ROOT, file);
  const text = await readFile(file, "utf8");
  const lines = text.split("\n");
  const inPluralSurface = PLURAL_SCAN_PREFIXES.some((p) => rel.startsWith(p));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // 1. Emoji — anywhere, including comments (no emoji in source at all).
    if (EMOJI_RE.test(line)) {
      flag(file, lineNo, "emoji", `emoji codepoint: ${line.trim().slice(0, 80)}`);
    }

    // 2a. rating= prop — always a violation.
    if (RATING_PROP_RE.test(line)) {
      flag(file, lineNo, "rating-prop", `rating= affordance: ${line.trim().slice(0, 80)}`);
    }
    // 2b. star(s) word — violation unless it's the sanctioned icon catalog entry.
    if (STAR_WORD_RE.test(line) && !isCommentLine(line) && !isIconCatalogStar(line)) {
      // Only flag when it reads as patron-visible UI: JSX text or a string
      // literal. SVG path data ("polygon points=...") never contains the word.
      const inText =
        jsxTextNodes(line).some((t) => STAR_WORD_RE.test(t)) ||
        stringLiterals(line).some((s) => STAR_WORD_RE.test(s));
      if (inText) {
        flag(file, lineNo, "star-affordance", `star rating affordance: ${line.trim().slice(0, 80)}`);
      }
    }

    // 3. Hype copy + exclamation marks in patron-facing literals/JSX text.
    if (!isCommentLine(line)) {
      const literals = stringLiterals(line);
      const texts = jsxTextNodes(line);
      const candidates = [...literals, ...texts];
      for (const c of candidates) {
        if (HYPE_RE.test(c)) {
          flag(file, lineNo, "hype-copy", `plain-voice violation: "${c.trim().slice(0, 60)}"`);
        }
        // Exclamation mark with >1 char of copy before it (the brief's heuristic:
        // skip a lone "!" which would be an operator artifact, target real copy).
        const bang = c.indexOf("!");
        if (bang > 1 && /[A-Za-z]/.test(c.slice(0, bang))) {
          flag(file, lineNo, "exclamation", `exclamation in patron copy: "${c.trim().slice(0, 60)}"`);
        }
      }
    }

    // 4. Plural correctness — only in the patron/check-in surfaces. A bare
    //    `${count} visits`/`${count} town` is a violation; the "X of Y towns"
    //    idiom (noun agrees with the fixed total) is exempt.
    if (inPluralSurface && RAW_PLURAL_RE.test(line) && !OF_TOTAL_IDIOM_RE.test(line)) {
      flag(
        file,
        lineNo,
        "raw-plural",
        `raw \${n} count+noun — use visits()/townLabel(): ${line.trim().slice(0, 80)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const files = [];
for (const root of SCAN_ROOTS) await collect(join(ROOT, root), files);
files.sort();

for (const f of files) await scanFile(f);

if (violations.length === 0) {
  console.log(`OK brand: ${files.length} source files scanned, zero violations.`);
  process.exit(0);
}

console.error(`FAIL brand: ${violations.length} violation(s):\n`);
for (const v of violations.sort((a, b) => a.file.localeCompare(b.file) || a.lineNo - b.lineNo)) {
  console.error(`  ${v.file}:${v.lineNo}  [${v.rule}]  ${v.detail}`);
}
console.error("\nSee design/SKILL.md — brand rules are not negotiable.");
process.exit(1);
