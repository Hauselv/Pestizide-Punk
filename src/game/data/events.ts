import type { EventDefinition } from "../types";

export const eventDefinitions: EventDefinition[] = [
  {
    id: "toxic-storm",
    title: "Toxic Storm Front",
    description: "Charged fallout clouds roll over the city, suppressing solar yield and pushing contaminants into the air.",
    severity: "major",
    art: "/events/toxic-storm.png",
    baseDuration: 34,
    responses: [
      {
        id: "storm-bracing",
        label: "Storm Bracing",
        description: "Commit materials and crews to seal vents and brace exposed infrastructure.",
        cost: { materials: 12, power: 4 },
        mitigation: 0.56,
        immediate: { stability: 1 },
        timedModifier: { powerPenaltyOffset: 0.08 }
      },
      {
        id: "filtration-surge",
        label: "Air Filtration Surge",
        description: "Burn feedstock and filters to keep the city breathing clean through the front.",
        cost: { feedstock: 3, power: 3, gear: 1 },
        mitigation: 0.72,
        immediate: { pollution: 1.2, contamination: -1.2 },
        timedModifier: { contaminationRateOffset: -0.03 }
      },
      {
        id: "storm-ignore",
        label: "Ride It Out",
        description: "Keep output untouched now and accept the full fallout risk.",
        mitigation: 0,
        immediate: { stability: -2 }
      }
    ]
  },
  {
    id: "swarm-raid",
    title: "Swarm Pressure",
    description: "Mutant insects mass at the perimeter and probe exposed food chains for weakness.",
    severity: "major",
    art: "/events/swarm-pressure.png",
    baseDuration: 28,
    responses: [
      {
        id: "pesticide-saturation",
        label: "Pesticide Saturation",
        description: "Push broad pesticide dispersal now to break the swarm before it lands.",
        cost: { pesticides: 3, power: 2 },
        mitigation: 0.76,
        immediate: { pollution: 1.8, stability: -1 },
        timedModifier: { foodPenaltyOffset: 0.09 }
      },
      {
        id: "bio-lure-nets",
        label: "Bio Lure Nets",
        description: "Deploy bio-lures and ranger nets for a slower, cleaner interception.",
        cost: { biomass: 2, materials: 5 },
        mitigation: 0.5,
        immediate: { stability: 1 },
        timedModifier: { foodPenaltyOffset: 0.05 }
      },
      {
        id: "swarm-ignore",
        label: "Ignore Perimeter Losses",
        description: "Preserve stock now and risk heavier food and morale damage.",
        mitigation: 0,
        immediate: { stability: -3, contamination: 1 }
      }
    ]
  },
  {
    id: "contamination-surge",
    title: "Contamination Surge",
    description: "Runoff spikes through the pipes and turns every weak seal into a new source of poison.",
    severity: "extreme",
    art: "/events/contamination-surge.png",
    baseDuration: 30,
    responses: [
      {
        id: "decon-flush",
        label: "Emergency Decon Flush",
        description: "Run an expensive full-system purge to strip the worst contaminants out fast.",
        cost: { water: 6, power: 4, feedstock: 2 },
        mitigation: 0.7,
        immediate: { pollution: -1.2, contamination: -1.8 },
        timedModifier: { contaminationRateOffset: -0.035, waterPenaltyOffset: -0.05 }
      },
      {
        id: "seal-intakes",
        label: "Seal Water Intakes",
        description: "Shut down vulnerable intakes and contain the surge at the cost of tighter utility pressure.",
        cost: { materials: 8, power: 3 },
        mitigation: 0.52,
        immediate: { stability: -1 },
        timedModifier: { waterPenaltyOffset: 0.08, pollutionRateOffset: -0.02 }
      },
      {
        id: "surge-ignore",
        label: "Let It Run",
        description: "Avoid the immediate disruption and accept harsher contamination and runoff fallout.",
        mitigation: 0,
        immediate: { contamination: 2.5, stability: -3 }
      }
    ]
  }
];
