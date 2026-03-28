import type { ResearchNode } from "../types";

export const researchNodes: ResearchNode[] = [
  {
    id: "scout-teams",
    name: "Scout Teams",
    branch: "Scouting",
    tier: 0,
    description: "Standardized expedition procedure for sector surveys.",
    cost: 0,
    prerequisites: [],
    unlocks: ["Survey missions"]
  },
  {
    id: "water-purification",
    name: "Water Purification",
    branch: "Infrastructure",
    tier: 0,
    description: "Keeps the purifier network stable under toxic runoff.",
    cost: 0,
    prerequisites: [],
    unlocks: ["Water Purifier"]
  },
  {
    id: "basic-refining",
    name: "Basic Refining",
    branch: "Chemistry",
    tier: 0,
    description: "Industrial discipline for feedstock and salvage processing.",
    cost: 0,
    prerequisites: [],
    unlocks: ["Scrap Foundry", "Biomass Processor"]
  },
  {
    id: "renewable-grid",
    name: "Renewable Grid",
    branch: "Renewables",
    tier: 1,
    description: "Unlocks wind and solar support infrastructure.",
    cost: 18,
    prerequisites: ["basic-refining"],
    unlocks: ["Solar Array", "Wind Turbine"]
  },
  {
    id: "basic-pesticides",
    name: "Basic Pesticides",
    branch: "Chemistry",
    tier: 1,
    description: "Enables chemical suppression of mutant growth and swarm pressure.",
    cost: 24,
    prerequisites: ["basic-refining"],
    unlocks: ["Pesticide Plant", "Exploit toxic sectors"]
  },
  {
    id: "filter-masks",
    name: "Filter Masks",
    branch: "Protection",
    tier: 1,
    description: "Standardized protective kits for low-tier toxic exposure.",
    cost: 22,
    prerequisites: ["basic-refining"],
    unlocks: ["Gear Depot", "Gear tier 1"]
  },
  {
    id: "field-clinic",
    name: "Field Clinic",
    branch: "Medicine",
    tier: 1,
    description: "Basic detox care and contamination stabilization.",
    cost: 18,
    prerequisites: ["water-purification"],
    unlocks: ["Clinic"]
  },
  {
    id: "relay-network",
    name: "Relay Network",
    branch: "Logistics",
    tier: 1,
    description: "Coordinates farther sector operations and outpost control.",
    cost: 24,
    prerequisites: ["scout-teams"],
    unlocks: ["Outposts", "Dispatch Office"]
  },
  {
    id: "fungal-cultivation",
    name: "Fungal Cultivation",
    branch: "Infrastructure",
    tier: 2,
    description: "Controlled food growth in chemically sealed beds.",
    cost: 28,
    prerequisites: ["field-clinic", "renewable-grid"],
    unlocks: ["Fungal Greenhouse"]
  },
  {
    id: "detox-protocols",
    name: "Detox Protocols",
    branch: "Medicine",
    tier: 2,
    description: "Improves contamination recovery and air scrubbing.",
    cost: 30,
    prerequisites: ["field-clinic", "filter-masks"],
    unlocks: ["Air Filter Station"]
  },
  {
    id: "spray-towers",
    name: "Spray Towers",
    branch: "Defense",
    tier: 2,
    description: "Automated chemical dispersal for perimeter defense.",
    cost: 32,
    prerequisites: ["basic-pesticides", "relay-network"],
    unlocks: ["Spray Tower"]
  },
  {
    id: "sealed-suits",
    name: "Sealed Suits",
    branch: "Protection",
    tier: 2,
    description: "Higher-grade hazard protection for severe sectors.",
    cost: 36,
    prerequisites: ["filter-masks", "field-clinic"],
    unlocks: ["Gear tier 2", "Secure harsh sectors"]
  }
];

export const startingResearch = ["scout-teams", "water-purification", "basic-refining"];
