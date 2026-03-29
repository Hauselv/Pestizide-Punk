import type { TerrainType } from "../types";

export interface TerrainVisualDefinition {
  label: string;
  image: string;
  accent: string;
  stroke: string;
  shadow: string;
}

export const terrainAssetMap: Record<TerrainType, TerrainVisualDefinition> = {
  "city-core": {
    label: "City Core",
    image: "/world-hex/tiles/city-core.png",
    accent: "rgba(247, 146, 69, 0.35)",
    stroke: "rgba(255, 213, 159, 0.65)",
    shadow: "rgba(255, 124, 58, 0.22)"
  },
  "toxic-forest": {
    label: "Toxic Forest",
    image: "/world-hex/tiles/toxic-forest.png",
    accent: "rgba(86, 182, 87, 0.26)",
    stroke: "rgba(175, 225, 154, 0.34)",
    shadow: "rgba(72, 150, 74, 0.24)"
  },
  "fungal-wetlands": {
    label: "Fungal Wetlands",
    image: "/world-hex/tiles/fungal-wetlands.png",
    accent: "rgba(78, 182, 158, 0.24)",
    stroke: "rgba(150, 218, 203, 0.34)",
    shadow: "rgba(62, 128, 117, 0.24)"
  },
  "overgrown-ruins": {
    label: "Overgrown Ruins",
    image: "/world-hex/tiles/overgrown-ruins.png",
    accent: "rgba(144, 122, 96, 0.24)",
    stroke: "rgba(210, 188, 154, 0.3)",
    shadow: "rgba(101, 81, 57, 0.2)"
  },
  "scavenger-scrapland": {
    label: "Scavenger Scrapland",
    image: "/world-hex/tiles/scavenger-scrapland.png",
    accent: "rgba(112, 169, 176, 0.2)",
    stroke: "rgba(181, 225, 229, 0.3)",
    shadow: "rgba(70, 115, 121, 0.22)"
  },
  "chemical-waste": {
    label: "Chemical Waste",
    image: "/world-hex/tiles/chemical-waste.png",
    accent: "rgba(212, 112, 67, 0.26)",
    stroke: "rgba(238, 183, 136, 0.34)",
    shadow: "rgba(150, 70, 45, 0.24)"
  },
  "irradiated-badlands": {
    label: "Irradiated Badlands",
    image: "/world-hex/tiles/irradiated-badlands.png",
    accent: "rgba(122, 132, 205, 0.2)",
    stroke: "rgba(196, 206, 255, 0.3)",
    shadow: "rgba(72, 81, 130, 0.24)"
  },
  "industrial-hulk": {
    label: "Industrial Hulk",
    image: "/world-hex/tiles/industrial-hulk.png",
    accent: "rgba(143, 141, 113, 0.2)",
    stroke: "rgba(216, 209, 168, 0.28)",
    shadow: "rgba(96, 92, 73, 0.22)"
  },
  "mutant-nest": {
    label: "Mutant Nest",
    image: "/world-hex/tiles/mutant-nest.png",
    accent: "rgba(158, 72, 92, 0.22)",
    stroke: "rgba(233, 157, 175, 0.3)",
    shadow: "rgba(106, 44, 58, 0.24)"
  },
  "neutral-rock": {
    label: "Neutral Rock",
    image: "/world-hex/tiles/neutral-rock.png",
    accent: "rgba(130, 136, 142, 0.16)",
    stroke: "rgba(214, 218, 222, 0.24)",
    shadow: "rgba(77, 83, 91, 0.18)"
  }
};
