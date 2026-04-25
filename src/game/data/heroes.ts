import type { Hero, HeroItem, HeroSkillId, ResourceFlow } from "../types";

const skillZero = (): Record<HeroSkillId, number> => ({
  firstAid: 0,
  exploration: 0,
  engineering: 0,
  combat: 0,
  survival: 0,
  science: 0
});

export const heroItems: Record<string, HeroItem> = {
  filterMask: {
    id: "filter-mask",
    name: "Filter Mask",
    slot: "respiratory",
    durability: 100,
    protection: { respiratory: 1 }
  },
  cartridgeMask: {
    id: "cartridge-mask",
    name: "Cartridge Mask",
    slot: "respiratory",
    durability: 100,
    protection: { respiratory: 2 }
  },
  lightArmor: {
    id: "light-armor",
    name: "Light Armor",
    slot: "body",
    durability: 100,
    protection: { environmental: 1 }
  },
  hazmatSuit: {
    id: "hazmat-suit",
    name: "Hazmat Suit",
    slot: "body",
    durability: 100,
    protection: { chemical: 2, environmental: 1 }
  },
  radLiner: {
    id: "rad-liner",
    name: "Rad Liner",
    slot: "body",
    durability: 100,
    protection: { radiation: 2 }
  },
  medkit: {
    id: "medkit",
    name: "Medkit",
    slot: "tool",
    durability: 100,
    skillBonus: { firstAid: 1 }
  },
  scanner: {
    id: "field-scanner",
    name: "Field Scanner",
    slot: "tool",
    durability: 100,
    skillBonus: { exploration: 1, science: 1 }
  },
  repairKit: {
    id: "repair-kit",
    name: "Repair Kit",
    slot: "tool",
    durability: 100,
    skillBonus: { engineering: 1 }
  },
  sampleCase: {
    id: "sample-case",
    name: "Sample Case",
    slot: "tool",
    durability: 100,
    skillBonus: { science: 1 }
  }
};

function cloneItem(item: HeroItem): HeroItem {
  return {
    ...item,
    protection: item.protection ? { ...item.protection } : undefined,
    skillBonus: item.skillBonus ? { ...item.skillBonus } : undefined
  };
}

function makeHero(
  id: string,
  name: string,
  archetype: string,
  skills: Partial<Record<HeroSkillId, number>>,
  traits: string[],
  itemIds: Array<keyof typeof heroItems>,
  hireCost?: ResourceFlow
): Hero {
  return {
    id,
    name,
    archetype,
    level: 1,
    xp: 0,
    skills: { ...skillZero(), ...skills },
    traits,
    inventory: itemIds.map((itemId) => cloneItem(heroItems[itemId])),
    status: "available",
    hireCost
  };
}

export const startingHeroes: Hero[] = [
  makeHero("hero-mara", "Mara Voss", "Trail Medic", { firstAid: 2, survival: 2, exploration: 1 }, ["Calm Hands", "Field Triage"], ["filterMask", "medkit"]),
  makeHero("hero-ivo", "Ivo Kade", "Ruin Engineer", { engineering: 2, exploration: 1, science: 1 }, ["Route Sense", "Patchwork Genius"], ["lightArmor", "repairKit"]),
  makeHero("hero-senna", "Senna Rusk", "Nest Ranger", { combat: 2, survival: 1, exploration: 1 }, ["Steady Nerve", "Close Escort"], ["filterMask", "lightArmor"])
];

const candidateTemplates = [
  ["juno", "Juno Vale", "Field Naturalist", { science: 2, exploration: 1, survival: 1 }, ["Sample Savant"], ["filterMask", "sampleCase"], { food: 6, materials: 8 }],
  ["bram", "Bram Orrek", "Shield Hand", { combat: 2, survival: 2 }, ["Bulwark"], ["lightArmor"], { food: 8, materials: 10 }],
  ["nix", "Nix Calder", "Route Scout", { exploration: 3, survival: 1 }, ["Fast Walker"], ["filterMask", "scanner"], { food: 7, gear: 1 }],
  ["tala", "Tala Myr", "Hazard Chemist", { science: 2, firstAid: 1, engineering: 1 }, ["Contamination Eye"], ["cartridgeMask", "sampleCase"], { materials: 12, gear: 1 }],
  ["oskar", "Oskar Renn", "Seal Mechanic", { engineering: 3, survival: 1 }, ["Seal Whisperer"], ["hazmatSuit", "repairKit"], { materials: 14, gear: 2 }],
  ["ves", "Veska Dorn", "Wasteland Surgeon", { firstAid: 3, science: 1 }, ["Hard Choices"], ["medkit", "lightArmor"], { food: 10, materials: 8 }]
] as const;

export function createHeroCandidatePool(seed: number): Hero[] {
  return [0, 1, 2].map((offset) => {
    const template = candidateTemplates[(seed + offset * 2) % candidateTemplates.length];
    const [id, name, archetype, skills, traits, itemIds, hireCost] = template;
    const hero = makeHero(`candidate-${seed}-${id}`, name, archetype, skills, [...traits], [...itemIds] as Array<keyof typeof heroItems>, hireCost);
    hero.level = 1 + (seed + offset > 2 ? 1 : 0);
    if (hero.level > 1) {
      const primary = Object.entries(hero.skills).sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] as HeroSkillId | undefined;
      if (primary) hero.skills[primary] = Math.min(5, hero.skills[primary] + 1);
    }
    return hero;
  });
}
