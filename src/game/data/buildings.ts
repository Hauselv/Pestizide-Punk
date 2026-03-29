import type { BuildingDefinition, DistrictSlot } from "../types";

export const districtSlots: DistrictSlot[] = [
  { id: "north", label: "North Stack", x: 50, y: 10, unlockTier: 1 },
  { id: "north-east", label: "East Vent", x: 78, y: 22, unlockTier: 1 },
  { id: "east", label: "Relay Deck", x: 90, y: 50, unlockTier: 1 },
  { id: "south-east", label: "Sludge Gate", x: 78, y: 78, unlockTier: 1 },
  { id: "south", label: "Recovery Bay", x: 50, y: 90, unlockTier: 1 },
  { id: "south-west", label: "Filter Yard", x: 22, y: 78, unlockTier: 1 },
  { id: "west", label: "Cargo Spine", x: 10, y: 50, unlockTier: 1 },
  { id: "north-west", label: "Lab Spur", x: 22, y: 22, unlockTier: 1 },
  { id: "top-crown", label: "Crown Array", x: 50, y: 1.5, unlockTier: 2 },
  { id: "bottom-crown", label: "Ground Shield", x: 50, y: 98.5, unlockTier: 2 },
  { id: "east-bastion", label: "East Bastion", x: 97.2, y: 50, unlockTier: 3 },
  { id: "west-bastion", label: "West Bastion", x: 2.8, y: 50, unlockTier: 3 }
];

export const buildingDefinitions: BuildingDefinition[] = [
  {
    id: "solar-array",
    name: "Solar Array",
    category: "energy",
    description: "Clean daytime generation with weak storm resilience.",
    cost: { materials: 24, glass: 4 },
    staff: { technicians: 2 },
    output: { power: 2 },
    doctrineTags: ["clean"],
    unlockTech: "renewable-grid",
    upgradeOptions: [
      {
        id: "reflective-canopy",
        name: "Reflective Canopy",
        description: "Adds treated glass fins for a cleaner but glass-hungry output bump.",
        cost: { materials: 8, glass: 3 },
        output: { power: 1.5 },
        doctrineTags: ["clean", "engineered"]
      },
      {
        id: "storm-buffering",
        name: "Storm Buffering",
        description: "Sacrifices raw yield to keep the array steadier through toxic weather.",
        cost: { materials: 6, feedstock: 1 },
        output: { power: 0.5 },
        storageCapacity: { power: 12 },
        doctrineTags: ["resilient", "storage"]
      }
    ]
  },
  {
    id: "wind-turbine",
    name: "Wind Turbine",
    category: "energy",
    description: "Stable renewable power that pairs well with storage.",
    cost: { materials: 30, glass: 2 },
    staff: { technicians: 2 },
    output: { power: 3 },
    doctrineTags: ["clean", "resilient"],
    unlockTech: "renewable-grid",
    upgradeOptions: [
      {
        id: "long-blade-set",
        name: "Long-Blade Set",
        description: "Higher peak generation with more maintenance drag.",
        cost: { materials: 10, glass: 1 },
        output: { power: 2 },
        upkeep: { materials: 0.5 },
        doctrineTags: ["clean", "engineered"]
      },
      {
        id: "sealed-bearings",
        name: "Sealed Bearings",
        description: "Less spectacular output, but the machine endures dirty winds better.",
        cost: { materials: 8, feedstock: 1 },
        output: { power: 1 },
        storageCapacity: { power: 8 },
        doctrineTags: ["resilient", "storage"]
      }
    ]
  },
  {
    id: "coal-boiler-plant",
    name: "Coal Boiler Plant",
    category: "energy",
    description: "Heavy baseload output at the cost of sustained pollution.",
    cost: { materials: 34, glass: 2 },
    staff: { workers: 2, technicians: 2 },
    upkeep: { water: 1, coal: 1 },
    output: { power: 6 },
    emissions: 0.55,
    wasteOutput: { pollution: 0.6 },
    doctrineTags: ["fossil", "radical"],
    unlockTech: "coal-combustion",
    upgradeOptions: [
      {
        id: "throughput-furnace",
        name: "Throughput Furnace",
        description: "Pushes grim industrial tempo at the expense of even dirtier exhaust.",
        cost: { materials: 10, coal: 2 },
        output: { power: 3 },
        upkeep: { coal: 1 },
        emissions: 0.28,
        wasteOutput: { pollution: 0.35 },
        doctrineTags: ["fossil", "radical"]
      },
      {
        id: "ash-scrubbers",
        name: "Ash Scrubbers",
        description: "Cuts the worst fallout while keeping coal online as dependable baseload.",
        cost: { materials: 12, glass: 2 },
        output: { power: 1 },
        emissions: -0.18,
        wasteOutput: { pollution: -0.2 },
        doctrineTags: ["fossil", "resilient"]
      }
    ]
  },
  {
    id: "biomass-gasifier",
    name: "Biomass Gasifier",
    category: "energy",
    description: "Burns processed organics into power and chemical byproducts.",
    cost: { materials: 26, feedstock: 2 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { biomass: 2 },
    output: { power: 4, feedstock: 1 },
    emissions: 0.18,
    wasteOutput: { pollution: 0.18 },
    doctrineTags: ["bio", "resilient"],
    unlockTech: "biomass-gasification",
    upgradeOptions: [
      {
        id: "digestate-loop",
        name: "Digestate Loop",
        description: "Feeds residue back into safer nutrient recovery.",
        cost: { materials: 8, water: 2 },
        output: { fertilizer: 1, feedstock: 1 },
        doctrineTags: ["bio", "clean"]
      },
      {
        id: "pyrolysis-burn",
        name: "Pyrolysis Burn",
        description: "Turns the gasifier into a much harsher but stronger conversion core.",
        cost: { materials: 10, oil: 1 },
        output: { power: 2, feedstock: 1 },
        emissions: 0.2,
        wasteOutput: { pollution: 0.25 },
        doctrineTags: ["bio", "radical"]
      }
    ]
  },
  {
    id: "redox-battery-bank",
    name: "Redox Battery Bank",
    category: "energy",
    description: "Chemical storage that cushions renewable dips and toxic storms.",
    cost: { materials: 20, glass: 6, feedstock: 2 },
    staff: { technicians: 2 },
    upkeep: { power: 1 },
    output: { power: 1 },
    storageCapacity: { power: 30 },
    doctrineTags: ["clean", "storage"],
    unlockTech: "redox-batteries",
    upgradeOptions: [
      {
        id: "deep-cells",
        name: "Deep Cells",
        description: "Adds more tank volume for a larger reserve envelope.",
        cost: { materials: 8, glass: 4 },
        storageCapacity: { power: 24 },
        doctrineTags: ["clean", "storage"]
      },
      {
        id: "fast-cycling",
        name: "Fast Cycling",
        description: "Turns storage into a sharper response tool with slightly higher drain.",
        cost: { materials: 8, feedstock: 2 },
        output: { power: 1.5 },
        upkeep: { power: 0.5 },
        doctrineTags: ["engineered", "storage"]
      }
    ]
  },
  {
    id: "scrap-foundry",
    name: "Scrap Foundry",
    category: "production",
    description: "Refines scavenged scrap into reusable industrial stock.",
    cost: { materials: 22, power: 4 },
    staff: { workers: 4 },
    upkeep: { power: 1 },
    output: { materials: 2 },
    unlockTech: "basic-refining",
    upgradeOptions: [
      {
        id: "recovery-line",
        name: "Recovery Line",
        description: "Adds sorting and salvage recovery for cleaner material efficiency.",
        cost: { materials: 8, glass: 2 },
        output: { materials: 1, glass: 0.5 },
        doctrineTags: ["clean", "resilient"]
      },
      {
        id: "throughput-smelter",
        name: "Throughput Smelter",
        description: "A hotter line that pushes more stock through with dirtier side effects.",
        cost: { materials: 8, coal: 1 },
        output: { materials: 2 },
        upkeep: { power: 1 },
        emissions: 0.14,
        wasteOutput: { pollution: 0.16 },
        doctrineTags: ["synthetic", "radical"]
      }
    ]
  },
  {
    id: "glassworks",
    name: "Glassworks",
    category: "production",
    description: "Turns salvage and heat into industrial glass for clean-tech systems.",
    cost: { materials: 20 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { power: 1, materials: 1 },
    output: { glass: 2 },
    doctrineTags: ["clean"],
    unlockTech: "industrial-ceramics"
  },
  {
    id: "compost-yard",
    name: "Compost Yard",
    category: "production",
    description: "Low-risk bio fertilizer line built from waste biomass.",
    cost: { materials: 16 },
    staff: { workers: 2 },
    upkeep: { biomass: 1, water: 1 },
    output: { fertilizer: 2 },
    doctrineTags: ["bio", "clean"],
    unlockTech: "bio-fertilizer",
    upgradeOptions: [
      {
        id: "microbe-bed",
        name: "Microbe Bed",
        description: "Improves conversion while keeping the line biologically gentle.",
        cost: { materials: 6, water: 1 },
        output: { fertilizer: 1, food: 0.5 },
        doctrineTags: ["bio", "clean"]
      },
      {
        id: "accelerant-mix",
        name: "Accelerant Mix",
        description: "Speeds throughput with hotter chemistry and sharper runoff.",
        cost: { materials: 8, feedstock: 1 },
        output: { fertilizer: 2 },
        emissions: 0.08,
        wasteOutput: { pollution: 0.12 },
        doctrineTags: ["synthetic", "radical"]
      }
    ]
  },
  {
    id: "synthetic-fertilizer-plant",
    name: "Synthetic Fertilizer Plant",
    category: "production",
    description: "Aggressive high-output fertilizer synthesis with chemical fallout.",
    cost: { materials: 24, feedstock: 2 },
    staff: { workers: 2, technicians: 2 },
    upkeep: { power: 1, oil: 1, feedstock: 1 },
    output: { fertilizer: 4 },
    emissions: 0.32,
    wasteOutput: { pollution: 0.35 },
    doctrineTags: ["synthetic", "radical"],
    unlockTech: "synthetic-fertilizer"
  },
  {
    id: "pesticide-plant",
    name: "Pesticide Plant",
    category: "production",
    description: "Synthesizes compounds for clearing sectors and repelling swarms.",
    cost: { materials: 26, feedstock: 4 },
    staff: { workers: 2, technicians: 2 },
    upkeep: { power: 1, water: 1, feedstock: 1 },
    output: { pesticides: 3 },
    doctrineTags: ["chemical"],
    pestControlTags: ["chemical"],
    unlockTech: "basic-pesticides",
    upgradeOptions: [
      {
        id: "targeted-sprayers",
        name: "Targeted Sprayers",
        description: "Leans toward precision application and better field safety.",
        cost: { materials: 8, glass: 1 },
        output: { pesticides: 1 },
        hazardMitigation: { infestation: 1 },
        doctrineTags: ["chemical", "clean"]
      },
      {
        id: "persistent-systemics",
        name: "Persistent Systemics",
        description: "Brutally effective compounds that linger where they were never invited.",
        cost: { materials: 8, oil: 1 },
        output: { pesticides: 2 },
        emissions: 0.16,
        wasteOutput: { pollution: 0.22 },
        doctrineTags: ["synthetic", "radical"]
      }
    ]
  },
  {
    id: "field-lab",
    name: "Field Lab",
    category: "research",
    description: "Turns field samples and sector data into research gains.",
    cost: { materials: 20 },
    staff: { researchers: 3 },
    upkeep: { power: 1 },
    output: { research: 2 },
    upgradeOptions: [
      {
        id: "applied-analytics",
        name: "Applied Analytics",
        description: "Pushes a harder data cadence for faster industrial answers.",
        cost: { materials: 8, glass: 1 },
        output: { research: 2 },
        upkeep: { power: 1 },
        doctrineTags: ["engineered", "synthetic"]
      },
      {
        id: "bio-survey-wing",
        name: "Bio Survey Wing",
        description: "Shifts the lab toward ecological adaptation and safer field learning.",
        cost: { materials: 6, biomass: 1 },
        output: { research: 1, pesticides: 0.5 },
        doctrineTags: ["bio", "resilient"]
      }
    ]
  },
  {
    id: "beneficial-fungi-lab",
    name: "Beneficial Fungi Lab",
    category: "research",
    description: "Breeds useful fungi for soft control of spores and nests.",
    cost: { materials: 22, glass: 2 },
    staff: { researchers: 2, technicians: 1 },
    upkeep: { power: 1, biomass: 1, water: 1 },
    output: { pesticides: 1, research: 1 },
    hazardMitigation: { spores: 2, infestation: 1 },
    doctrineTags: ["bio"],
    pestControlTags: ["bio"],
    unlockTech: "beneficial-fungi"
  },
  {
    id: "worker-barracks",
    name: "Worker Barracks",
    category: "population",
    description: "Compact steel housing for incoming labor cohorts.",
    cost: { materials: 18 },
    staff: {},
    doctrineTags: ["resilient"]
  },
  {
    id: "water-purifier",
    name: "Water Purifier",
    category: "population",
    description: "Cleans runoff into drinking water and process water.",
    cost: { materials: 22 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { power: 1 },
    output: { water: 3 },
    unlockTech: "water-purification",
    upgradeOptions: [
      {
        id: "membrane-stack",
        name: "Membrane Stack",
        description: "Cleaner water at the cost of a more power-hungry treatment line.",
        cost: { materials: 8, glass: 2 },
        output: { water: 2 },
        upkeep: { power: 1 },
        doctrineTags: ["clean", "engineered"]
      },
      {
        id: "flocculation-dosing",
        name: "Flocculation Dosing",
        description: "Chemical treatment boosts throughput but drags synthetic dependence behind it.",
        cost: { materials: 8, feedstock: 1 },
        output: { water: 3 },
        emissions: 0.06,
        wasteOutput: { pollution: 0.08 },
        doctrineTags: ["chemical", "synthetic"]
      }
    ]
  },
  {
    id: "greenhouse",
    name: "Greenhouse",
    category: "population",
    description: "Steady low-risk crop growth under controlled glass roofs.",
    cost: { materials: 20, glass: 4 },
    staff: { workers: 3 },
    upkeep: { power: 1, water: 1, fertilizer: 1 },
    output: { food: 4 },
    doctrineTags: ["clean"],
    unlockTech: "greenhouse-cropping",
    upgradeOptions: [
      {
        id: "sterile-loop",
        name: "Sterile Nutrient Loop",
        description: "More stable food output with a stronger engineered support load.",
        cost: { materials: 8, glass: 2 },
        output: { food: 2 },
        upkeep: { power: 1, water: 1 },
        doctrineTags: ["clean", "engineered"]
      },
      {
        id: "accelerant-dosing",
        name: "Accelerant Dosing",
        description: "Turns the greenhouse into a sharper, dirtier growth machine.",
        cost: { materials: 8, feedstock: 1 },
        output: { food: 3 },
        upkeep: { fertilizer: 1 },
        emissions: 0.08,
        wasteOutput: { pollution: 0.12 },
        doctrineTags: ["synthetic", "radical"]
      }
    ]
  },
  {
    id: "insect-protein-farm",
    name: "Insect Protein Farm",
    category: "population",
    description: "Efficient protein production fed from waste biomass.",
    cost: { materials: 20 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { power: 1, biomass: 1 },
    output: { food: 5, fertilizer: 1 },
    doctrineTags: ["bio", "resilient"],
    unlockTech: "insect-protein",
    upgradeOptions: [
      {
        id: "black-soldier-loop",
        name: "Black Soldier Loop",
        description: "Doubles down on closed-loop protein and residue recovery.",
        cost: { materials: 8, biomass: 2 },
        output: { food: 2, fertilizer: 1 },
        doctrineTags: ["bio", "resilient"]
      },
      {
        id: "feed-accelerants",
        name: "Feed Accelerants",
        description: "Raises protein throughput with a synthetic tail in the waste stream.",
        cost: { materials: 8, feedstock: 1 },
        output: { food: 3 },
        emissions: 0.05,
        wasteOutput: { pollution: 0.09 },
        doctrineTags: ["synthetic", "engineered"]
      }
    ]
  },
  {
    id: "aquaponics-hall",
    name: "Aquaponics Hall",
    category: "population",
    description: "Balanced water-food loop with strong yields but high infrastructure load.",
    cost: { materials: 26, glass: 3 },
    staff: { workers: 2, technicians: 2 },
    upkeep: { power: 2, water: 1, feedstock: 1 },
    output: { food: 5 },
    doctrineTags: ["clean", "engineered"],
    unlockTech: "aquaponics"
  },
  {
    id: "mushroom-vault",
    name: "Mushroom Vault",
    category: "population",
    description: "Stable underground fungal protein with modest chemistry needs.",
    cost: { materials: 18 },
    staff: { workers: 3 },
    upkeep: { power: 1, water: 1, biomass: 1 },
    output: { food: 4 },
    doctrineTags: ["bio", "resilient"],
    unlockTech: "fungal-cultivation"
  },
  {
    id: "gvo-crop-lab",
    name: "GVO Crop Lab",
    category: "population",
    description: "Maximum crop throughput with engineered strains and sharp systemic costs.",
    cost: { materials: 28, glass: 4, feedstock: 2 },
    staff: { workers: 2, researchers: 1, technicians: 1 },
    upkeep: { power: 2, water: 2, fertilizer: 2 },
    output: { food: 7 },
    emissions: 0.08,
    wasteOutput: { pollution: 0.12 },
    doctrineTags: ["engineered", "synthetic"],
    unlockTech: "gvo-organisms"
  },
  {
    id: "spray-tower",
    name: "Spray Tower",
    category: "defense",
    description: "Consumes pesticides to reduce swarm and overgrowth pressure.",
    cost: { materials: 24 },
    staff: { rangers: 2, technicians: 1 },
    upkeep: { power: 1, pesticides: 1 },
    hazardMitigation: { infestation: 2, toxicity: 1 },
    doctrineTags: ["chemical"],
    pestControlTags: ["chemical"],
    unlockTech: "spray-towers"
  },
  {
    id: "fumigation-tower",
    name: "Fumigation Tower",
    category: "defense",
    description: "Violent area suppression with rapid results and heavy fallout.",
    cost: { materials: 28, oil: 2 },
    staff: { rangers: 2, technicians: 1 },
    upkeep: { power: 1, pesticides: 2, oil: 1 },
    hazardMitigation: { infestation: 4, toxicity: 1 },
    emissions: 0.4,
    wasteOutput: { pollution: 0.4 },
    doctrineTags: ["radical", "synthetic"],
    pestControlTags: ["industrial", "radical"],
    unlockTech: "broad-fumigation"
  },
  {
    id: "clinic",
    name: "Clinic",
    category: "medicine",
    description: "Reduces contamination and softens hazard incidents.",
    cost: { materials: 20, water: 2 },
    staff: { researchers: 1, technicians: 1 },
    upkeep: { power: 1, water: 1 },
    hazardMitigation: { toxicity: 1, spores: 1 },
    protectionOutput: { environmental: 1 },
    unlockTech: "field-clinic"
  },
  {
    id: "gear-depot",
    name: "Gear Depot",
    category: "medicine",
    description: "Assembles and maintains low-tier protective kits for crews.",
    cost: { materials: 18, feedstock: 2 },
    staff: { technicians: 2 },
    upkeep: { power: 1, feedstock: 1 },
    output: { gear: 2 },
    protectionOutput: { respiratory: 1, chemical: 1 },
    doctrineTags: ["resilient"],
    unlockTech: "filter-masks",
    upgradeOptions: [
      {
        id: "rapid-kit-line",
        name: "Rapid Kit Line",
        description: "More volume for a growing workforce, but with higher consumable appetite.",
        cost: { materials: 8, feedstock: 1 },
        output: { gear: 2 },
        upkeep: { feedstock: 1 },
        doctrineTags: ["engineered", "resilient"]
      },
      {
        id: "papr-retrofit",
        name: "PAPR Retrofit",
        description: "Fewer kits, much better respiratory coverage for toxic sectors.",
        cost: { materials: 10, glass: 2 },
        output: { gear: 1 },
        upkeep: { power: 1 },
        protectionOutput: { respiratory: 2, chemical: 1 },
        doctrineTags: ["clean", "resilient"]
      }
    ]
  },
  {
    id: "hazmat-locker",
    name: "Hazmat Locker",
    category: "medicine",
    description: "Heavy-duty protection suites for high-risk industrial and radiological work.",
    cost: { materials: 24, glass: 4, feedstock: 2 },
    staff: { technicians: 2 },
    upkeep: { power: 1, glass: 1 },
    output: { gear: 1 },
    protectionOutput: { chemical: 2, radiation: 2, environmental: 1 },
    doctrineTags: ["resilient"],
    unlockTech: "hazmat-lockers"
  },
  {
    id: "decon-showers",
    name: "Decon Showers",
    category: "medicine",
    description: "Consumable-heavy decontamination that keeps exposure from spiraling.",
    cost: { materials: 20, glass: 2 },
    staff: { workers: 1, technicians: 1 },
    upkeep: { power: 1, water: 1 },
    hazardMitigation: { toxicity: 2, spores: 1, radiation: 1 },
    protectionOutput: { chemical: 1, radiation: 1 },
    doctrineTags: ["clean", "resilient"],
    unlockTech: "decon-routines"
  },
  {
    id: "dispatch-office",
    name: "Dispatch Office",
    category: "logistics",
    description: "Improves expedition turnaround and unlocks outpost control.",
    cost: { materials: 24 },
    staff: { rangers: 1, technicians: 1 },
    upkeep: { power: 1 },
    unlockTech: "relay-network"
  },
  {
    id: "air-filter-station",
    name: "Air Filter Station",
    category: "waste",
    description: "Scrubs city air to lower ambient spore and toxicity pressure.",
    cost: { materials: 26, feedstock: 2, glass: 2 },
    staff: { technicians: 2 },
    upkeep: { power: 1, feedstock: 1 },
    hazardMitigation: { toxicity: 2, spores: 2 },
    protectionOutput: { respiratory: 1 },
    doctrineTags: ["clean"],
    unlockTech: "detox-protocols"
  },
  {
    id: "oil-generator",
    name: "Oil Generator",
    category: "energy",
    description: "Fast, dirty emergency generation for spikes and unstable grids.",
    cost: { materials: 26, oil: 2 },
    staff: { workers: 1, technicians: 2 },
    upkeep: { oil: 1 },
    output: { power: 7 },
    emissions: 0.42,
    wasteOutput: { pollution: 0.45 },
    doctrineTags: ["fossil", "radical"],
    unlockTech: "oil-generation"
  },
  {
    id: "geothermal-well",
    name: "Geothermal Well",
    category: "energy",
    description: "Stable deep heat extraction with high upfront engineering cost.",
    cost: { materials: 34, glass: 4, feedstock: 2 },
    staff: { technicians: 3 },
    upkeep: { power: 1, water: 1 },
    output: { power: 6 },
    doctrineTags: ["clean", "engineered"],
    unlockTech: "geothermal-tapping"
  },
  {
    id: "micro-hydro-station",
    name: "Micro Hydro Station",
    category: "energy",
    description: "Steady water-linked generation recovered from drowned infrastructure.",
    cost: { materials: 28, glass: 2 },
    staff: { workers: 1, technicians: 2 },
    upkeep: { water: 1 },
    output: { power: 5 },
    doctrineTags: ["clean", "resilient"],
    unlockTech: "micro-hydro"
  },
  {
    id: "steam-accumulator",
    name: "Steam Accumulator",
    category: "energy",
    description: "Early pressure storage that cushions industrial spikes.",
    cost: { materials: 24, glass: 2 },
    staff: { technicians: 1 },
    upkeep: { power: 0.5, water: 0.5 },
    output: { power: 1 },
    storageCapacity: { power: 20 },
    doctrineTags: ["storage", "resilient"],
    unlockTech: "steam-accumulators"
  },
  {
    id: "waste-heat-recovery-unit",
    name: "Waste Heat Recovery Unit",
    category: "energy",
    description: "Turns heavy industrial heat into cleaner auxiliary output.",
    cost: { materials: 22, glass: 2 },
    staff: { technicians: 2 },
    upkeep: { power: 1 },
    output: { power: 3, water: 1 },
    doctrineTags: ["resilient", "engineered"],
    unlockTech: "waste-heat-recovery"
  },
  {
    id: "biogas-digester",
    name: "Biogas Digester",
    category: "energy",
    description: "Converts wet waste and biomass into gentler fuel and fertilizer.",
    cost: { materials: 22, biomass: 2 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { biomass: 2, water: 1 },
    output: { power: 4, fertilizer: 1 },
    emissions: 0.08,
    wasteOutput: { pollution: 0.08 },
    doctrineTags: ["bio", "clean"],
    unlockTech: "biogas-digestion"
  },
  {
    id: "external-fields",
    name: "External Fields",
    category: "population",
    description: "Open-air reclaimed fields with high yield and high exposure to weather and threats.",
    cost: { materials: 18, fertilizer: 2 },
    staff: { workers: 4, rangers: 1 },
    upkeep: { water: 2, fertilizer: 1 },
    output: { food: 6 },
    doctrineTags: ["engineered", "resilient"],
    unlockTech: "external-agriculture"
  },
  {
    id: "fish-tanks",
    name: "Fish Tanks",
    category: "population",
    description: "Protected fish protein under stable water and power demand.",
    cost: { materials: 22, glass: 2 },
    staff: { workers: 2, technicians: 1 },
    upkeep: { power: 1, water: 2, feedstock: 1 },
    output: { food: 5 },
    doctrineTags: ["clean", "resilient"],
    unlockTech: "fish-farming"
  },
  {
    id: "algae-bioreactor",
    name: "Algae Bioreactor",
    category: "population",
    description: "Dense algae loop that can flex between calories and biomass support.",
    cost: { materials: 24, glass: 4 },
    staff: { technicians: 2, researchers: 1 },
    upkeep: { power: 2, water: 2 },
    output: { food: 4, biomass: 2 },
    doctrineTags: ["bio", "engineered"],
    unlockTech: "algae-cultivation"
  },
  {
    id: "seed-vault",
    name: "Seed Vault",
    category: "population",
    description: "Buffers crop failure and stabilizes agrarian output.",
    cost: { materials: 20, glass: 2 },
    staff: { workers: 1, researchers: 1 },
    upkeep: { power: 1, water: 1 },
    output: { food: 2, fertilizer: 1 },
    storageCapacity: { food: 18 },
    doctrineTags: ["clean", "resilient", "storage"],
    unlockTech: "seed-vaults"
  },
  {
    id: "mycoprotein-vats",
    name: "Mycoprotein Vats",
    category: "population",
    description: "Industrial fungal protein with strong utility demand but strong output.",
    cost: { materials: 26, glass: 3, feedstock: 1 },
    staff: { technicians: 2, researchers: 1 },
    upkeep: { power: 2, water: 2, biomass: 1 },
    output: { food: 6 },
    doctrineTags: ["bio", "engineered"],
    unlockTech: "mycoprotein-vats"
  },
  {
    id: "pollinator-dome",
    name: "Pollinator Dome",
    category: "population",
    description: "Bio-oriented yield support for reclaimed fields and controlled farms.",
    cost: { materials: 18, glass: 3 },
    staff: { workers: 1, researchers: 1 },
    upkeep: { power: 1, water: 1, biomass: 1 },
    output: { food: 3, fertilizer: 1 },
    doctrineTags: ["bio", "clean"],
    unlockTech: "pollinator-domes"
  },
  {
    id: "pheromone-hub",
    name: "Pheromone Hub",
    category: "defense",
    description: "Slow, targeted lure control for swarm pressure and nest drift.",
    cost: { materials: 20, glass: 1 },
    staff: { rangers: 1, researchers: 1 },
    upkeep: { power: 1, biomass: 1 },
    hazardMitigation: { infestation: 2, spores: 1 },
    doctrineTags: ["bio", "clean"],
    pestControlTags: ["bio"],
    unlockTech: "pheromone-lures"
  },
  {
    id: "soil-sterilizer-rig",
    name: "Soil Sterilizer Rig",
    category: "defense",
    description: "Harsh clearance line that trades speed for ecological fallout.",
    cost: { materials: 28, oil: 1 },
    staff: { rangers: 2, technicians: 1 },
    upkeep: { power: 1, oil: 1, pesticides: 2 },
    hazardMitigation: { infestation: 3, toxicity: 2 },
    emissions: 0.24,
    wasteOutput: { pollution: 0.32 },
    doctrineTags: ["radical", "synthetic"],
    pestControlTags: ["industrial", "radical"],
    unlockTech: "soil-sterilization"
  },
  {
    id: "cartridge-workshop",
    name: "Cartridge Workshop",
    category: "medicine",
    description: "Maintains filter cartridge supply for prolonged respiratory protection.",
    cost: { materials: 20, glass: 2, feedstock: 1 },
    staff: { technicians: 2 },
    upkeep: { power: 1, feedstock: 1 },
    output: { gear: 1 },
    protectionOutput: { respiratory: 2 },
    doctrineTags: ["resilient"],
    unlockTech: "filter-cartridges"
  },
  {
    id: "dosimetry-post",
    name: "Dosimetry Post",
    category: "medicine",
    description: "Tracks exposure and lowers radiological operating risk across the colony.",
    cost: { materials: 18, glass: 2 },
    staff: { technicians: 1, researchers: 1 },
    upkeep: { power: 1 },
    hazardMitigation: { radiation: 2 },
    protectionOutput: { radiation: 2 },
    doctrineTags: ["resilient", "engineered"],
    unlockTech: "dosimeter-badges"
  },
  {
    id: "vehicle-seal-bay",
    name: "Vehicle Seal Bay",
    category: "logistics",
    description: "Protected cabs and field seals make hazardous routes less punishing.",
    cost: { materials: 22, glass: 2, feedstock: 1 },
    staff: { technicians: 2, rangers: 1 },
    upkeep: { power: 1, feedstock: 1 },
    protectionOutput: { environmental: 1, chemical: 1 },
    doctrineTags: ["resilient", "engineered"],
    unlockTech: "vehicle-cabin-seals"
  }
];

export const startingBuildings = [
  { slotId: "north-west", buildingId: "field-lab", enabled: true, level: 1 },
  { slotId: "west", buildingId: "scrap-foundry", enabled: true, level: 1 },
  { slotId: "south-west", buildingId: "water-purifier", enabled: true, level: 1 },
  { slotId: "south", buildingId: "worker-barracks", enabled: true, level: 1 }
];


