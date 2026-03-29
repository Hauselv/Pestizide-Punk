import type { TerrainType } from "../types";

export interface TerrainVisualDefinition {
  label: string;
  variants: string[];
  accent: string;
  stroke: string;
  shadow: string;
}

function variants(baseName: string) {
  return [
    `/world-hex/tiles/${baseName}.png`,
    `/world-hex/tiles/${baseName}-v2.png`,
    `/world-hex/tiles/${baseName}-v3.png`
  ];
}

export const terrainAssetMap: Record<TerrainType, TerrainVisualDefinition> = {
  "city-core": {
    label: "City Core",
    variants: variants("city-core"),
    accent: "rgba(247, 146, 69, 0.35)",
    stroke: "rgba(255, 213, 159, 0.65)",
    shadow: "rgba(255, 124, 58, 0.22)"
  },
  "toxic-forest": {
    label: "Toxic Forest",
    variants: variants("toxic-forest"),
    accent: "rgba(86, 182, 87, 0.26)",
    stroke: "rgba(175, 225, 154, 0.34)",
    shadow: "rgba(72, 150, 74, 0.24)"
  },
  "fungal-wetlands": {
    label: "Fungal Wetlands",
    variants: variants("fungal-wetlands"),
    accent: "rgba(78, 182, 158, 0.24)",
    stroke: "rgba(150, 218, 203, 0.34)",
    shadow: "rgba(62, 128, 117, 0.24)"
  },
  "overgrown-ruins": {
    label: "Overgrown Ruins",
    variants: variants("overgrown-ruins"),
    accent: "rgba(144, 122, 96, 0.24)",
    stroke: "rgba(210, 188, 154, 0.3)",
    shadow: "rgba(101, 81, 57, 0.2)"
  },
  "scavenger-scrapland": {
    label: "Scavenger Scrapland",
    variants: variants("scavenger-scrapland"),
    accent: "rgba(112, 169, 176, 0.2)",
    stroke: "rgba(181, 225, 229, 0.3)",
    shadow: "rgba(70, 115, 121, 0.22)"
  },
  "chemical-waste": {
    label: "Chemical Waste",
    variants: variants("chemical-waste"),
    accent: "rgba(212, 112, 67, 0.26)",
    stroke: "rgba(238, 183, 136, 0.34)",
    shadow: "rgba(150, 70, 45, 0.24)"
  },
  "irradiated-badlands": {
    label: "Irradiated Badlands",
    variants: variants("irradiated-badlands"),
    accent: "rgba(122, 132, 205, 0.2)",
    stroke: "rgba(196, 206, 255, 0.3)",
    shadow: "rgba(72, 81, 130, 0.24)"
  },
  "industrial-hulk": {
    label: "Industrial Hulk",
    variants: variants("industrial-hulk"),
    accent: "rgba(143, 141, 113, 0.2)",
    stroke: "rgba(216, 209, 168, 0.28)",
    shadow: "rgba(96, 92, 73, 0.22)"
  },
  "mutant-nest": {
    label: "Mutant Nest",
    variants: variants("mutant-nest"),
    accent: "rgba(158, 72, 92, 0.22)",
    stroke: "rgba(233, 157, 175, 0.3)",
    shadow: "rgba(106, 44, 58, 0.24)"
  },
  "neutral-rock": {
    label: "Neutral Rock",
    variants: variants("neutral-rock"),
    accent: "rgba(130, 136, 142, 0.16)",
    stroke: "rgba(214, 218, 222, 0.24)",
    shadow: "rgba(77, 83, 91, 0.18)"
  },
  "petro-marsh": {
    label: "Petro Marsh",
    variants: variants("petro-marsh"),
    accent: "rgba(134, 110, 84, 0.24)",
    stroke: "rgba(224, 196, 151, 0.3)",
    shadow: "rgba(78, 64, 52, 0.22)"
  },
  "steam-fissures": {
    label: "Steam Fissures",
    variants: variants("steam-fissures"),
    accent: "rgba(227, 136, 89, 0.22)",
    stroke: "rgba(252, 200, 160, 0.32)",
    shadow: "rgba(118, 67, 43, 0.22)"
  },
  "flooded-dam": {
    label: "Flooded Dam",
    variants: variants("flooded-dam"),
    accent: "rgba(80, 154, 204, 0.22)",
    stroke: "rgba(167, 222, 255, 0.3)",
    shadow: "rgba(49, 90, 120, 0.22)"
  },
  "algae-salt-flats": {
    label: "Algae Salt Flats",
    variants: variants("algae-salt-flats"),
    accent: "rgba(92, 196, 174, 0.22)",
    stroke: "rgba(179, 240, 224, 0.3)",
    shadow: "rgba(46, 104, 96, 0.22)"
  },
  "ash-farmland": {
    label: "Ash Farmland",
    variants: variants("ash-farmland"),
    accent: "rgba(183, 121, 75, 0.2)",
    stroke: "rgba(243, 198, 158, 0.28)",
    shadow: "rgba(105, 66, 42, 0.2)"
  }
};
