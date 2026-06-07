// ============================================================
// towns.js — the 12 Upper Delaware town slugs (season one).
//
// Hardcoded constant to keep the signup form dependency-free at the
// register/signup moment. Mirrors supabase/seed/seed.sql.
// TODO: fetch from a public towns endpoint once get_discovery is wired
// (US5) so a second region needs no code change (Art. XVI / FR-035).
// ============================================================

/** @type {ReadonlyArray<{ slug: string, name: string }>} */
export const TOWNS = Object.freeze([
  { slug: "narrowsburg", name: "Narrowsburg" },
  { slug: "barryville", name: "Barryville" },
  { slug: "callicoon", name: "Callicoon" },
  { slug: "eldred", name: "Eldred" },
  { slug: "jeffersonville", name: "Jeffersonville" },
  { slug: "livingston-manor", name: "Livingston Manor" },
  { slug: "bethel", name: "Bethel" },
  { slug: "cochecton", name: "Cochecton" },
  { slug: "honesdale", name: "Honesdale" },
  { slug: "hawley", name: "Hawley" },
  { slug: "milford", name: "Milford" },
  { slug: "shohola", name: "Shohola" },
]);
