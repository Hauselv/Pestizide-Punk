import type { ResearchNode } from "../types";

export const researchNodes: ResearchNode[] = [
  {
    id: "scout-teams",
    name: "Scout Teams",
    branch: "Scouting",
    tier: 0,
    description: "Standardized expedition procedure for region surveys.",
    cost: 0,
    prerequisites: [],
    unlocks: ["Survey missions"],
    doctrineTags: ["resilient"]
  },
  {
    id: "water-purification",
    name: "Water Purification",
    branch: "Infrastructure",
    tier: 0,
    description: "Keeps the purifier network stable under toxic runoff.",
    cost: 0,
    prerequisites: [],
    unlocks: ["Water Purifier"],
    doctrineTags: ["clean"]
  },
  {
    id: "basic-refining",
    name: "Basic Refining",
    branch: "Industry",
    tier: 0,
    description: "Industrial discipline for feedstock and salvage processing.",
    cost: 0,
    prerequisites: [],
    unlocks: ["Scrap Foundry", "Field Lab"],
    doctrineTags: ["resilient"]
  },
  {
    id: "renewable-grid",
    name: "Renewable Grid",
    branch: "Energy",
    tier: 1,
    description: "Unlocks solar and wind support infrastructure.",
    cost: 18,
    prerequisites: ["basic-refining"],
    unlocks: ["Solar Array", "Wind Turbine"],
    doctrineTags: ["clean"]
  },
  {
    id: "coal-combustion",
    name: "Coal Combustion",
    branch: "Energy",
    tier: 1,
    description: "Reliable dirty baseload for industrial acceleration.",
    cost: 20,
    prerequisites: ["basic-refining"],
    unlocks: ["Coal Boiler Plant"],
    doctrineTags: ["fossil", "radical"]
  },
  {
    id: "greenhouse-cropping",
    name: "Greenhouse Cropping",
    branch: "Food",
    tier: 1,
    description: "Low-risk enclosed farming with glass and fertilizer support.",
    cost: 18,
    prerequisites: ["water-purification"],
    unlocks: ["Greenhouse"],
    doctrineTags: ["clean"]
  },
  {
    id: "basic-pesticides",
    name: "Basic Pesticides",
    branch: "Pest Control",
    tier: 1,
    description: "Enables chemical suppression of mutant growth and swarm pressure.",
    cost: 24,
    prerequisites: ["basic-refining"],
    unlocks: ["Pesticide Plant", "Exploit toxic regions"],
    doctrineTags: ["synthetic"]
  },
  {
    id: "filter-masks",
    name: "Filter Masks",
    branch: "Protection",
    tier: 1,
    description: "Standardized protective kits for low-tier toxic exposure.",
    cost: 22,
    prerequisites: ["basic-refining"],
    unlocks: ["Gear Depot", "Respiratory protection 1"],
    doctrineTags: ["resilient"]
  },
  {
    id: "field-clinic",
    name: "Field Clinic",
    branch: "Medicine",
    tier: 1,
    description: "Basic detox care and contamination stabilization.",
    cost: 18,
    prerequisites: ["water-purification"],
    unlocks: ["Clinic"],
    doctrineTags: ["clean", "resilient"]
  },
  {
    id: "relay-network",
    name: "Relay Network",
    branch: "Logistics",
    tier: 1,
    description: "Coordinates farther region operations and outpost control.",
    cost: 24,
    prerequisites: ["scout-teams"],
    unlocks: ["Outposts", "Dispatch Office"],
    doctrineTags: ["resilient"]
  },
  {
    id: "biomass-gasification",
    name: "Biomass Gasification",
    branch: "Energy",
    tier: 2,
    description: "Converts organics into flexible fuel and emergency power.",
    cost: 28,
    prerequisites: ["renewable-grid", "basic-pesticides"],
    unlocks: ["Biomass Gasifier"],
    doctrineTags: ["bio", "resilient"]
  },
  {
    id: "industrial-ceramics",
    name: "Industrial Ceramics",
    branch: "Industry",
    tier: 2,
    description: "Glass and refractory production for advanced infrastructure.",
    cost: 24,
    prerequisites: ["renewable-grid"],
    unlocks: ["Glassworks"],
    doctrineTags: ["clean"]
  },
  {
    id: "bio-fertilizer",
    name: "Bio Fertilizer",
    branch: "Food",
    tier: 2,
    description: "Safer nutrient loops built from compost and residue recovery.",
    cost: 24,
    prerequisites: ["greenhouse-cropping"],
    unlocks: ["Compost Yard"],
    doctrineTags: ["bio", "clean"]
  },
  {
    id: "synthetic-fertilizer",
    name: "Synthetic Fertilizer",
    branch: "Food",
    tier: 2,
    description: "Sharp yield growth with chemical burden and pollution costs.",
    cost: 30,
    prerequisites: ["coal-combustion", "basic-pesticides"],
    unlocks: ["Synthetic Fertilizer Plant"],
    doctrineTags: ["synthetic", "radical"]
  },
  {
    id: "fungal-cultivation",
    name: "Fungal Cultivation",
    branch: "Food",
    tier: 2,
    description: "Controlled fungal protein for sealed-city resilience.",
    cost: 28,
    prerequisites: ["field-clinic", "greenhouse-cropping"],
    unlocks: ["Mushroom Vault"],
    doctrineTags: ["bio", "resilient"]
  },
  {
    id: "aquaponics",
    name: "Aquaponics",
    branch: "Food",
    tier: 2,
    description: "Balanced fish-and-crop loops with strong infrastructure demand.",
    cost: 30,
    prerequisites: ["greenhouse-cropping", "relay-network"],
    unlocks: ["Aquaponics Hall"],
    doctrineTags: ["clean", "engineered"]
  },
  {
    id: "insect-protein",
    name: "Insect Protein",
    branch: "Food",
    tier: 2,
    description: "Efficient protein conversion from waste biomass.",
    cost: 26,
    prerequisites: ["bio-fertilizer"],
    unlocks: ["Insect Protein Farm"],
    doctrineTags: ["bio", "resilient"]
  },
  {
    id: "beneficial-fungi",
    name: "Beneficial Fungi",
    branch: "Pest Control",
    tier: 2,
    description: "Slow but controlled bio-suppression of spores and nest creep.",
    cost: 30,
    prerequisites: ["field-clinic", "basic-pesticides"],
    unlocks: ["Beneficial Fungi Lab"],
    doctrineTags: ["bio"]
  },
  {
    id: "spray-towers",
    name: "Spray Towers",
    branch: "Defense",
    tier: 2,
    description: "Automated chemical dispersal for perimeter defense.",
    cost: 32,
    prerequisites: ["basic-pesticides", "relay-network"],
    unlocks: ["Spray Tower"],
    doctrineTags: ["synthetic"]
  },
  {
    id: "broad-fumigation",
    name: "Broad Fumigation",
    branch: "Pest Control",
    tier: 2,
    description: "Fast-acting area denial with long-tail ecological damage.",
    cost: 34,
    prerequisites: ["spray-towers", "coal-combustion"],
    unlocks: ["Fumigation Tower"],
    doctrineTags: ["radical", "synthetic"]
  },
  {
    id: "redox-batteries",
    name: "Redox Batteries",
    branch: "Energy",
    tier: 2,
    description: "Chemical storage banks that make renewable stacks dependable.",
    cost: 30,
    prerequisites: ["renewable-grid", "industrial-ceramics"],
    unlocks: ["Redox Battery Bank"],
    doctrineTags: ["clean", "storage"]
  },
  {
    id: "detox-protocols",
    name: "Detox Protocols",
    branch: "Medicine",
    tier: 2,
    description: "Improves contamination recovery and air scrubbing.",
    cost: 30,
    prerequisites: ["field-clinic", "filter-masks"],
    unlocks: ["Air Filter Station"],
    doctrineTags: ["clean", "resilient"]
  },
  {
    id: "papr-rigs",
    name: "PAPR Rigs",
    branch: "Protection",
    tier: 2,
    description: "Powered respirator rigs for prolonged toxic work.",
    cost: 30,
    prerequisites: ["filter-masks", "industrial-ceramics"],
    unlocks: ["Respiratory protection 2"],
    doctrineTags: ["resilient"]
  },
  {
    id: "sealed-suits",
    name: "Sealed Suits",
    branch: "Protection",
    tier: 2,
    description: "High-grade hazard protection for severe regions.",
    cost: 36,
    prerequisites: ["filter-masks", "field-clinic"],
    unlocks: ["Chemical protection 2", "Environmental protection 1"],
    doctrineTags: ["resilient"]
  },
  {
    id: "gvo-organisms",
    name: "GVO Organisms",
    branch: "Food",
    tier: 3,
    description: "Engineered food strains that push yield beyond ecological comfort.",
    cost: 40,
    prerequisites: ["aquaponics", "synthetic-fertilizer"],
    unlocks: ["GVO Crop Lab"],
    doctrineTags: ["engineered", "synthetic"]
  },
  {
    id: "hazmat-lockers",
    name: "Hazmat Lockers",
    branch: "Protection",
    tier: 3,
    description: "Heavy protection kits for corrosive and radiological labor.",
    cost: 38,
    prerequisites: ["sealed-suits", "papr-rigs"],
    unlocks: ["Hazmat Locker", "Radiation protection 2"],
    doctrineTags: ["resilient"]
  },
  {
    id: "decon-routines",
    name: "Decon Routines",
    branch: "Medicine",
    tier: 3,
    description: "Consumable-heavy decontamination infrastructure for deep hazard work.",
    cost: 36,
    prerequisites: ["detox-protocols", "sealed-suits"],
    unlocks: ["Decon Showers"],
    doctrineTags: ["clean", "resilient"]
  }
];

export const startingResearch = ["scout-teams", "water-purification", "basic-refining"];
