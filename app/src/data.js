// ============================================================
// Mock data layer — season-one Narrowsburg founding cluster.
// This module is the ONLY place screens read data from; replace
// these exports with API calls when the backend lands and no
// screen code changes. Shapes mirror the design-system UI kits.
// ============================================================

export const ME = {
  firstName: "Maya",
  region: "Upper Delaware",
  startedSeason: "Season 1",
};

export const BUSINESSES = [
  {
    id: "heron",
    name: "The Heron",
    town: "Narrowsburg, NY",
    kind: "Restaurant · river-view",
    distance: "0.4 mi",
    stamps: 3, perkTotal: 5,
    perkLabel: "The Regular's Pour",
    perkSub: "Two more visits, on the house",
    regulars: 38,
    eyebrow: "Founding pick",
    eyebrowTone: "stamp",
    code: "HRN",
    open: true,
  },
  {
    id: "boomer",
    name: "Boomer's Diner",
    town: "Barryville, NY",
    kind: "Diner · breakfast all day",
    distance: "0.8 mi",
    stamps: 2, perkTotal: 5,
    perkLabel: "Bottomless drip",
    perkSub: "Show this on your sixth visit",
    regulars: 24,
    code: "BMR",
    open: true,
  },
  {
    id: "outfitter",
    name: "Catskill Outfitters",
    town: "Eldred, NY",
    kind: "Paddle rental + gear",
    distance: "1.2 mi",
    stamps: 1, perkTotal: 4,
    perkLabel: "$10 off your next paddle",
    perkSub: "Three more visits",
    regulars: 19,
    eyebrow: "New this week",
    eyebrowTone: "ochre",
    code: "CAT",
    open: false,
  },
  {
    id: "loomroom",
    name: "Loom Room Bookshop",
    town: "Narrowsburg, NY",
    kind: "Indie books · weekly readings",
    distance: "0.5 mi",
    stamps: 4, perkTotal: 5,
    perkLabel: "The regular's shelf",
    perkSub: "One more visit",
    regulars: 41,
    eyebrow: "Verified regular pick",
    eyebrowTone: "pine",
    code: "LRM",
    open: true,
  },
  {
    id: "kingsten",
    name: "Kingsten Gallery",
    town: "Callicoon, NY",
    kind: "Local artists · open Fri–Sun",
    distance: "5.7 mi",
    stamps: 0, perkTotal: 5,
    perkLabel: "Member's preview night",
    perkSub: "Five visits gets you in early",
    regulars: 12,
    code: "KGS",
    open: false,
  },
];

export const MY_STAMPS = [
  { code: "HRN", date: "06·07", rotate: -3 },
  { code: "HRN", date: "06·12", rotate: 2 },
  { code: "HRN", date: "06·14", rotate: -2 },
  { code: "BMR", date: "06·09", rotate: 3 },
  { code: "BMR", date: "06·13", rotate: -1 },
  { code: "LRM", date: "06·05", rotate: -4 },
  { code: "LRM", date: "06·08", rotate: 1 },
  { code: "LRM", date: "06·11", rotate: -2 },
  { code: "LRM", date: "06·14", rotate: 3 },
  { code: "CAT", date: "06·10", rotate: -1 },
];

// ---- Business surface ----------------------------------------

export const BUSINESS = {
  name: "The Heron",
  town: "Narrowsburg, NY",
  ownerName: "Mira Eisen",
  joined: "May 28, 2026",
  hours: "Open today since 7:30am",
  code: "HRN",
  plan: "Founding · $79/mo",
};

export const WEEK = {
  regulars: 28, regularsDelta: "+6",
  repeatRate: 42, repeatRateDelta: "+6 pts",
  newPatrons: 41,
  perkRedemptions: 9, perkRedemptionsDelta: "+3",
  stampsIssued: 117,
};

export const PERKS = [
  {
    id: "regulars-pour",
    name: "The Regular's Pour",
    description: "Two more visits, on the house",
    threshold: 5,
    active: true,
    redemptions: 9, eligible: 14,
    note: "Best perk you've run — 64% redemption rate.",
  },
  {
    id: "save-shelf",
    name: "Save a seat at the window",
    description: "10th visit gets you the slow-afternoon table",
    threshold: 10,
    active: true,
    redemptions: 2, eligible: 3,
    note: "Hard to redeem — try lowering the threshold.",
  },
  {
    id: "winter-pour",
    name: "Winter mug, on us",
    description: "Hot drink, your fifth visit Nov–Apr",
    threshold: 5,
    active: false,
    note: "Starts when winter tier turns on.",
  },
];

export const REGULARS = [
  { initials: "MR", name: "Maya R.", town: "NYC weekender", visits: 5, since: "May 31", trend: "up" },
  { initials: "AT", name: "Alex T.", town: "Narrowsburg local", visits: 9, since: "Apr 18", trend: "up" },
  { initials: "JL", name: "Jess L.", town: "NYC weekender", visits: 3, since: "Jun 02", trend: "new" },
  { initials: "DH", name: "Dan H.", town: "Honesdale, PA", visits: 4, since: "May 24", trend: "flat" },
  { initials: "KC", name: "Kim C.", town: "Eldred local", visits: 7, since: "Apr 30", trend: "up" },
  { initials: "MT", name: "Mateo T.", town: "Brooklyn", visits: 2, since: "Jun 04", trend: "new" },
];
