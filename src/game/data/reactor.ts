import type { DistrictSlot, ReactorTierBonus, ReactorUpgradeDefinition } from "../types";

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

const zeroBonus: ReactorTierBonus = {
  passivePower: 0,
  researchRate: 0,
  contaminationShield: 0,
  stabilitySupport: 0,
  hazardMitigation: {}
};

export const reactorUpgradeDefinitions: ReactorUpgradeDefinition[] = [
  {
    id: "reactor-tier-2",
    tier: 2,
    name: "Containment Crown",
    description: "Reinforces the core spine with cleaner venting, broader shielding, and two new district anchor points.",
    cost: { materials: 44, glass: 6, feedstock: 2 },
    tech: ["relay-network", "filter-masks"],
    bonuses: {
      passivePower: 1.2,
      researchRate: 0.16,
      contaminationShield: 0.08,
      stabilitySupport: 0.015,
      hazardMitigation: { toxicity: 0.8, spores: 0.4 }
    },
    unlockSlotIds: ["top-crown", "bottom-crown"]
  },
  {
    id: "reactor-tier-3",
    tier: 3,
    name: "Industrial Spine Lattice",
    description: "Extends the reactor with hardened throughput manifolds, better city buffering, and another outer pair of slots.",
    cost: { materials: 62, glass: 8, feedstock: 4, power: 16 },
    tech: ["industrial-ceramics", "detox-protocols"],
    bonuses: {
      passivePower: 2.2,
      researchRate: 0.28,
      contaminationShield: 0.14,
      stabilitySupport: 0.03,
      hazardMitigation: { toxicity: 1.2, spores: 0.7, radiation: 0.4 }
    },
    unlockSlotIds: ["east-bastion", "west-bastion"]
  },
  {
    id: "reactor-tier-4",
    tier: 4,
    name: "Command Crucible",
    description: "Late-core optimization that sharpens power, forecasting, and containment without further slot growth in this pass.",
    cost: { materials: 78, glass: 12, feedstock: 6, power: 24 },
    tech: ["waste-heat-recovery", "vehicle-cabin-seals"],
    bonuses: {
      passivePower: 3.3,
      researchRate: 0.4,
      contaminationShield: 0.22,
      stabilitySupport: 0.045,
      hazardMitigation: { toxicity: 1.6, spores: 1.1, radiation: 0.8, infestation: 0.6 }
    },
    unlockSlotIds: []
  }
];

export const baseReactorUnlockedSlotIds = districtSlots.filter((slot) => (slot.unlockTier ?? 1) <= 1).map((slot) => slot.id);

export function getReactorUpgradeDefinitionById(upgradeId: string | null) {
  if (!upgradeId) return null;
  return reactorUpgradeDefinitions.find((definition) => definition.id === upgradeId) ?? null;
}

export function getReactorTierBonuses(tier: number) {
  return reactorUpgradeDefinitions
    .filter((definition) => definition.tier <= tier)
    .reduce<ReactorTierBonus>((accumulator, definition) => ({
      passivePower: accumulator.passivePower + definition.bonuses.passivePower,
      researchRate: accumulator.researchRate + definition.bonuses.researchRate,
      contaminationShield: accumulator.contaminationShield + definition.bonuses.contaminationShield,
      stabilitySupport: accumulator.stabilitySupport + definition.bonuses.stabilitySupport,
      hazardMitigation: {
        toxicity: Number(accumulator.hazardMitigation.toxicity ?? 0) + Number(definition.bonuses.hazardMitigation.toxicity ?? 0),
        spores: Number(accumulator.hazardMitigation.spores ?? 0) + Number(definition.bonuses.hazardMitigation.spores ?? 0),
        radiation: Number(accumulator.hazardMitigation.radiation ?? 0) + Number(definition.bonuses.hazardMitigation.radiation ?? 0),
        infestation: Number(accumulator.hazardMitigation.infestation ?? 0) + Number(definition.bonuses.hazardMitigation.infestation ?? 0)
      }
    }), { ...zeroBonus, hazardMitigation: {} });
}
