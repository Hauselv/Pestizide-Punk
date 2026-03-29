import type { HexCoord, HexTileDefinition, TerrainType } from "../types";

const WORLD_RADIUS = 3;

const primaryTerrainByRegion: Record<string, TerrainType> = {
  "toxic-forest": "toxic-forest",
  "scavenger-run": "scavenger-scrapland",
  "fungal-wetlands": "fungal-wetlands",
  "overgrown-ruins": "overgrown-ruins",
  "waste-basin": "chemical-waste",
  "mutant-nest": "mutant-nest",
  "irradiated-fields": "irradiated-badlands",
  "industrial-hulk": "industrial-hulk"
};

const dangerTintByRegion: Record<string, string> = {
  "toxic-forest": "rgba(108, 196, 95, 0.18)",
  "scavenger-run": "rgba(116, 180, 172, 0.16)",
  "fungal-wetlands": "rgba(94, 174, 151, 0.2)",
  "overgrown-ruins": "rgba(160, 132, 102, 0.16)",
  "waste-basin": "rgba(217, 111, 71, 0.2)",
  "mutant-nest": "rgba(176, 78, 97, 0.18)",
  "irradiated-fields": "rgba(128, 146, 210, 0.16)",
  "industrial-hulk": "rgba(152, 146, 120, 0.16)"
};

const regionCoords: Record<string, Array<[number, number]>> = {
  "toxic-forest": [[0, -1], [1, -1], [0, -2], [1, -2], [-1, 0]],
  "scavenger-run": [[1, 0], [2, -1], [2, 0], [2, -2]],
  "fungal-wetlands": [[0, 1], [1, 1], [0, 2], [1, 2], [2, 1]],
  "overgrown-ruins": [[-1, -1], [-2, 0], [-2, -1], [-3, 0], [-3, 1]],
  "waste-basin": [[-1, 1], [-2, 1], [-2, 2], [-1, 2], [-3, 2]],
  "mutant-nest": [[-3, 3], [-2, 3], [-1, 3], [0, 3]],
  "irradiated-fields": [[0, -3], [1, -3], [2, -3], [-1, -2]],
  "industrial-hulk": [[3, -3], [3, -2], [3, -1], [3, 0]]
};

function coordKey(coord: HexCoord) {
  return `${coord.q},${coord.r}`;
}

function hexDistance(a: HexCoord, b: HexCoord) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs((a.q + a.r) - (b.q + b.r)));
}

function boardDistance(coord: HexCoord) {
  return hexDistance(coord, { q: 0, r: 0 });
}

function createRadiusCoords(radius: number) {
  const coords: HexCoord[] = [];
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r += 1) {
      coords.push({ q, r });
    }
  }
  return coords;
}

const regionByCoord = Object.entries(regionCoords).reduce<Record<string, string>>((map, [regionId, coords]) => {
  coords.forEach(([q, r]) => {
    map[`${q},${r}`] = regionId;
  });
  return map;
}, {});

function resolveTerrainType(regionId: string, coord: HexCoord) {
  const primary = primaryTerrainByRegion[regionId];
  const ring = boardDistance(coord);
  const noise = Math.abs(coord.q * 13 + coord.r * 17) % 7;

  if (primary === "fungal-wetlands" && noise === 0) return "toxic-forest";
  if (primary === "industrial-hulk" && noise <= 1) return "neutral-rock";
  if (primary === "overgrown-ruins" && noise === 2) return "neutral-rock";
  if (primary === "scavenger-scrapland" && noise === 1) return "neutral-rock";
  if (primary === "chemical-waste" && ring === WORLD_RADIUS && noise >= 4) return "neutral-rock";
  if (primary === "mutant-nest" && noise === 3) return "chemical-waste";
  if (primary === "irradiated-badlands" && noise >= 5) return "neutral-rock";
  if (primary === "toxic-forest" && ring === WORLD_RADIUS && noise >= 5) return "neutral-rock";

  return primary;
}

const coords = createRadiusCoords(WORLD_RADIUS);

export const worldHexes: HexTileDefinition[] = coords
  .map((coord) => {
    const ring = boardDistance(coord);
    if (ring === 0) {
      return {
        id: "city-core",
        q: coord.q,
        r: coord.r,
        terrainType: "city-core" as const,
        regionId: null,
        decorVariant: 0,
        dangerTint: "rgba(243, 136, 64, 0.28)",
        isCityCore: true,
        isVisible: true
      };
    }

    const regionId = regionByCoord[coordKey(coord)];
    if (!regionId) {
      throw new Error(`Unassigned world hex at ${coord.q},${coord.r}`);
    }

    return {
      id: `hex-${coord.q}-${coord.r}`,
      q: coord.q,
      r: coord.r,
      terrainType: resolveTerrainType(regionId, coord),
      regionId,
      decorVariant: Math.abs(coord.q * 5 + coord.r * 11) % 3,
      dangerTint: dangerTintByRegion[regionId],
      isVisible: true
    };
  })
  .sort((left, right) => boardDistance(left) - boardDistance(right) || left.r - right.r || left.q - right.q);

export const worldRadius = WORLD_RADIUS;

export const regionHexMap = worldHexes.reduce<Record<string, string[]>>((map, tile) => {
  if (!tile.regionId) return map;
  map[tile.regionId] ??= [];
  map[tile.regionId].push(tile.id);
  return map;
}, {});

export const cityCoreHex = worldHexes.find((tile) => tile.isCityCore) ?? null;
export { boardDistance as hexRingDistance, hexDistance };
