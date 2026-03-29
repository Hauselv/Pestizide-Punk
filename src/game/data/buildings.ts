import type { BuildingDefinition, DistrictSlot } from "../types";

export const districtSlots: DistrictSlot[] = [
  { id: "north", label: "North Stack", x: 50, y: 10 },
  { id: "north-east", label: "East Vent", x: 78, y: 22 },
  { id: "east", label: "Relay Deck", x: 90, y: 50 },
  { id: "south-east", label: "Sludge Gate", x: 78, y: 78 },
  { id: "south", label: "Recovery Bay", x: 50, y: 90 },
  { id: "south-west", label: "Filter Yard", x: 22, y: 78 },
  { id: "west", label: "Cargo Spine", x: 10, y: 50 },
  { id: "north-west", label: "Lab Spur", x: 22, y: 22 }
];

export const buildingDefinitions: BuildingDefinition[] = [
  {
    id: "solar-array",
    name: "Solar Array",
    category: "energy",
    description: "Low-maintenance energy that weakens during toxic storms.",
    cost: { materials: 28 },
    staff: { technicians: 2 },
    output: { energy: 2 },
    unlockTech: "renewable-grid"
  },
  {
    id: "wind-turbine",
    name: "Wind Turbine",
    category: "energy",
    description: "Reliable trickle power with modest technician demand.",
    cost: { materials: 32 },
    staff: { technicians: 2 },
    output: { energy: 3 },
    unlockTech: "renewable-grid"
  },
  {
    id: "scrap-foundry",
    name: "Scrap Foundry",
    category: "production",
    description: "Refines scavenged scrap into reusable industrial stock.",
    cost: { materials: 22, energy: 4 },
    staff: { workers: 4 },
    upkeep: { energy: 1 },
    output: { materials: 2 }
  },
  {
    id: "biomass-processor",
    name: "Biomass Processor",
    category: "production",
    description: "Renders mutant biomass into chemical feedstock.",
    cost: { materials: 18 },
    staff: { workers: 3, technicians: 1 },
    upkeep: { energy: 1, biomass: 1 },
    output: { feedstock: 2 }
  },
  {
    id: "pesticide-plant",
    name: "Pesticide Plant",
    category: "production",
    description: "Synthesizes compounds for clearing sectors and repelling swarms.",
    cost: { materials: 26, feedstock: 4 },
    staff: { workers: 2, technicians: 2 },
    upkeep: { energy: 1, water: 1, feedstock: 1 },
    output: { pesticides: 2 },
    unlockTech: "basic-pesticides"
  },
  {
    id: "field-lab",
    name: "Field Lab",
    category: "research",
    description: "Turns field samples and sector data into research gains.",
    cost: { materials: 20 },
    staff: { researchers: 3 },
    upkeep: { energy: 1 },
    output: { research: 2 }
  },
  {
    id: "spray-tower",
    name: "Spray Tower",
    category: "defense",
    description: "Consumes pesticides to reduce swarm and overgrowth pressure.",
    cost: { materials: 24 },
    staff: { rangers: 2, technicians: 1 },
    upkeep: { energy: 1, pesticides: 1 },
    hazardMitigation: { infestation: 2, toxicity: 1 },
    unlockTech: "spray-towers"
  },
  {
    id: "worker-barracks",
    name: "Worker Barracks",
    category: "population",
    description: "Compact steel housing for incoming labor cohorts.",
    cost: { materials: 18 },
    staff: {},
    output: { food: -1 }
  },
  {
    id: "water-purifier",
    name: "Water Purifier",
    category: "population",
    description: "Cleans runoff into drinking water and processing water.",
    cost: { materials: 22 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { energy: 1 },
    output: { water: 3 }
  },
  {
    id: "fungal-greenhouse",
    name: "Fungal Greenhouse",
    category: "population",
    description: "Produces food reliably, but strains water reserves.",
    cost: { materials: 22 },
    staff: { workers: 3 },
    upkeep: { water: 1, energy: 1 },
    output: { food: 3 },
    unlockTech: "fungal-cultivation"
  },
  {
    id: "clinic",
    name: "Clinic",
    category: "medicine",
    description: "Reduces contamination and softens hazard incidents.",
    cost: { materials: 20, water: 2 },
    staff: { researchers: 1, technicians: 1 },
    upkeep: { energy: 1, water: 1 },
    hazardMitigation: { toxicity: 1, spores: 1 },
    unlockTech: "field-clinic"
  },
  {
    id: "gear-depot",
    name: "Gear Depot",
    category: "medicine",
    description: "Assembles and maintains protective kits for crews.",
    cost: { materials: 18, feedstock: 2 },
    staff: { technicians: 2 },
    upkeep: { energy: 1, feedstock: 1 },
    output: { gear: 2 },
    unlockTech: "filter-masks"
  },
  {
    id: "dispatch-office",
    name: "Dispatch Office",
    category: "logistics",
    description: "Improves expedition turnaround and unlocks outpost control.",
    cost: { materials: 24 },
    staff: { rangers: 1, technicians: 1 },
    upkeep: { energy: 1 }
  },
  {
    id: "air-filter-station",
    name: "Air Filter Station",
    category: "waste",
    description: "Scrubs city air to lower ambient spore and toxicity pressure.",
    cost: { materials: 26, feedstock: 2 },
    staff: { technicians: 2 },
    upkeep: { energy: 1, feedstock: 1 },
    hazardMitigation: { toxicity: 2, spores: 2 },
    unlockTech: "detox-protocols"
  }
];

export const startingBuildings = [
  { slotId: "north-west", buildingId: "field-lab", enabled: true, level: 1 },
  { slotId: "west", buildingId: "scrap-foundry", enabled: true, level: 1 },
  { slotId: "south-west", buildingId: "water-purifier", enabled: true, level: 1 },
  { slotId: "south", buildingId: "worker-barracks", enabled: true, level: 1 }
];


