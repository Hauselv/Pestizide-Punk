import type { ResourceDefinition } from "../types";

export const resourceDefinitions: ResourceDefinition[] = [
  { id: "energy", label: "Energy", short: "MW", color: "#f3b34c" },
  { id: "water", label: "Water", short: "m3", color: "#77c7ff" },
  { id: "food", label: "Food", short: "r", color: "#d6d77f" },
  { id: "materials", label: "Materials", short: "u", color: "#c1a07a" },
  { id: "biomass", label: "Biomass", short: "kg", color: "#7abf51" },
  { id: "feedstock", label: "Feedstock", short: "L", color: "#76dfc3" },
  { id: "pesticides", label: "Pesticides", short: "L", color: "#d95f40" },
  { id: "research", label: "Research", short: "pts", color: "#9dc6ff" },
  { id: "gear", label: "Protective Gear", short: "kits", color: "#d8c8ff" }
];
