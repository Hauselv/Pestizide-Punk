import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { buildingDefinitions, districtSlots } from "../game/data/buildings";
import { resourceDefinitions } from "../game/data/resources";
import { researchNodes } from "../game/data/research";
import { getReactorTierBonuses, reactorUpgradeDefinitions } from "../game/data/reactor";
import { regionDefinitions } from "../game/data/sectors";
import { terrainAssetMap } from "../game/data/terrainAssets";
import { buildingVisualMap, cityVisual } from "../game/data/buildingVisuals";
import { worldHexes } from "../game/data/worldHexes";
import { useGameStore } from "../game/state/store";
import type {
  BuildingDefinition,
  BuildingInstance,
  DoctrineTag,
  EventId,
  Expedition,
  ExpeditionKind,
  Hero,
  HeroSkillId,
  HexCoord,
  HexTileDefinition,
  ProtectionSlotId,
  ResearchNode,
  RegionStateId,
  ResourceFlow,
  ResourceId,
  RoleId,
  SectorActionRequirement,
  TerrainType,
  ViewMode
} from "../game/types";

const buildingMap = Object.fromEntries(buildingDefinitions.map((definition) => [definition.id, definition])) as Record<string, BuildingDefinition>;
const regionMap = Object.fromEntries(regionDefinitions.map((definition) => [definition.id, definition]));
const researchNodeMap = Object.fromEntries(researchNodes.map((node) => [node.id, node])) as Record<string, ResearchNode>;

function getBuildingVisual(buildingId: string, fallbackLabel: string) {
  return buildingVisualMap[buildingId] ?? {
    icon: "/buildings/icons/utility-works.png",
    label: fallbackLabel,
    tint: "rgba(145, 159, 166, 0.2)"
  };
}

function getTerrainVariantImage(terrainType: TerrainType, decorVariant = 0) {
  const terrain = terrainAssetMap[terrainType];
  return terrain.variants[decorVariant % terrain.variants.length] ?? terrain.variants[0];
}

const regionStateLabel: Record<RegionStateId, string> = {
  known: "Known",
  surveying: "Surveying",
  surveyed: "Surveyed",
  exploiting: "Exploiting",
  secured: "Secured",
  outpost: "Outpost"
};

const speedOptions = [0, 1, 2, 4];
const HEX_SIZE = 41;
const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
const WORLD_PADDING = HEX_SIZE * 2.6;
const TERRAIN_TYPES = [...new Set(worldHexes.map((tile) => tile.terrainType))] as TerrainType[];
const RESEARCH_TREE_ROOT_X = 26;
const RESEARCH_TREE_TIER_X = 214;
const RESEARCH_TREE_COLUMN_WIDTH = 216;
const RESEARCH_TREE_COLUMN_GAP = 26;
const RESEARCH_TREE_NODE_WIDTH = 186;
const RESEARCH_TREE_NODE_HEIGHT = 78;
const RESEARCH_TREE_ROW_GAP = 12;
const RESEARCH_TREE_GROUP_GAP = 18;
const RESEARCH_BRANCH_COLORS: Record<string, string> = {
  Scouting: "#8db0a3",
  Infrastructure: "#87b7c9",
  Industry: "#d2a56f",
  Energy: "#f0c269",
  Food: "#8ecb79",
  "Pest Control": "#d78d59",
  Protection: "#b8c989",
  Medicine: "#86c0b0",
  Logistics: "#8ba3bc",
  Defense: "#c97763"
};

function formatResource(value: number) {
  return value.toFixed(value < 10 ? 1 : 0);
}

function buildingMultiplier(level: number) {
  return 1 + (level - 1) * 0.5;
}

function mergeResourceFlow(base?: ResourceFlow, extra?: ResourceFlow) {
  const merged: ResourceFlow = { ...(base ?? {}) };
  Object.entries(extra ?? {}).forEach(([resourceId, amount]) => {
    merged[resourceId as ResourceId] = Number(merged[resourceId as ResourceId] ?? 0) + Number(amount ?? 0);
  });
  return merged;
}

function mergeProtectionFlow(base?: Partial<Record<ProtectionSlotId, number>>, extra?: Partial<Record<ProtectionSlotId, number>>) {
  const merged: Partial<Record<ProtectionSlotId, number>> = { ...(base ?? {}) };
  Object.entries(extra ?? {}).forEach(([slotId, amount]) => {
    merged[slotId as ProtectionSlotId] = Number(merged[slotId as ProtectionSlotId] ?? 0) + Number(amount ?? 0);
  });
  return merged;
}

function getSelectedUpgrade(definition: BuildingDefinition, instance: BuildingInstance) {
  if (!instance.upgradeOptionId) return null;
  return definition.upgradeOptions?.find((option) => option.id === instance.upgradeOptionId) ?? null;
}

function getEffectiveBuildingData(definition: BuildingDefinition, instance: BuildingInstance) {
  const selectedUpgrade = getSelectedUpgrade(definition, instance);
  return {
    output: mergeResourceFlow(definition.output, selectedUpgrade?.output),
    upkeep: mergeResourceFlow(definition.upkeep, selectedUpgrade?.upkeep),
    storageCapacity: mergeResourceFlow(definition.storageCapacity, selectedUpgrade?.storageCapacity),
    protectionOutput: mergeProtectionFlow(definition.protectionOutput, selectedUpgrade?.protectionOutput),
    emissions: Number(definition.emissions ?? 0) + Number(selectedUpgrade?.emissions ?? 0),
    wasteOutput: {
      pollution: Number(definition.wasteOutput?.pollution ?? 0) + Number(selectedUpgrade?.wasteOutput?.pollution ?? 0)
    },
    doctrineTags: [...new Set([...(definition.doctrineTags ?? []), ...(selectedUpgrade?.doctrineTags ?? [])])],
    selectedUpgrade
  };
}

function formatFlow(flow?: ResourceFlow, level = 1, asCost = false) {
  if (!flow || Object.keys(flow).length === 0) return ["None"];
  return Object.entries(flow).map(([resourceId, amount]) => {
    const label = resourceDefinitions.find((resource) => resource.id === (resourceId as ResourceId))?.label ?? resourceId;
    const base = Number(amount ?? 0) * buildingMultiplier(level);
    const scaled = asCost ? -Math.abs(base) : base;
    const prefix = scaled >= 0 ? "+" : "";
    return `${label} ${prefix}${scaled.toFixed(scaled % 1 === 0 ? 0 : 1)}`;
  });
}

function formatProtection(protection: Record<ProtectionSlotId, number>) {
  return Object.entries(protection)
    .map(([slot, value]) => `${slot} ${Number(value).toFixed(Number(value) % 1 === 0 ? 0 : 1)}`)
    .join(" / ");
}

function createDoctrineProfile(): Record<DoctrineTag, number> {
  return {
    clean: 0,
    fossil: 0,
    bio: 0,
    synthetic: 0,
    chemical: 0,
    radical: 0,
    engineered: 0,
    storage: 0,
    resilient: 0
  };
}

function getDoctrineProfile(buildings: BuildingInstance[]) {
  const profile = createDoctrineProfile();
  buildings.forEach((building) => {
    if (!building.enabled) return;
    const definition = buildingMap[building.buildingId];
    const effective = getEffectiveBuildingData(definition, building);
    const weight = buildingMultiplier(building.level);
    effective.doctrineTags.forEach((tag) => {
      profile[tag] += weight;
    });
  });
  return profile;
}

function summarizeDoctrineProfile(profile: Record<DoctrineTag, number>) {
  return Object.entries(profile)
    .filter(([, value]) => value > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4)
    .map(([tag, value]) => `${tag} ${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}`)
    .join(" / ");
}

function getFreeRoles(buildings: BuildingInstance[], expeditions: Expedition[], roles: Record<RoleId, number>) {
  const used: Record<RoleId, number> = { workers: 0, technicians: 0, researchers: 0, rangers: 0 };

  buildings.forEach((building) => {
    if (!building.enabled) return;
    const definition = buildingMap[building.buildingId];
    Object.entries(definition.staff).forEach(([role, amount]) => {
      used[role as RoleId] += Number(amount ?? 0);
    });
  });

  return {
    workers: roles.workers - used.workers,
    technicians: roles.technicians - used.technicians,
    researchers: roles.researchers - used.researchers,
    rangers: roles.rangers - used.rangers
  };
}

function getRequirementSummary(requirement: SectorActionRequirement, researched: string[], gear: number, protection: Record<ProtectionSlotId, number>) {
  const parts: string[] = [];
  const gearTier = gear >= 12 ? 3 : gear >= 6 ? 2 : gear >= 3 ? 1 : 0;
  if ((requirement.tech ?? []).length > 0) {
    parts.push(...(requirement.tech ?? []).map((techId) => {
      const name = researchNodes.find((node) => node.id === techId)?.name ?? techId;
      return `${researched.includes(techId) ? "Ready" : "Missing"}: ${name}`;
    }));
  }
  if (requirement.gear) {
    parts.push(`${gearTier >= requirement.gear ? "Ready" : "Missing"}: Gear tier ${requirement.gear}`);
  }
  if (requirement.protection) {
    Object.entries(requirement.protection).forEach(([slot, amount]) => {
      parts.push(`${protection[slot as ProtectionSlotId] >= Number(amount ?? 0) ? "Ready" : "Missing"}: ${slot} ${amount}`);
    });
  }
  return parts.length > 0 ? parts : ["No extra requirements"];
}

function getBlockedReason(requirement: SectorActionRequirement, researched: string[], gear: number, protection: Record<ProtectionSlotId, number>) {
  const missing = getRequirementSummary(requirement, researched, gear, protection).filter((item) => item.startsWith("Missing"));
  return missing.length > 0 ? missing.join(" / ") : "Requirements met";
}

function hexToPixel(coord: HexCoord) {
  return {
    x: HEX_SIZE * Math.sqrt(3) * (coord.q + coord.r / 2),
    y: HEX_SIZE * 1.5 * coord.r
  };
}

const heroSkillIds: HeroSkillId[] = ["firstAid", "exploration", "engineering", "combat", "survival", "science"];

function getHeroEffectiveSkills(hero: Hero) {
  const skills = { ...hero.skills };
  hero.inventory.forEach((item) => {
    if (item.durability <= 0) return;
    Object.entries(item.skillBonus ?? {}).forEach(([skillId, amount]) => {
      skills[skillId as HeroSkillId] = Math.min(7, skills[skillId as HeroSkillId] + Number(amount ?? 0));
    });
  });
  if (hero.injury === "light") {
    heroSkillIds.forEach((skillId) => { skills[skillId] = Math.max(0, skills[skillId] - 1); });
  }
  if (hero.injury === "heavy") {
    heroSkillIds.forEach((skillId) => { skills[skillId] = Math.max(0, skills[skillId] - 2); });
  }
  if (hero.injury === "critical") {
    heroSkillIds.forEach((skillId) => { skills[skillId] = Math.max(0, skills[skillId] - 3); });
  }
  return skills;
}

function getHeroGroupSkills(heroes: Hero[]) {
  const totals = Object.fromEntries(heroSkillIds.map((skillId) => [skillId, 0])) as Record<HeroSkillId, number>;
  heroes.forEach((hero) => {
    const skills = getHeroEffectiveSkills(hero);
    heroSkillIds.forEach((skillId) => {
      totals[skillId] += skills[skillId];
    });
  });
  return totals;
}

function getHeroGroupProtection(heroes: Hero[]) {
  const protection: Record<ProtectionSlotId, number> = { respiratory: 0, chemical: 0, radiation: 0, environmental: 0 };
  heroes.forEach((hero) => {
    hero.inventory.forEach((item) => {
      if (item.durability <= 0) return;
      Object.entries(item.protection ?? {}).forEach(([slot, amount]) => {
        protection[slot as ProtectionSlotId] += Number(amount ?? 0);
      });
    });
  });
  return protection;
}

function mergeProtection(base: Record<ProtectionSlotId, number>, extra: Record<ProtectionSlotId, number>) {
  return {
    respiratory: base.respiratory + extra.respiratory,
    chemical: base.chemical + extra.chemical,
    radiation: base.radiation + extra.radiation,
    environmental: base.environmental + extra.environmental
  };
}

function getHeroGroupLimits(kind: ExpeditionKind) {
  if (kind === "survey") return { min: 1, max: 2 };
  if (kind === "secure") return { min: 3, max: 3 };
  return { min: 2, max: 3 };
}

function getMissionPrimarySkill(kind: ExpeditionKind): HeroSkillId {
  if (kind === "survey") return "exploration";
  if (kind === "exploit") return "engineering";
  if (kind === "secure") return "combat";
  return "survival";
}

function getMissionPreview(region: typeof regionDefinitions[number], kind: ExpeditionKind, heroes: Hero[], dayPhase: string) {
  const skills = getHeroGroupSkills(heroes);
  const hazardScore = Object.values(region.hazard).reduce<number>((sum, amount) => sum + Number(amount ?? 0), 0);
  const primary = getMissionPrimarySkill(kind);
  const relevantSkill = skills[primary] + skills.survival * 0.65 + skills.firstAid * 0.35 + (kind === "survey" ? skills.science * 0.45 : 0);
  const phaseScale = dayPhase === "night" ? 1.16 : dayPhase === "dusk" ? 1.08 : 1;
  const baseDuration = kind === "survey" ? 18 : kind === "exploit" ? 24 : kind === "secure" ? 30 : 22;
  const duration = Math.max(8, Math.ceil(baseDuration * phaseScale * Math.min(1.5, Math.max(0.55, 1.22 - relevantSkill * 0.055 + hazardScore * 0.035))));
  const risk = Math.min(0.72, Math.max(0.02, 0.08 + hazardScore * 0.065 - skills.survival * 0.025 - skills.firstAid * 0.02 - relevantSkill * 0.012));
  const reward = kind === "survey" ? Math.min(1.45, Math.max(1, 1 + (skills.exploration + skills.science) * 0.035)) : 1;
  return { duration, risk, reward, skills };
}

function getHexVertices(center: { x: number; y: number }) {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    return {
      x: center.x + HEX_SIZE * Math.cos(angle),
      y: center.y + HEX_SIZE * Math.sin(angle)
    };
  });
}

function getHexPoints(center: { x: number; y: number }) {
  return getHexVertices(center).map((point) => `${point.x},${point.y}`).join(" ");
}

const worldGeometry = (() => {
  const projected = worldHexes.map((tile) => {
    const center = hexToPixel(tile);
    const vertices = getHexVertices(center);
    return { ...tile, center, vertices, points: vertices.map((point) => `${point.x},${point.y}`).join(" ") };
  });

  const bounds = projected.reduce(
    (acc, tile) => ({
      minX: Math.min(acc.minX, tile.center.x - HEX_WIDTH / 2),
      maxX: Math.max(acc.maxX, tile.center.x + HEX_WIDTH / 2),
      minY: Math.min(acc.minY, tile.center.y - HEX_SIZE),
      maxY: Math.max(acc.maxY, tile.center.y + HEX_SIZE)
    }),
    { minX: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
  );

  const width = bounds.maxX - bounds.minX + WORLD_PADDING * 2;
  const height = bounds.maxY - bounds.minY + WORLD_PADDING * 2;
  const offsetX = WORLD_PADDING - bounds.minX;
  const offsetY = WORLD_PADDING - bounds.minY;

  const normalized = projected.map((tile) => {
    const center = { x: tile.center.x + offsetX, y: tile.center.y + offsetY };
    const vertices = getHexVertices(center);
    return { ...tile, center, vertices, points: vertices.map((point) => `${point.x},${point.y}`).join(" ") };
  });

  return { width, height, tiles: normalized };
})();

const tileMap = Object.fromEntries(worldGeometry.tiles.map((tile) => [tile.id, tile])) as Record<string, HexTileDefinition & { center: { x: number; y: number }; points: string; vertices: Array<{ x: number; y: number }> }>;

const worldTransitionEdges = (() => {
  const neighborChecks = [
    { q: 1, r: 0, edge: [0, 1] as const },
    { q: 1, r: -1, edge: [5, 0] as const },
    { q: 0, r: -1, edge: [4, 5] as const }
  ];
  const coordMap = Object.fromEntries(worldGeometry.tiles.map((tile) => [`${tile.q},${tile.r}`, tile])) as Record<
    string,
    HexTileDefinition & { center: { x: number; y: number }; points: string; vertices: Array<{ x: number; y: number }> }
  >;

  return worldGeometry.tiles.flatMap((tile) => {
    if (tile.isCityCore) return [];

    return neighborChecks.flatMap((direction) => {
      const neighbor = coordMap[`${tile.q + direction.q},${tile.r + direction.r}`];
      if (!neighbor || neighbor.isCityCore) return [];
      if (neighbor.terrainType === tile.terrainType && neighbor.regionId === tile.regionId) return [];

      const [startIndex, endIndex] = direction.edge;
      return [{
        id: `${tile.id}-${neighbor.id}`,
        fromTileId: tile.id,
        toTileId: neighbor.id,
        fromRegionId: tile.regionId,
        toRegionId: neighbor.regionId,
        terrainType: tile.terrainType,
        start: tile.vertices[startIndex],
        end: tile.vertices[endIndex]
      }];
    });
  });
})();

function getResearchBranchColor(branch: string) {
  return RESEARCH_BRANCH_COLORS[branch] ?? "#d9b474";
}

function getResearchNodeState(nodeId: string, researched: string[], activeResearchNodeId?: string | null, researchPoints = 0) {
  const node = researchNodeMap[nodeId];
  if (!node) return "locked" as const;
  if (researched.includes(node.id)) return "done" as const;
  if (activeResearchNodeId === node.id) return "active" as const;
  const available = node.prerequisites.every((item: string) => researched.includes(item)) && researchPoints >= node.cost;
  return available ? "available" as const : "locked" as const;
}

const RESEARCH_TIER_BRANCH_ORDER: Record<number, string[]> = {
  0: ["Scouting", "Infrastructure", "Industry", "Food"],
  1: ["Scouting", "Protection", "Food", "Energy", "Industry", "Pest Control"],
  2: ["Logistics", "Energy", "Industry", "Medicine", "Pest Control", "Protection"],
  3: ["Energy", "Logistics", "Defense", "Protection", "Pest Control", "Medicine"],
  4: ["Energy", "Defense", "Medicine", "Logistics"]
};

function getResearchAncestors(nodeId: string, visited = new Set<string>()) {
  if (visited.has(nodeId)) return visited;
  visited.add(nodeId);
  const node = researchNodeMap[nodeId];
  if (!node) return visited;
  node.prerequisites.forEach((prerequisiteId: string) => getResearchAncestors(prerequisiteId, visited));
  return visited;
}

function getResearchDescendants(nodeId: string, visited = new Set<string>()) {
  if (visited.has(nodeId)) return visited;
  visited.add(nodeId);
  researchNodes.forEach((node) => {
    if (node.prerequisites.includes(nodeId)) {
      getResearchDescendants(node.id, visited);
    }
  });
  return visited;
}

function getResearchCluster(nodeId: string) {
  const ancestors = getResearchAncestors(nodeId);
  const descendants = getResearchDescendants(nodeId);
  return new Set<string>([...ancestors, ...descendants]);
}

function getResearchChildren(nodeId: string) {
  return researchNodes.filter((node) => node.prerequisites.includes(nodeId));
}

function getResearchUnlockGroups(node: ResearchNode) {
  const groups = {
    structures: [] as string[],
    safeguards: [] as string[],
    protocols: [] as string[]
  };

  node.unlocks.forEach((unlock: string) => {
    const normalized = unlock.toLowerCase();
    if (normalized.includes("plant") || normalized.includes("array") || normalized.includes("lab") || normalized.includes("workshop") || normalized.includes("station") || normalized.includes("well") || normalized.includes("fields") || normalized.includes("hub") || normalized.includes("vault") || normalized.includes("bay") || normalized.includes("rig")) {
      groups.structures.push(unlock);
      return;
    }
    if (normalized.includes("seal") || normalized.includes("shield") || normalized.includes("mask") || normalized.includes("filter") || normalized.includes("suit") || normalized.includes("dosimeter") || normalized.includes("cartridge")) {
      groups.safeguards.push(unlock);
      return;
    }
    groups.protocols.push(unlock);
  });

  return groups;
}

function buildResearchTreeLayout() {
  const nodeLayouts: Array<{ id: string; x: number; y: number; width: number; height: number; branch: string; tier: number }> = [];
  const branchLabels: Array<{ key: string; branch: string; tier: number; x: number; y: number; color: string }> = [];
  const nodeMap: Record<string, { id: string; x: number; y: number; width: number; height: number; branch: string; tier: number }> = {};
  let maxY = 0;

  [0, 1, 2, 3, 4].forEach((tier) => {
    const tierNodes = researchNodes.filter((node) => node.tier === tier);
    let cursorY = 44;
    const x = tier === 0 ? RESEARCH_TREE_ROOT_X : RESEARCH_TREE_TIER_X + (tier - 1) * (RESEARCH_TREE_COLUMN_WIDTH + RESEARCH_TREE_COLUMN_GAP);
    const fallbackBranches = [...new Set(tierNodes.map((node) => node.branch))];
    const branchOrder = [...(RESEARCH_TIER_BRANCH_ORDER[tier] ?? []), ...fallbackBranches.filter((branch) => !(RESEARCH_TIER_BRANCH_ORDER[tier] ?? []).includes(branch))];

    branchOrder.forEach((branch) => {
      const branchNodes = tierNodes
        .filter((node) => node.branch === branch)
        .sort((left, right) => {
          const leftParents = left.prerequisites.map((id) => nodeMap[id]?.y ?? 0);
          const rightParents = right.prerequisites.map((id) => nodeMap[id]?.y ?? 0);
          const leftAnchor = leftParents.length > 0 ? leftParents.reduce((sum, value) => sum + value, 0) / leftParents.length : 0;
          const rightAnchor = rightParents.length > 0 ? rightParents.reduce((sum, value) => sum + value, 0) / rightParents.length : 0;
          if (leftAnchor === rightAnchor) return left.cost - right.cost;
          return leftAnchor - rightAnchor;
        });
      if (branchNodes.length === 0) return;

      branchLabels.push({
        key: `${tier}-${branch}`,
        branch,
        tier,
        x,
        y: Math.max(18, cursorY - 18),
        color: getResearchBranchColor(branch)
      });

      branchNodes.forEach((node, index) => {
        const layout = {
          id: node.id,
          x,
          y: cursorY + index * (RESEARCH_TREE_NODE_HEIGHT + RESEARCH_TREE_ROW_GAP),
          width: RESEARCH_TREE_NODE_WIDTH,
          height: RESEARCH_TREE_NODE_HEIGHT,
          branch,
          tier
        };
        nodeLayouts.push(layout);
        nodeMap[node.id] = layout;
      });

      cursorY += branchNodes.length * (RESEARCH_TREE_NODE_HEIGHT + RESEARCH_TREE_ROW_GAP) + RESEARCH_TREE_GROUP_GAP;
      maxY = Math.max(maxY, cursorY);
    });
  });

  const links = researchNodes.flatMap((node) => {
    const target = nodeMap[node.id];
    if (!target) return [] as Array<{ id: string; sourceId: string; targetId: string; x1: number; y1: number; x2: number; y2: number; color: string }>;
    return node.prerequisites.flatMap((prerequisiteId) => {
      const source = nodeMap[prerequisiteId];
      if (!source) return [] as Array<{ id: string; sourceId: string; targetId: string; x1: number; y1: number; x2: number; y2: number; color: string }>;
      return [{
        id: `${prerequisiteId}-${node.id}`,
        sourceId: prerequisiteId,
        targetId: node.id,
        x1: source.x + source.width,
        y1: source.y + source.height / 2,
        x2: target.x,
        y2: target.y + target.height / 2,
        color: getResearchBranchColor(target.branch)
      }];
    });
  });

  const width = RESEARCH_TREE_TIER_X + 4 * (RESEARCH_TREE_COLUMN_WIDTH + RESEARCH_TREE_COLUMN_GAP) + RESEARCH_TREE_NODE_WIDTH + 44;
  const height = maxY + 18;

  return { nodeLayouts, nodeMap, links, branchLabels, width, height };
}
const phaseLabels = {
  dawn: "Dawn",
  day: "Day",
  dusk: "Dusk",
  night: "Night"
} as const;

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function formatCost(flow?: ResourceFlow) {
  if (!flow || Object.keys(flow).length === 0) return "No direct cost";
  return Object.entries(flow).map(([resourceId, amount]) => `${resourceDefinitions.find((resource) => resource.id === (resourceId as ResourceId))?.label ?? resourceId} ${amount}`).join(" / ");
}

function formatForecastWindow(event: { forecastStart: number; forecastEnd: number }, elapsedSeconds: number) {
  const start = Math.max(0, event.forecastStart - elapsedSeconds);
  const end = Math.max(start, event.forecastEnd - elapsedSeconds);
  return `T-${formatDuration(start)} to T-${formatDuration(end)}`;
}

function formatForecastCertainty(certainty?: number) {
  return `${Math.round((certainty ?? 0) * 100)}% certainty`;
}

function getSeverityClass(severity?: string) {
  return severity ? severity.toLowerCase() : "moderate";
}

function getRegionHazardSummary(hazard: Record<string, number>) {
  return Object.entries(hazard)
    .filter(([, value]) => Number(value ?? 0) > 0)
    .sort((left, right) => Number(right[1]) - Number(left[1]));
}

function getTerrainLandmarkLabel(terrainType: TerrainType) {
  switch (terrainType) {
    case "toxic-forest":
      return "Canopy";
    case "fungal-wetlands":
      return "Spore Beds";
    case "overgrown-ruins":
      return "Ruins";
    case "scavenger-scrapland":
      return "Scrapyard";
    case "chemical-waste":
      return "Basin";
    case "irradiated-badlands":
      return "Hot Zone";
    case "industrial-hulk":
      return "Works";
    case "mutant-nest":
      return "Nest";
    case "petro-marsh":
      return "Oil Seeps";
    case "steam-fissures":
      return "Vent Field";
    case "flooded-dam":
      return "Dam";
    case "algae-salt-flats":
      return "Algae Beds";
    case "ash-farmland":
      return "Ash Fields";
    default:
      return "Frontier";
  }
}

function renderTerrainLandmarkGlyph(terrainType: TerrainType) {
  switch (terrainType) {
    case "toxic-forest":
      return (
        <>
          <path d="M -10 10 L -4 -8 L 2 10 Z" />
          <path d="M -1 10 L 6 -5 L 13 10 Z" />
          <path d="M 1 10 L 1 15" />
        </>
      );
    case "fungal-wetlands":
      return (
        <>
          <ellipse cx="-5" cy="2" rx="6" ry="4" />
          <ellipse cx="5" cy="-1" rx="7" ry="5" />
          <path d="M -5 5 L -5 14 M 5 4 L 5 14" />
        </>
      );
    case "overgrown-ruins":
      return (
        <>
          <rect x="-11" y="0" width="7" height="10" rx="1" />
          <rect x="-2" y="-6" width="7" height="16" rx="1" />
          <rect x="7" y="2" width="5" height="8" rx="1" />
        </>
      );
    case "scavenger-scrapland":
      return (
        <>
          <circle cx="-6" cy="2" r="4" />
          <circle cx="5" cy="-3" r="5" />
          <path d="M -12 10 L 10 -10 M -2 15 L 8 -15" />
        </>
      );
    case "chemical-waste":
    case "petro-marsh":
      return (
        <>
          <path d="M 0 -12 C 6 -5 9 1 9 6 C 9 11 5 15 0 15 C -5 15 -9 11 -9 6 C -9 1 -6 -5 0 -12 Z" />
          <path d="M -4 5 C -1 2 1 2 4 5" />
        </>
      );
    case "irradiated-badlands":
      return (
        <>
          <path d="M 0 -12 L 12 10 L -12 10 Z" />
          <circle cx="0" cy="2" r="3.5" />
        </>
      );
    case "industrial-hulk":
      return (
        <>
          <rect x="-11" y="-4" width="8" height="14" rx="1" />
          <rect x="1" y="-9" width="8" height="19" rx="1" />
          <path d="M -7 -8 L -7 -4 M 5 -14 L 5 -9" />
        </>
      );
    case "mutant-nest":
      return (
        <>
          <ellipse cx="0" cy="4" rx="10" ry="7" />
          <path d="M -9 -3 L -4 -11 M 0 -5 L 0 -14 M 9 -3 L 4 -11" />
        </>
      );
    case "steam-fissures":
      return (
        <>
          <path d="M -8 12 L -4 -8 L 0 12 Z" />
          <path d="M 2 12 L 6 -12 L 10 12 Z" />
          <path d="M -1 -12 C -5 -16 -4 -19 -1 -22 M 7 -15 C 3 -19 4 -22 7 -25" />
        </>
      );
    case "flooded-dam":
      return (
        <>
          <path d="M -10 -8 L -10 10 L 10 10 L 10 -8" />
          <path d="M -6 -8 L -6 10 M 0 -8 L 0 10 M 6 -8 L 6 10" />
          <path d="M -12 4 C -8 7 -4 7 0 4 C 4 1 8 1 12 4" />
        </>
      );
    case "algae-salt-flats":
      return (
        <>
          <path d="M -12 8 C -7 2 -2 2 3 8 C 7 12 10 12 12 8" />
          <path d="M -10 -2 C -5 -8 0 -8 5 -2 C 8 1 10 1 12 -1" />
          <circle cx="-6" cy="-6" r="2.5" />
          <circle cx="4" cy="-8" r="2.5" />
        </>
      );
    case "ash-farmland":
      return (
        <>
          <path d="M -11 10 C -7 6 -3 6 1 10 C 5 14 8 14 11 10" />
          <path d="M -11 2 C -7 -2 -3 -2 1 2 C 5 6 8 6 11 2" />
          <path d="M -11 -6 C -7 -10 -3 -10 1 -6 C 5 -2 8 -2 11 -6" />
        </>
      );
    default:
      return (
        <>
          <circle cx="0" cy="0" r="10" />
          <path d="M -10 0 H 10 M 0 -10 V 10" />
        </>
      );
  }
}

function renderTerrainAmbientLayer(terrainType: TerrainType) {
  switch (terrainType) {
    case "toxic-forest":
    case "fungal-wetlands":
      return (
        <>
          <circle className="ambient-orb drift-a" cx="-14" cy="-10" r="8" />
          <circle className="ambient-orb drift-b" cx="6" cy="-16" r="10" />
          <circle className="ambient-orb drift-c" cx="18" cy="-4" r="7" />
        </>
      );
    case "chemical-waste":
    case "petro-marsh":
    case "algae-salt-flats":
      return (
        <>
          <path className="ambient-wave drift-a" d="M -26 4 C -18 -2 -12 -2 -4 4 C 3 9 10 9 18 4 C 23 1 28 1 32 5" />
          <path className="ambient-wave drift-b" d="M -24 -8 C -15 -13 -8 -13 -1 -8 C 6 -3 13 -3 22 -8" />
          <circle className="ambient-speck drift-c" cx="18" cy="-16" r="4" />
        </>
      );
    case "steam-fissures":
    case "irradiated-badlands":
      return (
        <>
          <path className="ambient-plume drift-a" d="M -8 18 C -12 6 -10 -4 -4 -16" />
          <path className="ambient-plume drift-b" d="M 6 18 C 0 4 2 -6 10 -20" />
          <circle className="ambient-speck drift-c" cx="16" cy="-10" r="4" />
        </>
      );
    case "mutant-nest":
      return (
        <>
          <circle className="ambient-orb pulse-a" cx="-16" cy="-6" r="6" />
          <circle className="ambient-orb pulse-b" cx="16" cy="-4" r="5" />
          <path className="ambient-wave drift-c" d="M -18 10 C -8 4 2 4 14 10" />
        </>
      );
    case "flooded-dam":
    case "ash-farmland":
      return (
        <>
          <path className="ambient-wave drift-a" d="M -28 8 C -20 2 -12 2 -4 8 C 4 14 12 14 22 8" />
          <path className="ambient-wave drift-b" d="M -24 -6 C -14 -10 -6 -10 2 -6 C 10 -2 18 -2 26 -6" />
        </>
      );
    default:
      return (
        <>
          <circle className="ambient-orb drift-a" cx="-10" cy="-12" r="6" />
          <circle className="ambient-orb drift-b" cx="12" cy="-6" r="5" />
        </>
      );
  }
}

function renderTerrainTileDetail(terrainType: TerrainType, decorVariant: number) {
  const variantClass = `detail-variant-${decorVariant % 4}`;
  switch (terrainType) {
    case "toxic-forest":
      return (
        <g className={`hex-terrain-detail forest ${variantClass}`}>
          <path d="M -18 8 C -10 -2 -4 -4 4 -15" />
          <path d="M -5 18 C 2 7 9 2 18 -8" />
          <circle cx="-11" cy="-6" r="3.4" />
          <circle cx="10" cy="8" r="2.8" />
        </g>
      );
    case "fungal-wetlands":
      return (
        <g className={`hex-terrain-detail wetlands ${variantClass}`}>
          <path d="M -22 9 C -12 2 -4 2 5 9 C 11 14 17 14 23 8" />
          <ellipse cx="-8" cy="-7" rx="5" ry="2.6" />
          <ellipse cx="10" cy="-2" rx="6" ry="3" />
        </g>
      );
    case "overgrown-ruins":
      return (
        <g className={`hex-terrain-detail ruins ${variantClass}`}>
          <path d="M -18 14 L -5 -12 L 10 13" />
          <path d="M -9 2 H 11" />
          <path d="M -14 -10 C -8 -5 -3 -2 3 5" />
        </g>
      );
    case "scavenger-scrapland":
      return (
        <g className={`hex-terrain-detail scrap ${variantClass}`}>
          <path d="M -18 12 L 15 -12" />
          <path d="M -8 -13 L 18 8" />
          <circle cx="-12" cy="-2" r="3.5" />
          <circle cx="9" cy="10" r="3" />
        </g>
      );
    case "chemical-waste":
    case "petro-marsh":
      return (
        <g className={`hex-terrain-detail waste ${variantClass}`}>
          <path d="M -20 10 C -12 4 -4 4 4 10 C 12 16 18 16 23 10" />
          <path d="M -15 -5 C -8 -11 -2 -11 5 -5 C 10 -1 15 -1 19 -6" />
          <circle cx="8" cy="6" r="3.2" />
        </g>
      );
    case "irradiated-badlands":
      return (
        <g className={`hex-terrain-detail irradiated ${variantClass}`}>
          <path d="M -22 11 L -5 -4 L 6 8 L 21 -10" />
          <path d="M -10 -14 L 8 16" />
          <circle cx="1" cy="-1" r="4" />
        </g>
      );
    case "industrial-hulk":
      return (
        <g className={`hex-terrain-detail industrial ${variantClass}`}>
          <rect x="-16" y="-8" width="8" height="19" rx="1.5" />
          <rect x="4" y="-14" width="8" height="26" rx="1.5" />
          <path d="M -20 14 H 18 M -12 -8 V -16 M 8 -14 V -22" />
        </g>
      );
    case "mutant-nest":
      return (
        <g className={`hex-terrain-detail nest ${variantClass}`}>
          <ellipse cx="0" cy="7" rx="15" ry="7" />
          <path d="M -12 0 L -17 -12 M 0 -1 V -17 M 12 0 L 18 -12" />
          <circle cx="-5" cy="7" r="2.2" />
          <circle cx="6" cy="8" r="2" />
        </g>
      );
    case "steam-fissures":
      return (
        <g className={`hex-terrain-detail fissures ${variantClass}`}>
          <path d="M -17 16 L -7 -13 L 1 16" />
          <path d="M 5 17 L 13 -18 L 20 17" />
          <path d="M -6 -14 C -12 -20 -10 -25 -5 -29 M 13 -19 C 8 -25 9 -30 14 -34" />
        </g>
      );
    case "flooded-dam":
      return (
        <g className={`hex-terrain-detail dam ${variantClass}`}>
          <path d="M -22 -8 V 12 H 22 V -8" />
          <path d="M -9 -8 V 12 M 4 -8 V 12" />
          <path d="M -24 7 C -15 13 -7 13 1 7 C 9 1 17 1 24 7" />
        </g>
      );
    case "algae-salt-flats":
      return (
        <g className={`hex-terrain-detail algae ${variantClass}`}>
          <ellipse cx="-10" cy="5" rx="10" ry="4.2" />
          <ellipse cx="12" cy="-5" rx="8.5" ry="3.8" />
          <path d="M -23 16 C -13 10 -5 10 4 16 C 11 21 17 21 23 15" />
        </g>
      );
    case "ash-farmland":
      return (
        <g className={`hex-terrain-detail farmland ${variantClass}`}>
          <path d="M -24 14 C -15 9 -7 9 1 14 C 9 19 16 19 24 13" />
          <path d="M -21 3 C -12 -2 -4 -2 4 3 C 12 8 18 8 22 3" />
          <path d="M -18 -9 C -10 -13 -2 -13 6 -9 C 13 -5 18 -5 22 -9" />
        </g>
      );
    case "neutral-rock":
      return (
        <g className={`hex-terrain-detail rock ${variantClass}`}>
          <path d="M -19 11 L -7 -10 L 3 3 L 16 -14" />
          <path d="M -13 -8 L 10 15" />
        </g>
      );
    default:
      return null;
  }
}

function renderRegionSignatureGlyph(regionId: string) {
  switch (regionId) {
    case "toxic-forest":
      return (
        <>
          <path d="M 0 18 C -11 8 -13 -2 -9 -13 C -6 -22 0 -28 0 -28 C 0 -28 6 -22 9 -13 C 13 -2 11 8 0 18 Z" />
          <path d="M 0 18 L 0 31" />
          <path d="M -14 -4 C -5 -12 5 -12 14 -4" />
          <path d="M -9 4 C -3 -1 3 -1 9 4" />
        </>
      );
    case "scavenger-run":
      return (
        <>
          <path d="M -24 22 H 24" />
          <path d="M -18 22 L -9 -18 H 7 L 15 22" />
          <path d="M -12 4 H 12" />
          <path d="M -20 12 H 18" />
          <path d="M 1 -18 L 10 -26" />
        </>
      );
    case "fungal-wetlands":
      return (
        <>
          <path d="M -14 28 C -16 10 -13 0 -8 -12" />
          <path d="M 2 28 C -1 10 1 -2 6 -18" />
          <path d="M 16 28 C 13 13 15 3 20 -10" />
          <path d="M -16 -8 C -8 -18 1 -18 8 -8" />
          <path d="M -1 -15 C 6 -24 15 -24 22 -15" />
        </>
      );
    case "overgrown-ruins":
      return (
        <>
          <path d="M -22 24 L -4 -18 L 18 24" />
          <path d="M -12 6 H 8" />
          <path d="M -4 -18 L 8 -6" />
          <path d="M -16 22 C -12 7 -9 -1 -2 -10" />
        </>
      );
    case "waste-basin":
      return (
        <>
          <rect x="-20" y="2" width="16" height="18" rx="3" />
          <rect x="-1" y="-8" width="16" height="28" rx="3" />
          <path d="M -12 2 V -8 M 7 -8 V -18" />
          <path d="M -22 20 C -14 14 -6 14 2 20 C 10 26 18 26 24 20" />
        </>
      );
    case "mutant-nest":
      return (
        <>
          <ellipse cx="0" cy="12" rx="16" ry="10" />
          <path d="M -10 4 L -16 -10 M -2 1 L -3 -16 M 8 4 L 16 -11" />
          <path d="M -8 16 C -2 11 2 11 8 16" />
        </>
      );
    case "irradiated-fields":
      return (
        <>
          <path d="M 0 -24 L 14 24 L -14 24 Z" />
          <path d="M -20 10 H -6 M 7 10 H 20" />
          <path d="M 0 -8 V 24" />
          <path d="M -7 3 H 7" />
        </>
      );
    case "industrial-hulk":
      return (
        <>
          <rect x="-22" y="4" width="11" height="18" rx="1.5" />
          <rect x="-6" y="-8" width="12" height="30" rx="1.5" />
          <rect x="10" y="-16" width="10" height="38" rx="1.5" />
          <path d="M -16 4 V -4 M 0 -8 V -18 M 15 -16 V -28" />
          <path d="M -22 22 H 20" />
        </>
      );
    case "petro-marsh":
      return (
        <>
          <path d="M -18 20 H 20" />
          <path d="M -10 20 L 4 -6 L 16 20" />
          <path d="M 4 -6 L 13 -11" />
          <path d="M -8 9 H 9" />
          <path d="M -20 27 C -12 21 -4 21 4 27 C 12 31 18 31 24 26" />
        </>
      );
    case "steam-fissures":
      return (
        <>
          <path d="M -18 24 L -8 -14 L 1 24 Z" />
          <path d="M 4 24 L 15 -20 L 24 24 Z" />
          <path d="M -8 -14 C -13 -20 -12 -25 -8 -29" />
          <path d="M 15 -20 C 10 -27 11 -32 16 -36" />
        </>
      );
    case "flooded-dam":
      return (
        <>
          <path d="M -24 -10 L -24 22 H 24 V -10" />
          <path d="M -10 -10 V 22 M 4 -10 V 22" />
          <path d="M -28 8 C -20 15 -10 15 0 8 C 9 1 18 1 28 8" />
          <path d="M -24 -10 L 24 -10" />
        </>
      );
    case "algae-salt-flats":
      return (
        <>
          <ellipse cx="-11" cy="8" rx="10" ry="5.5" />
          <ellipse cx="12" cy="1" rx="11" ry="6" />
          <path d="M -20 23 C -11 15 -4 15 3 23 C 10 30 17 30 24 22" />
          <path d="M -4 1 V -10 M 10 -7 V -18" />
        </>
      );
    case "ash-farmland":
      return (
        <>
          <path d="M -23 22 C -14 16 -6 16 2 22 C 9 28 16 28 23 22" />
          <path d="M -20 10 C -11 4 -3 4 5 10 C 12 16 18 16 24 10" />
          <path d="M -17 -2 C -8 -8 0 -8 8 -2 C 15 4 21 4 26 -1" />
          <path d="M -6 -8 V 2 M 8 -14 V -3" />
        </>
      );
    default:
      return (
        <>
          <circle cx="0" cy="0" r="14" />
          <path d="M -16 0 H 16 M 0 -16 V 16" />
        </>
      );
  }
}

function renderRegionRelicGlyph(regionId: string) {
  switch (regionId) {
    case "toxic-forest":
      return (
        <>
          <path d="M -12 11 C -5 5 4 5 12 11" />
          <circle cx="-8" cy="2" r="4" />
          <circle cx="4" cy="-5" r="5" />
          <path d="M 4 0 V 12 M -8 6 V 12" />
        </>
      );
    case "scavenger-run":
      return (
        <>
          <rect x="-13" y="-5" width="26" height="10" rx="2" />
          <path d="M -10 5 L -14 13 M 10 5 L 14 13" />
          <path d="M -8 -5 L -3 -12 H 8" />
        </>
      );
    case "fungal-wetlands":
      return (
        <>
          <path d="M -15 12 C -7 7 7 7 15 12" />
          <path d="M -7 8 V -5 M 6 8 V -9" />
          <path d="M -13 -4 C -7 -12 0 -12 5 -4" />
          <path d="M 1 -8 C 8 -16 15 -16 18 -8" />
        </>
      );
    case "overgrown-ruins":
      return (
        <>
          <path d="M -14 13 L -6 -10 H 8 L 14 13" />
          <path d="M -7 1 H 9" />
          <path d="M -10 13 C -8 3 -4 -4 2 -9" />
        </>
      );
    case "waste-basin":
      return (
        <>
          <rect x="-14" y="-8" width="10" height="19" rx="2" />
          <rect x="2" y="-12" width="11" height="23" rx="2" />
          <path d="M -16 13 C -9 8 -2 8 5 13 C 10 17 15 17 18 13" />
        </>
      );
    case "mutant-nest":
      return (
        <>
          <ellipse cx="0" cy="8" rx="13" ry="7" />
          <path d="M -10 3 L -15 -8 M 0 1 V -13 M 10 3 L 15 -8" />
          <circle cx="0" cy="7" r="3" />
        </>
      );
    case "irradiated-fields":
      return (
        <>
          <path d="M 0 -15 L 12 13 H -12 Z" />
          <circle cx="0" cy="3" r="3.5" />
          <path d="M -16 13 H 16" />
        </>
      );
    case "industrial-hulk":
      return (
        <>
          <rect x="-13" y="-3" width="8" height="16" rx="1" />
          <rect x="2" y="-12" width="9" height="25" rx="1" />
          <path d="M -14 13 H 14 M -9 -3 V -10 M 7 -12 V -18" />
        </>
      );
    case "petro-marsh":
      return (
        <>
          <path d="M -13 13 H 15" />
          <path d="M -7 13 L 3 -9 L 12 13" />
          <path d="M 3 -9 L 12 -13" />
          <path d="M -15 18 C -8 14 -2 14 5 18 C 10 21 15 21 19 17" />
        </>
      );
    case "steam-fissures":
      return (
        <>
          <path d="M -12 14 L -5 -11 L 2 14 Z" />
          <path d="M 5 14 L 11 -15 L 17 14 Z" />
          <path d="M -5 -11 C -10 -15 -9 -19 -5 -22 M 11 -15 C 7 -20 8 -23 12 -26" />
        </>
      );
    case "flooded-dam":
      return (
        <>
          <path d="M -16 -7 V 12 H 16 V -7" />
          <path d="M -6 -7 V 12 M 5 -7 V 12" />
          <path d="M -18 6 C -12 11 -5 11 1 6 C 7 1 13 1 19 6" />
        </>
      );
    case "algae-salt-flats":
      return (
        <>
          <ellipse cx="-7" cy="5" rx="8" ry="4" />
          <ellipse cx="9" cy="-2" rx="8" ry="4.5" />
          <path d="M -15 14 C -8 9 -2 9 4 14 C 10 18 15 18 19 13" />
        </>
      );
    case "ash-farmland":
      return (
        <>
          <path d="M -16 13 C -9 8 -3 8 3 13 C 9 18 14 18 18 13" />
          <path d="M -14 3 C -7 -2 -1 -2 5 3 C 11 8 16 8 19 3" />
          <path d="M -5 -7 V 6 M 8 -11 V 2" />
        </>
      );
    default:
      return (
        <>
          <rect x="-10" y="-10" width="20" height="20" rx="3" />
          <path d="M -7 0 H 7 M 0 -7 V 7" />
        </>
      );
  }
}

function getWorldWeatherTone(eventId: EventId | null) {
  switch (eventId) {
    case "toxic-storm":
      return "storm";
    case "swarm-raid":
      return "swarm";
    case "contamination-surge":
      return "contamination";
    default:
      return "calm";
  }
}

function canAffordFlow(resources: Record<ResourceId, number>, flow?: ResourceFlow) {
  if (!flow) return true;
  return Object.entries(flow).every(([resourceId, amount]) => resources[resourceId as ResourceId] >= Number(amount ?? 0));
}

function TimeRail() {
  const dayIndex = useGameStore((state) => state.dayIndex);
  const dayProgress = useGameStore((state) => state.dayProgress);
  const dayPhase = useGameStore((state) => state.dayPhase);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const pendingEvent = useGameStore((state) => state.pendingEvent);
  const eventForecast = useGameStore((state) => state.eventForecast);
  const lastForecast = eventForecast.length > 0 ? eventForecast[eventForecast.length - 1] : null;
  const forecastHorizon = Math.max(180, ((lastForecast?.forecastEnd ?? (elapsedSeconds + 180)) - elapsedSeconds));

  return (
    <section className="time-rail">
      <div className="time-rail-copy">
        <p className="eyebrow">Time Forecast</p>
        <div className="time-rail-headline">
          <h2>Day {dayIndex}</h2>
          <strong>{phaseLabels[dayPhase]}</strong>
          <span>
            {pendingEvent
              ? `${pendingEvent.title} awaiting command`
              : activeEvent
                ? `${activeEvent.title} live for ${Math.ceil(activeEvent.remaining)}s`
                : eventForecast.length > 0
                  ? `${eventForecast[0].title} expected ${formatForecastWindow(eventForecast[0], elapsedSeconds)}`
                  : "No active threat"}
          </span>
        </div>
      </div>
      <div className="timeline-shell">
        <div className="day-track">
          <div className={`phase-chip ${dayPhase === "dawn" ? "active" : ""}`}>Dawn</div>
          <div className={`phase-chip ${dayPhase === "day" ? "active" : ""}`}>Day</div>
          <div className={`phase-chip ${dayPhase === "dusk" ? "active" : ""}`}>Dusk</div>
          <div className={`phase-chip ${dayPhase === "night" ? "active" : ""}`}>Night</div>
          <div className="day-progress" style={{ width: `${dayProgress * 100}%` }} />
        </div>
        <div className="forecast-track bands">
          {eventForecast.map((event) => {
            const left = Math.min(100, (Math.max(0, event.forecastStart - elapsedSeconds) / forecastHorizon) * 100);
            const right = Math.min(100, (Math.max(0, event.forecastEnd - elapsedSeconds) / forecastHorizon) * 100);
            const width = Math.max(12, right - left);
            const stateClass = pendingEvent?.id === event.id ? "pending" : activeEvent?.id === event.id ? "active" : left < 18 ? "imminent" : "forecasted";
            return (
              <div key={`${event.id}-${event.startsAt}`} className={`forecast-band ${stateClass} ${getSeverityClass(event.severity)}`} style={{ left: `${left}%`, width: `${width}%` }}>
                <img className="forecast-band-art" src={event.art} alt={event.title} />
                <div className="forecast-band-shade" />
                <div className="forecast-band-copy">
                  <div className="forecast-band-head">
                    <span>{event.title}</span>
                    <em>{event.severity}</em>
                  </div>
                  <small>{formatForecastWindow(event, elapsedSeconds)}</small>
                  <small>{formatForecastCertainty(event.certainty)}</small>
                </div>
              </div>
            );
          })}
          {pendingEvent ? <div className={`forecast-pending-pill ${getSeverityClass(pendingEvent.severity)}`}>Awaiting response: {pendingEvent.title}</div> : null}
        </div>
      </div>
    </section>
  );
}
const regionCenters = Object.fromEntries(
  regionDefinitions.map((region) => {
    const regionTiles = region.hexTileIds.map((tileId) => tileMap[tileId]).filter(Boolean);
    const center = regionTiles.reduce((acc, tile) => ({ x: acc.x + tile.center.x, y: acc.y + tile.center.y }), { x: 0, y: 0 });
    const divisor = Math.max(1, regionTiles.length);
    return [region.id, { x: center.x / divisor, y: center.y / divisor }];
  })
) as Record<string, { x: number; y: number }>;

const regionGeometry = Object.fromEntries(
  regionDefinitions.map((region) => {
    const regionTiles = region.hexTileIds.map((tileId) => tileMap[tileId]).filter(Boolean);
    const center = regionCenters[region.id];
    const radius = regionTiles.reduce((max, tile) => {
      const distance = Math.hypot(tile.center.x - center.x, tile.center.y - center.y);
      return Math.max(max, distance);
    }, HEX_SIZE * 1.05);
    return [region.id, { center, radius: radius + HEX_SIZE * 0.9 }];
  })
) as Record<string, { center: { x: number; y: number }; radius: number }>;

const regionRelicOffsets = Object.fromEntries(
  regionDefinitions.map((region, index) => {
    const angle = (index * 137.5 * Math.PI) / 180;
    const distance = HEX_SIZE * (0.46 + (index % 3) * 0.1);
    return [region.id, { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance * 0.72 }];
  })
) as Record<string, { x: number; y: number }>;

const cityCoreTile = worldGeometry.tiles.find((tile) => tile.isCityCore) ?? worldGeometry.tiles[0];

function ResourceHud() {
  const resources = useGameStore((state) => state.resources);
  const pollution = useGameStore((state) => state.pollution);
  const population = useGameStore((state) => state.population);

  return (
    <header className="hud">
      <div className="brand">
        <p className="eyebrow">Pestizide Punk</p>
        <h1>Reactor City Authority</h1>
      </div>
      <div className="resource-grid expanded-grid">
        {resourceDefinitions.map((resource) => (
          <div className="resource-chip" key={resource.id}>
            <span className="resource-dot" style={{ background: resource.color }} />
            <span className="resource-label">{resource.label}</span>
            <strong>{formatResource(resources[resource.id])}</strong>
          </div>
        ))}
      </div>
      <div className="population-summary expanded-summary">
        <div><span>Health</span><strong>{population.health.toFixed(0)}%</strong></div>
        <div><span>Contamination</span><strong>{population.contamination.toFixed(0)}%</strong></div>
        <div><span>Stability</span><strong>{population.stability.toFixed(0)}%</strong></div>
        <div><span>Pollution</span><strong>{pollution.toFixed(0)}%</strong></div>
        <div className="summary-wide"><span>Protection</span><strong>{formatProtection(population.protection)}</strong></div>
      </div>
    </header>
  );
}

function WorldMap() {
  const regions = useGameStore((state) => state.regions);
  const selectedRegionId = useGameStore((state) => state.selectedRegionId);
  const selectRegion = useGameStore((state) => state.selectRegion);
  const setView = useGameStore((state) => state.setView);
  const dayPhase = useGameStore((state) => state.dayPhase);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const pendingEvent = useGameStore((state) => state.pendingEvent);
  const eventForecast = useGameStore((state) => state.eventForecast);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  const regionRuntimeMap = useMemo(() => Object.fromEntries(regions.map((region) => [region.id, region])), [regions]);
  const discoveredRegions = regions.filter((region) => region.discovered).length;
  const focusRegionId = hoveredRegionId ?? selectedRegionId;
  const focusRegionGeometry = focusRegionId ? regionGeometry[focusRegionId] : null;
  const cityCenter = cityCoreTile.center;
  const imminentForecast = !pendingEvent && !activeEvent
    ? eventForecast.find((event) => event.startsAt - elapsedSeconds <= 42)
    : null;
  const worldWeatherEventId = pendingEvent?.id ?? activeEvent?.id ?? imminentForecast?.id ?? null;
  const worldWeatherTone = getWorldWeatherTone(worldWeatherEventId);
  const weatherStateClass = pendingEvent ? "pending" : activeEvent ? "active" : imminentForecast ? "forecast" : "idle";

  return (
    <section className="canvas-card world-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">World Overview</p>
          <h2>Hex Frontier Board</h2>
        </div>
        <div className="world-toolbar">
          <span className="status-pill ghost">{discoveredRegions}/{regions.length} regions charted</span>
          <button className="ghost-button" onClick={() => setView("city")}>Enter City</button>
        </div>
      </div>
      <div className={`world-frame ${dayPhase} weather-${worldWeatherTone} weather-${weatherStateClass}`}>
        <div className={`world-phase-overlay ${dayPhase}`} />
        <div className={`world-weather-overlay ${worldWeatherTone} ${weatherStateClass}`}>
          <span className="weather-band band-a" />
          <span className="weather-band band-b" />
          <span className="weather-particles" />
        </div>
        <svg className="world-svg" viewBox={`0 0 ${worldGeometry.width} ${worldGeometry.height}`} role="img" aria-label="Hex world overview map">
          <defs>
            <radialGradient id="worldGlow" cx="50%" cy="44%" r="65%">
              <stop offset="0%" stopColor="rgba(255, 192, 96, 0.26)" />
              <stop offset="100%" stopColor="rgba(13, 15, 18, 0)" />
            </radialGradient>
            <pattern id="worldScanGrid" patternUnits="userSpaceOnUse" width="54" height="54">
              <path d="M 54 0 L 0 0 0 54" fill="none" stroke="rgba(243, 215, 159, 0.05)" strokeWidth="1" />
              <path d="M 27 0 L 27 54 M 0 27 L 54 27" fill="none" stroke="rgba(153, 212, 175, 0.035)" strokeWidth="0.8" />
            </pattern>
            <radialGradient id="worldVignette" cx="50%" cy="50%" r="68%">
              <stop offset="58%" stopColor="rgba(0,0,0,0)" />
              <stop offset="100%" stopColor="rgba(6, 8, 10, 0.46)" />
            </radialGradient>
            {worldGeometry.tiles.map((tile) => {
              const asset = terrainAssetMap[tile.terrainType];
              const tileImage = getTerrainVariantImage(tile.terrainType, tile.decorVariant);
              return (
                <pattern key={tile.id} id={`terrain-${tile.id}`} patternUnits="userSpaceOnUse" width={HEX_WIDTH} height={HEX_SIZE * 2}>
                  <rect width={HEX_WIDTH} height={HEX_SIZE * 2} fill="#101311" />
                  <image href={tileImage} x={0} y={0} width={HEX_WIDTH} height={HEX_SIZE * 2} preserveAspectRatio="xMidYMid slice" />
                  <rect width={HEX_WIDTH} height={HEX_SIZE * 2} fill={asset.accent} />
                </pattern>
              );
            })}
          </defs>
          <rect width={worldGeometry.width} height={worldGeometry.height} fill="url(#worldGlow)" />
          <rect className="world-scan-grid" width={worldGeometry.width} height={worldGeometry.height} fill="url(#worldScanGrid)" />
          <rect className="world-vignette" width={worldGeometry.width} height={worldGeometry.height} fill="url(#worldVignette)" />
          {focusRegionGeometry ? (
            <path
              className="world-route-line"
              d={`M ${cityCenter.x} ${cityCenter.y} Q ${(cityCenter.x + focusRegionGeometry.center.x) / 2} ${Math.min(cityCenter.y, focusRegionGeometry.center.y) - HEX_SIZE * 0.75} ${focusRegionGeometry.center.x} ${focusRegionGeometry.center.y}`}
            />
          ) : null}
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const geometry = regionGeometry[region.id];
            if (!runtime?.discovered || !geometry) return null;
            const selected = selectedRegionId === region.id;
            const hovered = hoveredRegionId === region.id;
            const terrain = terrainAssetMap[region.primaryTerrain];
            return (
              <g key={`${region.id}-atmosphere`} className={["region-atmosphere", runtime.state, selected ? "selected" : "", hovered ? "hovered" : ""].filter(Boolean).join(" ")}>
                <circle className="region-atmosphere-outer" cx={geometry.center.x} cy={geometry.center.y} r={geometry.radius * 1.08} style={{ fill: terrain.shadow }} />
                <circle className="region-atmosphere-mid" cx={geometry.center.x} cy={geometry.center.y} r={geometry.radius * 0.84} style={{ fill: terrain.accent }} />
                <circle
                  className={["region-state-halo", runtime.state, selected ? "selected" : "", hovered ? "hovered" : ""].filter(Boolean).join(" ")}
                  cx={geometry.center.x}
                  cy={geometry.center.y}
                  r={geometry.radius * 0.92}
                />
              </g>
            );
          })}
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const geometry = regionGeometry[region.id];
            if (!runtime?.discovered || !geometry) return null;
            const selected = selectedRegionId === region.id;
            const hovered = hoveredRegionId === region.id;
            return (
              <g
                key={`${region.id}-ambient`}
                className={`region-ambient ${selected ? "selected" : ""} ${hovered ? "hovered" : ""}`}
                transform={`translate(${geometry.center.x}, ${geometry.center.y - HEX_SIZE * 0.28})`}
              >
                {renderTerrainAmbientLayer(region.primaryTerrain)}
              </g>
            );
          })}
          {worldGeometry.tiles.map((tile) => {
            const runtime = tile.regionId ? regionRuntimeMap[tile.regionId] : null;
            const isCity = tile.isCityCore;
            const discovered = isCity || Boolean(runtime?.discovered);
            const selected = tile.regionId ? selectedRegionId === tile.regionId : false;
            const hovered = tile.regionId ? hoveredRegionId === tile.regionId : false;
            const terrain = terrainAssetMap[tile.terrainType];
            const stateClass = runtime ? `region-${runtime.state}` : "city-core";
            const className = ["hex-tile", stateClass, discovered ? "discovered" : "shadowed", selected ? "selected" : "", hovered ? "hovered" : "", isCity ? "city-core" : ""].filter(Boolean).join(" ");
            return (
              <g key={tile.id} className={className} onMouseEnter={() => setHoveredRegionId(tile.regionId)} onMouseLeave={() => setHoveredRegionId(null)} onClick={() => {
                if (isCity) {
                  setView("city");
                  return;
                }
                if (tile.regionId) selectRegion(tile.regionId);
              }} role="button" tabIndex={0}>
                <polygon className="hex-base" points={tile.points} fill={`url(#terrain-${tile.id})`} />
                <polygon className="hex-danger" points={tile.points} fill={tile.dangerTint ?? terrain.accent} />
                <g transform={`translate(${tile.center.x}, ${tile.center.y}) rotate(${(tile.decorVariant % 4) * 22.5})`}>
                  {discovered ? renderTerrainTileDetail(tile.terrainType, tile.decorVariant) : null}
                </g>
                <polygon className="hex-stroke" points={tile.points} stroke={terrain.stroke} />
                {!discovered ? <polygon className="hex-fog" points={tile.points} /> : null}
                {isCity ? (
                  <g className="city-reactor-mark">
                    <circle className="city-reactor-ring outer" cx={tile.center.x} cy={tile.center.y} r={HEX_SIZE * 0.5} />
                    <circle className="city-reactor-ring inner" cx={tile.center.x} cy={tile.center.y} r={HEX_SIZE * 0.33} />
                    <image
                      href={cityVisual.worldIcon}
                      x={tile.center.x - HEX_SIZE * 0.72}
                      y={tile.center.y - HEX_SIZE * 0.72}
                      width={HEX_SIZE * 1.44}
                      height={HEX_SIZE * 1.44}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  </g>
                ) : null}
              </g>
            );
          })}
          {worldTransitionEdges.map((edge) => {
            const fromRuntime = edge.fromRegionId ? regionRuntimeMap[edge.fromRegionId] : null;
            const toRuntime = edge.toRegionId ? regionRuntimeMap[edge.toRegionId] : null;
            const discovered = Boolean(fromRuntime?.discovered && toRuntime?.discovered);
            if (!discovered) return null;

            const selected = (edge.fromRegionId && selectedRegionId === edge.fromRegionId) || (edge.toRegionId && selectedRegionId === edge.toRegionId);
            const hovered = (edge.fromRegionId && hoveredRegionId === edge.fromRegionId) || (edge.toRegionId && hoveredRegionId === edge.toRegionId);
            const terrain = terrainAssetMap[edge.terrainType];
            return (
              <g key={edge.id} className={`terrain-transition ${selected ? "selected" : ""} ${hovered ? "hovered" : ""}`}>
                <line className="terrain-transition-shadow" x1={edge.start.x} y1={edge.start.y} x2={edge.end.x} y2={edge.end.y} style={{ stroke: terrain.shadow }} />
                <line className="terrain-transition-stroke" x1={edge.start.x} y1={edge.start.y} x2={edge.end.x} y2={edge.end.y} style={{ stroke: terrain.stroke }} />
              </g>
            );
          })}
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const geometry = regionGeometry[region.id];
            if (!runtime?.discovered || !geometry) return null;
            const selected = selectedRegionId === region.id;
            const hovered = hoveredRegionId === region.id;
            const terrain = terrainAssetMap[region.primaryTerrain];
            return (
              <g
                key={`${region.id}-signature`}
                className={`region-signature-landmark ${selected ? "selected" : ""} ${hovered ? "hovered" : ""}`}
                transform={`translate(${geometry.center.x}, ${geometry.center.y - HEX_SIZE * 0.88})`}
              >
                <ellipse className="region-signature-aura" rx={34} ry={16} style={{ fill: terrain.shadow }} />
                <path className="region-signature-plinth" d="M -26 27 C -18 21 -10 20 0 20 C 10 20 18 21 26 27 C 18 31 10 33 0 33 C -10 33 -18 31 -26 27 Z" style={{ fill: terrain.accent }} />
                <g className="region-signature-glyph">{renderRegionSignatureGlyph(region.id)}</g>
              </g>
            );
          })}
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const geometry = regionGeometry[region.id];
            const offset = regionRelicOffsets[region.id] ?? { x: HEX_SIZE * 0.42, y: HEX_SIZE * 0.16 };
            if (!runtime?.discovered || !geometry) return null;
            const selected = selectedRegionId === region.id;
            const hovered = hoveredRegionId === region.id;
            const terrain = terrainAssetMap[region.primaryTerrain];
            return (
              <g
                key={`${region.id}-relic`}
                className={`region-relic-landmark ${selected ? "selected" : ""} ${hovered ? "hovered" : ""}`}
                transform={`translate(${geometry.center.x + offset.x}, ${geometry.center.y + offset.y})`}
              >
                <circle className="region-relic-backplate" r={17} style={{ fill: terrain.shadow, stroke: terrain.stroke }} />
                <g className="region-relic-glyph">{renderRegionRelicGlyph(region.id)}</g>
              </g>
            );
          })}
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const geometry = regionGeometry[region.id];
            if (!runtime?.discovered || !geometry) return null;
            const selected = selectedRegionId === region.id;
            const hovered = hoveredRegionId === region.id;
            const terrain = terrainAssetMap[region.primaryTerrain];
            return (
              <g
                key={`${region.id}-landmark`}
                className={`region-landmark ${selected ? "selected" : ""} ${hovered ? "hovered" : ""}`}
                transform={`translate(${geometry.center.x}, ${geometry.center.y - HEX_SIZE * 0.16})`}
              >
                <circle className="region-landmark-plinth" r={18} style={{ fill: terrain.shadow }} />
                <circle className="region-landmark-core" r={14} style={{ fill: terrain.accent, stroke: terrain.stroke }} />
                <g className="region-landmark-glyph">{renderTerrainLandmarkGlyph(region.primaryTerrain)}</g>
                <text className="region-landmark-caption" x={0} y={31} textAnchor="middle">
                  {getTerrainLandmarkLabel(region.primaryTerrain)}
                </text>
              </g>
            );
          })}
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const labelCenter = regionCenters[region.id];
            if (!runtime?.discovered || !labelCenter) return null;
            const width = Math.max(104, region.name.length * 7.8);
            return (
              <g
                key={`${region.id}-label`}
                className={`region-label ${selectedRegionId === region.id ? "selected" : ""} ${hoveredRegionId === region.id ? "hovered" : ""}`}
                transform={`translate(${labelCenter.x}, ${labelCenter.y + HEX_SIZE * 1.26})`}
              >
                <rect className="region-label-pill" x={-width / 2} y={-14} width={width} height={28} rx={14} />
                <circle className="region-label-dot" cx={-width / 2 + 14} cy={0} r={4.2} />
                <text x={0} y={4} textAnchor="middle">{region.name}</text>
              </g>
            );
          })}
        </svg>
        <div className="world-legend">
          <div><span className="legend-dot discovered" /><span>discovered</span></div>
          <div><span className="legend-dot shadowed" /><span>undiscovered outline</span></div>
          <div><span className="legend-dot selected" /><span>selected region</span></div>
        </div>
      </div>
    </section>
  );
}

function CityView() {
  const buildings = useGameStore((state) => state.buildings);
  const selectedSlotId = useGameStore((state) => state.selectedSlotId);
  const districts = useGameStore((state) => state.districts);
  const reactor = useGameStore((state) => state.reactor);
  const selectSlot = useGameStore((state) => state.selectSlot);
  const setView = useGameStore((state) => state.setView);
  const unlockedSlotIds = new Set(districts.map((slot) => slot.id));

  return (
    <section className="canvas-card city-shell">
      <div className="panel-header">
        <div>
          <p className="eyebrow">City View</p>
          <h2>Reactor District Slots</h2>
        </div>
        <div className="world-toolbar">
          <span className="status-pill ghost">Reactor Tier {reactor.tier}</span>
          <button className="ghost-button" onClick={() => setView("world")}>Back To World</button>
        </div>
      </div>
      <div className="city-hero-frame">
        <img className="city-hero-art" src={cityVisual.hero} alt={cityVisual.label} />
        <div className="city-hero-overlay" />
        <div className="city-hero-copy">
          <p className="eyebrow">Central Bastion</p>
          <h3>{cityVisual.label}</h3>
          <span>Chem-industrial core, staffing hub, and survival heart of the colony.</span>
        </div>
      </div>
      <div className="city-plate">
        <button className={`reactor-core reactor-core-art ${selectedSlotId === null ? "selected" : ""}`} onClick={() => selectSlot(null)}>
          <div className="reactor-core-aura" />
          <img className="reactor-core-image" src={cityVisual.core} alt="Reactor Core" />
          <div className="reactor-core-copy">
            <span>Containment Spine</span>
            <strong>Reactor Core</strong>
            <small>Tier {reactor.tier} / {districts.length} active slots</small>
          </div>
        </button>
        {districtSlots.map((slot) => {
          const building = buildings.find((item) => item.slotId === slot.id);
          const definition = building ? buildingMap[building.buildingId] : null;
          const visual = definition ? getBuildingVisual(definition.id, definition.name) : null;
          const unlocked = unlockedSlotIds.has(slot.id);
          return (
            <button key={slot.id} disabled={!unlocked} className={`district-slot ${selectedSlotId === slot.id ? "selected" : ""} ${building ? "occupied" : "empty"} ${unlocked ? "unlocked" : "locked"}`} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => unlocked && selectSlot(slot.id)}>
              {visual ? (
                <div className="district-icon" style={{ background: visual.tint }}>
                  <img src={visual.icon} alt={definition?.name ?? visual.label} />
                </div>
              ) : null}
              <span>{slot.label}</span>
              <strong>{unlocked ? (definition?.name ?? "Empty Slot") : `Locked until Reactor T${slot.unlockTier ?? 1}`}</strong>
              {unlocked
                ? (building ? <small>L{building.level} {building.enabled ? "Online" : "Standby"}</small> : <small>Ready for expansion</small>)
                : <small>Expand the reactor to claim this node</small>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ViewTabs() {
  const view = useGameStore((state) => state.view);
  const setView = useGameStore((state) => state.setView);
  const tabs: { id: ViewMode; label: string }[] = [{ id: "world", label: "World" }, { id: "city", label: "City" }, { id: "research", label: "Research" }, { id: "heroes", label: "Heroes" }];

  return (
    <nav className="view-tabs">
      {tabs.map((tab) => (
        <button key={tab.id} className={view === tab.id ? "active" : ""} onClick={() => setView(tab.id)}>{tab.label}</button>
      ))}
    </nav>
  );
}

function RegionActionButtons() {
  const selectedRegionId = useGameStore((state) => state.selectedRegionId);
  const regions = useGameStore((state) => state.regions);
  const launchExpedition = useGameStore((state) => state.launchExpedition);
  const researched = useGameStore((state) => state.researched);
  const resources = useGameStore((state) => state.resources);
  const protection = useGameStore((state) => state.population.protection);
  const heroes = useGameStore((state) => state.heroes);
  const dayPhase = useGameStore((state) => state.dayPhase);
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);

  const regionDefinition = selectedRegionId ? regionMap[selectedRegionId] : null;
  const regionRuntime = regions.find((region) => region.id === selectedRegionId);
  if (!regionDefinition || !regionRuntime) return null;
  const selectedHeroes = heroes.filter((hero) => selectedHeroIds.includes(hero.id));
  const groupProtection = mergeProtection(protection, getHeroGroupProtection(selectedHeroes));
  const selectedHeroesAvailable = selectedHeroes.length === selectedHeroIds.length && selectedHeroes.every((hero) => hero.status === "available");

  const canStart = (kind: ExpeditionKind) => {
    const requirement = kind === "survey" ? regionDefinition.access : kind === "exploit" ? regionDefinition.exploit : kind === "secure" ? regionDefinition.secure : { tech: ["relay-network"] };
    const techOk = (requirement.tech ?? []).every((techId) => researched.includes(techId));
    const gearTier = resources.gear >= 12 ? 3 : resources.gear >= 6 ? 2 : resources.gear >= 3 ? 1 : 0;
    const protectionOk = Object.entries(requirement.protection ?? {}).every(([slot, amount]) => groupProtection[slot as ProtectionSlotId] >= Number(amount ?? 0));
    const limits = getHeroGroupLimits(kind);
    const heroCountOk = selectedHeroes.length >= limits.min && selectedHeroes.length <= limits.max;
    const outpostOk = kind !== "outpost" || getHeroGroupSkills(selectedHeroes).engineering + getHeroGroupSkills(selectedHeroes).survival >= 3;
    return techOk && protectionOk && gearTier >= (requirement.gear ?? 0) && heroCountOk && selectedHeroesAvailable && outpostOk;
  };

  const actions = [
    { kind: "survey" as ExpeditionKind, label: "Survey Region", requirement: regionDefinition.access, disabled: regionRuntime.state !== "known" },
    { kind: "exploit" as ExpeditionKind, label: "Start Exploitation", requirement: regionDefinition.exploit, disabled: regionRuntime.state !== "surveyed" || !canStart("exploit") },
    { kind: "secure" as ExpeditionKind, label: "Secure Region", requirement: regionDefinition.secure, disabled: regionRuntime.state !== "exploiting" || !canStart("secure") },
    { kind: "outpost" as ExpeditionKind, label: "Raise Outpost", requirement: { tech: ["relay-network"] }, disabled: regionRuntime.state !== "secured" || !canStart("outpost") }
  ];

  return (
    <div className="action-stack hero-composer">
      <div className="hero-picker-list">
        {heroes.map((hero) => {
          const selected = selectedHeroIds.includes(hero.id);
          const disabled = hero.status !== "available" && !selected;
          return (
            <button
              key={hero.id}
              className={`hero-picker ${selected ? "selected" : ""}`}
              disabled={disabled}
              onClick={() => setSelectedHeroIds((current) => selected ? current.filter((id) => id !== hero.id) : [...current, hero.id])}
            >
              <span>{hero.name}</span>
              <small>L{hero.level} {hero.archetype} / {hero.status}</small>
            </button>
          );
        })}
      </div>
      {selectedHeroes.length > 0 ? (
        <div className="mission-preview">
          <span>Group</span>
          <strong>{Object.entries(getHeroGroupSkills(selectedHeroes)).filter(([, value]) => value > 0).map(([skill, value]) => `${skill} ${value}`).join(" / ")}</strong>
          <small>Protection with gear: {formatProtection(groupProtection)}</small>
        </div>
      ) : <div className="muted-box">Select heroes from the roster before launching a mission.</div>}
      {actions.map((item) => (
        <button key={item.kind} disabled={item.disabled || !canStart(item.kind)} onClick={() => launchExpedition(regionDefinition.id, item.kind, selectedHeroIds)}>
          <span>{item.label}</span>
          <small>{(() => {
            const limits = getHeroGroupLimits(item.kind);
            const preview = getMissionPreview(regionDefinition, item.kind, selectedHeroes, dayPhase);
            const gateText = item.disabled && item.kind !== "survey" ? getBlockedReason(item.requirement, researched, resources.gear, groupProtection) : getRequirementSummary(item.requirement, researched, resources.gear, groupProtection).join(" / ");
            return `${gateText} / Heroes ${selectedHeroes.length}/${limits.min}-${limits.max} / ${preview.duration}s / risk ${Math.round(preview.risk * 100)}%`;
          })()}</small>
        </button>
      ))}
    </div>
  );
}

function DetailsPanel() {
  const view = useGameStore((state) => state.view);
  const selectedRegionId = useGameStore((state) => state.selectedRegionId);
  const selectedSlotId = useGameStore((state) => state.selectedSlotId);
  const selectedResearchId = useGameStore((state) => state.selectedResearchId);
  const regions = useGameStore((state) => state.regions);
  const buildings = useGameStore((state) => state.buildings);
  const buildInSlot = useGameStore((state) => state.buildInSlot);
  const toggleBuilding = useGameStore((state) => state.toggleBuilding);
  const upgradeBuilding = useGameStore((state) => state.upgradeBuilding);
  const chooseBuildingUpgrade = useGameStore((state) => state.chooseBuildingUpgrade);
  const reactor = useGameStore((state) => state.reactor);
  const upgradeReactor = useGameStore((state) => state.upgradeReactor);
  const researched = useGameStore((state) => state.researched);
  const activeResearch = useGameStore((state) => state.activeResearch);
  const startResearch = useGameStore((state) => state.startResearch);
  const resources = useGameStore((state) => state.resources);
  const protection = useGameStore((state) => state.population.protection);

  const selectedRegion = selectedRegionId ? regionMap[selectedRegionId] : null;
  const selectedRegionState = regions.find((region) => region.id === selectedRegionId);
  const selectedSlot = districtSlots.find((slot) => slot.id === selectedSlotId);
  const selectedResearchNode = researchNodes.find((node) => node.id === selectedResearchId) ?? researchNodes[0];
  const existingBuilding = buildings.find((item) => item.slotId === selectedSlotId);
  const existingDefinition = existingBuilding ? buildingMap[existingBuilding.buildingId] : null;
  const effectiveBuilding = existingBuilding && existingDefinition ? getEffectiveBuildingData(existingDefinition, existingBuilding) : null;
  const buildOptions = buildingDefinitions.filter((definition) => {
    if (!selectedSlotId) return false;
    if (definition.unlockTech && !researched.includes(definition.unlockTech)) return false;
    return !buildings.some((instance) => instance.slotId === selectedSlotId);
  });
  const reactorBonuses = getReactorTierBonuses(reactor.tier);
  const nextReactorUpgrade = reactorUpgradeDefinitions.find((definition) => definition.id === reactor.nextUpgradeId) ?? null;
  const reactorUpgradeReady = nextReactorUpgrade ? nextReactorUpgrade.tech.every((techId) => researched.includes(techId)) && canAffordFlow(resources, nextReactorUpgrade.cost) : false;

  return (
    <aside className="detail-panel">
      {view === "world" && selectedRegion && selectedRegionState ? (
        <>
          <div className="panel-header">
            <div>
              <p className="eyebrow">{selectedRegion.archetype}</p>
              <h2>{selectedRegion.name}</h2>
            </div>
            <span className={`status-pill ${selectedRegionState.state}`}>{regionStateLabel[selectedRegionState.state]}</span>
          </div>
          <p className="panel-copy">{selectedRegion.description}</p>{selectedRegion.detailImage ? (<div className="region-art-frame"><img src={selectedRegion.detailImage} alt={selectedRegion.name} className="region-art" /><div className="region-art-caption"><span>{selectedRegion.archetype}</span><strong>{terrainAssetMap[selectedRegion.primaryTerrain].label}</strong></div></div>) : null}
          <div className="region-hazard-strip">
            {getRegionHazardSummary(selectedRegion.hazard).map(([hazard, score]) => (
              <span key={hazard} className="hazard-chip">{hazard} {score}</span>
            ))}
          </div>
          <div className="panel-grid">
            <div><span>Ring</span><strong>{selectedRegion.ring}</strong></div>
            <div><span>Terrain</span><strong>{terrainAssetMap[selectedRegion.primaryTerrain].label}</strong></div>
            <div><span>Hexes</span><strong>{selectedRegion.hexTileIds.length}</strong></div>
            <div><span>Hazards</span><strong>{Object.entries(selectedRegion.hazard).map(([hazard, score]) => `${hazard} ${score}`).join(" / ")}</strong></div>
          </div>
          <div className="subsection">
            <h3>Yield</h3>
            <ul className="flat-list">
              {Object.entries(selectedRegion.resources).map(([resourceId, amount]) => (
                <li key={resourceId}>
                  {resourceDefinitions.find((resource) => resource.id === (resourceId as ResourceId))?.label ?? resourceId}
                  <strong>+{Number(amount ?? 0)}</strong>
                </li>
              ))}
            </ul>
          </div>
          <div className="subsection">
            <h3>Protection</h3>
            <div className="flow-tags"><span className="flow-tag">Current: {formatProtection(protection)}</span></div>
          </div>
          <div className="subsection">
            <h3>Action Gates</h3>
            <div className="flow-tags">
              <span className="flow-tag">Survey: {getRequirementSummary(selectedRegion.access, researched, resources.gear, protection).join(" / ")}</span>
              <span className="flow-tag">Exploit: {getRequirementSummary(selectedRegion.exploit, researched, resources.gear, protection).join(" / ")}</span>
              <span className="flow-tag">Secure: {getRequirementSummary(selectedRegion.secure, researched, resources.gear, protection).join(" / ")}</span>
            </div>
          </div>
          <div className="subsection">
            <h3>Actions</h3>
            <RegionActionButtons />
          </div>
        </>
      ) : null}

      {view === "city" ? (
        <>
          {selectedSlot ? (
            <>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">District Slot</p>
                  <h2>{selectedSlot.label}</h2>
                </div>
              </div>
              {existingBuilding && existingDefinition && effectiveBuilding ? (
                <>
                  {(() => {
                    const visual = getBuildingVisual(existingDefinition.id, existingDefinition.name);
                    return (
                      <div className="building-hero" style={{ background: visual.tint }}>
                        <div className="building-hero-icon"><img src={visual.icon} alt={existingDefinition.name} /></div>
                        <div>
                          <p className="panel-copy">{existingDefinition.description}</p>
                          <div className="building-hero-label">{visual.label}</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div className="meta-list">
                    <div className="meta-row"><span>Building</span><strong>{existingDefinition.name}</strong></div>
                    <div className="meta-row"><span>Status</span><strong className={`status-tag ${existingBuilding.enabled ? "online" : "offline"}`}>{existingBuilding.enabled ? "Online" : "Standby"}</strong></div>
                    <div className="meta-row"><span>Level</span><strong>L{existingBuilding.level}</strong></div>
                    <div className="meta-row"><span>Staff</span><strong>{Object.entries(existingDefinition.staff).map(([role, amount]) => `${amount} ${role}`).join(" / ") || "No assigned staff"}</strong></div>
                    <div className="meta-row"><span>Doctrine</span><strong>{effectiveBuilding.selectedUpgrade?.name ?? "Base chassis"}</strong></div>
                  </div>
                  <div className="subsection">
                    <h3>Output</h3>
                    <div className="flow-tags">{formatFlow(effectiveBuilding.output, existingBuilding.level).map((item) => <span key={item} className="flow-tag positive">{item}</span>)}</div>
                  </div>
                  <div className="subsection">
                    <h3>Upkeep</h3>
                    <div className="flow-tags">{formatFlow(effectiveBuilding.upkeep, existingBuilding.level, true).map((item) => <span key={item} className="flow-tag">{item}</span>)}</div>
                  </div>
                  <div className="subsection">
                    <h3>Tradeoffs</h3>
                    <div className="flow-tags">
                      {effectiveBuilding.doctrineTags.map((tag) => <span key={tag} className="flow-tag doctrine">{tag}</span>)}
                      {effectiveBuilding.emissions ? <span className="flow-tag warning">Emissions +{effectiveBuilding.emissions.toFixed(2)}</span> : null}
                      {effectiveBuilding.wasteOutput.pollution ? <span className="flow-tag warning">Pollution +{effectiveBuilding.wasteOutput.pollution.toFixed(2)}</span> : null}
                      {Object.keys(effectiveBuilding.storageCapacity).length > 0 ? <span className="flow-tag">Storage: {formatFlow(effectiveBuilding.storageCapacity)}</span> : null}
                      {Object.keys(effectiveBuilding.protectionOutput).length > 0 ? <span className="flow-tag">Protection: {formatProtection(effectiveBuilding.protectionOutput as Record<ProtectionSlotId, number>)}</span> : null}
                    </div>
                  </div>
                  {existingBuilding.level >= 2 && (existingDefinition.upgradeOptions?.length ?? 0) > 0 ? (
                    <div className="subsection">
                      <h3>Doctrine Upgrade</h3>
                      {effectiveBuilding.selectedUpgrade ? (
                        <div className="card-emphasis doctrine-card">
                          <strong>{effectiveBuilding.selectedUpgrade.name}</strong>
                          <span>{effectiveBuilding.selectedUpgrade.description}</span>
                        </div>
                      ) : (
                        <div className="build-list doctrine-list">
                          {existingDefinition.upgradeOptions?.map((option) => (
                            <button key={option.id} className="build-option doctrine-option" onClick={() => chooseBuildingUpgrade(selectedSlot.id, option.id)}>
                              <span>{option.name}</span>
                              <small>{option.description}</small>
                              <small>{formatCost(option.cost)}</small>
                              <small>{(option.doctrineTags ?? []).join(" / ") || "generalist"}</small>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <div className="subsection">
                    <h3>Actions</h3>
                    <div className="inline-actions">
                      <button onClick={() => toggleBuilding(selectedSlot.id)}>{existingBuilding.enabled ? "Put On Standby" : "Bring Online"}</button>
                      <button onClick={() => upgradeBuilding(selectedSlot.id)} disabled={existingBuilding.level >= 2}>
                        {existingBuilding.level >= 2 ? "Max Level" : `Upgrade (${Object.entries(existingDefinition.cost).map(([resourceId, amount]) => `${resourceDefinitions.find((resource) => resource.id === (resourceId as ResourceId))?.label ?? resourceId} ${Math.ceil(Number(amount ?? 0) * 0.8 * existingBuilding.level)}`).join(" / ")})`}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="panel-copy">Build into this district slot to widen your economy and unlock cleaner or dirtier doctrine paths.</p>
                  <div className="subsection">
                    <h3>Build Menu</h3>
                    <div className="build-list">
                      {buildOptions.map((definition) => {
                        const visual = getBuildingVisual(definition.id, definition.name);
                        return (
                          <button key={definition.id} className="build-option rich-option" onClick={() => buildInSlot(selectedSlot.id, definition.id)}>
                            <div className="build-option-icon" style={{ background: visual.tint }}><img src={visual.icon} alt={definition.name} /></div>
                            <div className="build-option-copy">
                              <span>{definition.name}</span>
                              <small>{definition.description}</small>
                              <small>{(definition.doctrineTags ?? []).join(" / ") || "generalist"}</small>
                            </div>
                          </button>
                        );
                      })}
                      {buildOptions.length === 0 ? <div className="muted-box">All available buildings here are locked or already built.</div> : null}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Core Console</p>
                  <h2>Reactor Tier {reactor.tier}</h2>
                </div>
                <span className="status-pill available">{reactor.unlockedSlotIds.length} Slots Online</span>
              </div>
              <div className="reactor-dossier">
                <img src={cityVisual.core} alt="Reactor Core" className="reactor-dossier-art" />
                <div className="reactor-dossier-copy">
                  <p className="panel-copy">The central reactor now governs city capacity directly. Each tier expands the bastion, steadies the grid, and hardens the colony against chemical collapse.</p>
                  <div className="panel-grid">
                    <div><span>Slots Online</span><strong>{reactor.unlockedSlotIds.length}</strong></div>
                    <div><span>Next Upgrade</span><strong>{nextReactorUpgrade?.name ?? "Max tier in prototype"}</strong></div>
                    <div><span>Passive Power</span><strong>+{reactorBonuses.passivePower.toFixed(1)}</strong></div>
                    <div><span>Research Lift</span><strong>+{reactorBonuses.researchRate.toFixed(2)}</strong></div>
                  </div>
                  <div className="subsection">
                    <h3>Core Bonuses</h3>
                    <div className="flow-tags">
                      <span className="flow-tag positive">Contamination shield {reactorBonuses.contaminationShield.toFixed(2)}</span>
                      <span className="flow-tag positive">Stability support {reactorBonuses.stabilitySupport.toFixed(2)}</span>
                      {Object.entries(reactorBonuses.hazardMitigation).map(([hazard, value]) => <span key={hazard} className="flow-tag">{hazard} {Number(value).toFixed(1)}</span>)}
                    </div>
                  </div>
                  <div className="subsection">
                    <h3>Expansion Path</h3>
                    {nextReactorUpgrade ? (
                      <div className="card-emphasis reactor-upgrade-card">
                        <strong>{nextReactorUpgrade.name}</strong>
                        <span>{nextReactorUpgrade.description}</span>
                        <small>Requires: {nextReactorUpgrade.tech.map((techId) => researchNodeMap[techId]?.name ?? techId).join(" / ")}</small>
                        <small>Cost: {formatCost(nextReactorUpgrade.cost)}</small>
                        <small>Unlocks: {nextReactorUpgrade.unlockSlotIds.length > 0 ? nextReactorUpgrade.unlockSlotIds.length : 0} new slots</small>
                        <button onClick={upgradeReactor} disabled={!reactorUpgradeReady}>{reactorUpgradeReady ? "Upgrade Reactor" : "Requirements not met"}</button>
                      </div>
                    ) : (
                      <div className="muted-box">Tier 4 is installed. Future module sockets can attach here in a later pass.</div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {view === "research" ? (() => {
        const selectedResearchState = getResearchNodeState(selectedResearchNode.id, researched, activeResearch?.nodeId, resources.research);
        const selectedResearchChildren = getResearchChildren(selectedResearchNode.id);
        const selectedResearchUnlockGroups = getResearchUnlockGroups(selectedResearchNode);
        const selectedResearchDossierStyle: CSSProperties & Record<"--branch-color", string> = {
          "--branch-color": getResearchBranchColor(selectedResearchNode.branch)
        };

        return (
          <>
            <div className="panel-header">
              <div>
                <p className="eyebrow">Technology Dossier</p>
                <h2>{selectedResearchNode.name}</h2>
              </div>
              <span className={`status-pill ${selectedResearchState}`}>{selectedResearchState}</span>
            </div>
            <section className="research-dossier" style={selectedResearchDossierStyle}>
              <div className="research-dossier-hero">
                <div className="dossier-motif-strip">
                  {selectedResearchNode.doctrineTags.length > 0 ? selectedResearchNode.doctrineTags.map((tag) => <span key={tag} className="motif-pill">{tag}</span>) : <span className="motif-pill">generalist</span>}
                </div>
                <div>
                  <div className="dossier-kicker-row">
                    <span className="dossier-branch-pill">{selectedResearchNode.branch}</span>
                    <span className="dossier-tier-pill">Tier {selectedResearchNode.tier}</span>
                  </div>
                  <p>{selectedResearchNode.description}</p>
                </div>
                <div className="dossier-stat-grid">
                  <div><span>Research Cost</span><strong>{selectedResearchNode.cost}</strong></div>
                  <div><span>Stock Available</span><strong>{resources.research.toFixed(0)}</strong></div>
                  <div><span>Prerequisites</span><strong>{selectedResearchNode.prerequisites.length}</strong></div>
                  <div><span>Follow-ups</span><strong>{selectedResearchChildren.length}</strong></div>
                </div>
              </div>

              <div className="dossier-route-grid">
                <div className="route-block">
                  <h3>Feeds From</h3>
                  <div className="flow-tags">
                    {selectedResearchNode.prerequisites.length > 0 ? selectedResearchNode.prerequisites.map((prerequisiteId) => {
                      const prerequisite = researchNodeMap[prerequisiteId];
                      const ready = researched.includes(prerequisiteId);
                      return <span key={prerequisiteId} className={`flow-tag ${ready ? "positive" : ""}`}>{ready ? "Ready" : "Missing"}: {prerequisite?.name ?? prerequisiteId}</span>;
                    }) : <span className="flow-tag positive">No prerequisites</span>}
                  </div>
                </div>
                <div className="route-block current">
                  <h3>Current Node</h3>
                  <div className="flow-tags">
                    <span className="flow-tag doctrine">{selectedResearchNode.branch}</span>
                    <span className="flow-tag">Tier {selectedResearchNode.tier}</span>
                    <span className="flow-tag">{selectedResearchState}</span>
                  </div>
                </div>
                <div className="route-block">
                  <h3>Leads To</h3>
                  <div className="flow-tags">
                    {selectedResearchChildren.length > 0 ? selectedResearchChildren.map((child) => (
                      <span key={child.id} className="flow-tag">{child.name}</span>
                    )) : <span className="flow-tag">No downstream projects</span>}
                  </div>
                </div>
              </div>

              <div className="subsection">
                <h3>Unlock Portfolio</h3>
                <div className="dossier-unlock-groups">
                  <div className="unlock-group-card">
                    <span>Structures</span>
                    <div className="flow-tags">
                      {selectedResearchUnlockGroups.structures.length > 0 ? selectedResearchUnlockGroups.structures.map((unlock) => <span key={unlock} className="flow-tag">{unlock}</span>) : <span className="flow-tag">No structures</span>}
                    </div>
                  </div>
                  <div className="unlock-group-card">
                    <span>Safeguards</span>
                    <div className="flow-tags">
                      {selectedResearchUnlockGroups.safeguards.length > 0 ? selectedResearchUnlockGroups.safeguards.map((unlock) => <span key={unlock} className="flow-tag positive">{unlock}</span>) : <span className="flow-tag">No safeguards</span>}
                    </div>
                  </div>
                  <div className="unlock-group-card">
                    <span>Protocols</span>
                    <div className="flow-tags">
                      {selectedResearchUnlockGroups.protocols.length > 0 ? selectedResearchUnlockGroups.protocols.map((unlock) => <span key={unlock} className="flow-tag doctrine">{unlock}</span>) : <span className="flow-tag">No protocols</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="subsection">
                <h3>Doctrine Fingerprint</h3>
                <div className="flow-tags">
                  {selectedResearchNode.doctrineTags.length > 0 ? selectedResearchNode.doctrineTags.map((tag) => <span key={tag} className="flow-tag doctrine">{tag}</span>) : <span className="flow-tag">Generalist</span>}
                </div>
              </div>

              <div className="subsection">
                <h3>Actions</h3>
                <div className="inline-actions single-action">
                  <button onClick={() => startResearch(selectedResearchNode.id)} disabled={selectedResearchState !== "available"}>
                    {selectedResearchState === "done"
                      ? "Already unlocked"
                      : selectedResearchState === "active"
                        ? "Research in progress"
                        : selectedResearchState === "available"
                          ? `Start Research (${selectedResearchNode.cost})`
                          : "Locked"}
                  </button>
                </div>
              </div>
            </section>
          </>
        );
      })() : null}
    </aside>
  );
}

function ResearchCanvas() {
  const researched = useGameStore((state) => state.researched);
  const activeResearch = useGameStore((state) => state.activeResearch);
  const selectedResearchId = useGameStore((state) => state.selectedResearchId);
  const selectResearch = useGameStore((state) => state.selectResearch);
  const resources = useGameStore((state) => state.resources);
  const treeLayout = useMemo(() => buildResearchTreeLayout(), []);
  const selectedNode = (selectedResearchId ? researchNodeMap[selectedResearchId] : undefined) ?? researchNodes[0];
  const selectedCluster = getResearchCluster(selectedNode.id);
  const tierDescriptors = [
    { tier: 0, label: 'Roots', className: 'root' },
    { tier: 1, label: 'Tier 1', className: '' },
    { tier: 2, label: 'Tier 2', className: '' },
    { tier: 3, label: 'Tier 3', className: '' },
    { tier: 4, label: 'Tier 4', className: '' }
  ];

  return (
    <section className="canvas-card research-shell">
      <div className="panel-header research-panel-header">
        <div>
          <p className="eyebrow">Research Canopy</p>
          <h2>Industrial Evolution Tree</h2>
        </div>
        <div className="research-status-cluster">
          <div className="status-tile">
            <span>Research Stock</span>
            <strong>{resources.research.toFixed(0)}</strong>
          </div>
          <div className="status-tile wide">
            <span>Focus</span>
            <strong>{activeResearch ? researchNodeMap[activeResearch.nodeId]?.name ?? activeResearch.nodeId : "No active project"}</strong>
          </div>
        </div>
      </div>
      <div className="research-tree-shell">
        <div className="research-tier-row">
          {tierDescriptors.map((descriptor) => (
            <div key={descriptor.label} className={["research-tier-chip", descriptor.className].filter(Boolean).join(" ")}>
              <span>{descriptor.label}</span>
            </div>
          ))}
        </div>
        <div className="research-tree-stage" style={{ width: `${treeLayout.width}px`, height: `${treeLayout.height}px` }}>
          <svg className="research-links" viewBox={`0 0 ${treeLayout.width} ${treeLayout.height}`} preserveAspectRatio="xMinYMin meet">
            {treeLayout.links.map((link) => {
              const midX = (link.x1 + link.x2) / 2;
              const isSelectedPath = selectedCluster.has(link.sourceId) && selectedCluster.has(link.targetId);
              return (
                <path
                  key={link.id}
                  d={`M ${link.x1} ${link.y1} C ${midX} ${link.y1}, ${midX} ${link.y2}, ${link.x2} ${link.y2}`}
                  style={{
                    stroke: link.color,
                    opacity: isSelectedPath ? 0.92 : 0.2,
                    strokeWidth: isSelectedPath ? 2.8 : 1.3
                  }}
                />
              );
            })}
          </svg>
          {treeLayout.branchLabels.map((label) => {
            const branchHasSelection = Array.from(selectedCluster).some((nodeId) => researchNodeMap[nodeId]?.branch === label.branch && researchNodeMap[nodeId]?.tier === label.tier);
            return (
              <div
                key={label.key}
                className={["research-branch-label", branchHasSelection ? "active" : ""].filter(Boolean).join(" ")}
                style={{ left: `${label.x}px`, top: `${label.y}px`, borderColor: label.color, color: label.color }}
              >
                {label.branch}
              </div>
            );
          })}
          {treeLayout.nodeLayouts.map((layout) => {
            const node = researchNodeMap[layout.id];
            if (!node) return null;
            const state = getResearchNodeState(node.id, researched, activeResearch?.nodeId, resources.research);
            const isSelected = selectedNode.id === node.id;
            const isRelated = selectedCluster.has(node.id);
            const nodeStyle: CSSProperties & Record<"--branch-color", string> = {
              left: `${layout.x}px`,
              top: `${layout.y}px`,
              width: `${layout.width}px`,
              height: `${layout.height}px`,
              "--branch-color": getResearchBranchColor(node.branch)
            };
            return (
              <button
                key={node.id}
                className={["tree-node", state, isSelected ? "selected" : "", !isSelected && isRelated ? "related" : "", !isRelated ? "dimmed" : ""].filter(Boolean).join(" ")}
                style={nodeStyle}
                onClick={() => selectResearch(node.id)}
              >
                <span className="tree-node-topline">
                  <span>{node.branch}</span>
                  <em>T{node.tier}</em>
                </span>
                <strong>{node.name}</strong>
                <small>{node.description}</small>
                <div className="tree-node-meta">
                  <span>{state}</span>
                  <span>{node.cost} RP</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HeroesView() {
  const heroes = useGameStore((state) => state.heroes);
  const candidates = useGameStore((state) => state.heroCandidates);
  const resources = useGameStore((state) => state.resources);
  const nextRefresh = useGameStore((state) => state.nextHeroCandidateRefreshAt);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const hireHero = useGameStore((state) => state.hireHero);
  const refreshHeroCandidates = useGameStore((state) => state.refreshHeroCandidates);
  const available = heroes.filter((hero) => hero.status === "available").length;
  const injured = heroes.filter((hero) => hero.status === "injured" || hero.status === "recovering").length;

  return (
    <section className="canvas-card heroes-shell">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Hero Roster</p>
          <h2>Expedition Teams</h2>
        </div>
        <div className="research-status-cluster">
          <div className="status-tile"><span>Available</span><strong>{available}</strong></div>
          <div className="status-tile"><span>In Recovery</span><strong>{injured}</strong></div>
        </div>
      </div>
      <div className="hero-roster-grid">
        {heroes.map((hero) => {
          const skills = getHeroEffectiveSkills(hero);
          return (
            <article key={hero.id} className={`hero-card ${hero.status}`}>
              <div className="hero-card-head">
                <div>
                  <span>{hero.archetype}</span>
                  <strong>{hero.name}</strong>
                </div>
                <em>L{hero.level}</em>
              </div>
              <div className="hero-status-row">
                <span className={`status-pill ${hero.status}`}>{hero.status}</span>
                {hero.injury ? <span className="flow-tag warning">{hero.injury} injury</span> : null}
              </div>
              <div className="hero-skill-grid">
                {heroSkillIds.map((skillId) => <div key={skillId}><span>{skillId}</span><strong>{skills[skillId]}</strong></div>)}
              </div>
              <div className="flow-tags">
                {hero.traits.map((trait) => <span key={trait} className="flow-tag doctrine">{trait}</span>)}
              </div>
              <div className="hero-inventory">
                {hero.inventory.map((item) => <span key={item.id}>{item.name} {item.durability}%</span>)}
              </div>
            </article>
          );
        })}
      </div>
      <div className="subsection">
        <div className="panel-header compact-header">
          <div>
            <p className="eyebrow">Recruitment Board</p>
            <h2>City Hires</h2>
          </div>
          <button className="ghost-button" onClick={refreshHeroCandidates}>Refresh</button>
        </div>
        <div className="candidate-grid">
          {candidates.map((candidate) => {
            const affordable = canAffordFlow(resources, candidate.hireCost);
            return (
              <button key={candidate.id} className="candidate-card" onClick={() => hireHero(candidate.id)} disabled={!affordable}>
                <span>{candidate.archetype}</span>
                <strong>{candidate.name}</strong>
                <small>{Object.entries(getHeroEffectiveSkills(candidate)).filter(([, value]) => value > 0).map(([skill, value]) => `${skill} ${value}`).join(" / ")}</small>
                <small>{candidate.inventory.map((item) => item.name).join(" / ")}</small>
                <small>Cost: {formatCost(candidate.hireCost)}</small>
              </button>
            );
          })}
          {candidates.length === 0 ? <div className="muted-box">Recruitment board is empty. Refresh to call in a new set of candidates.</div> : null}
        </div>
        <div className="muted-box">Next automatic refresh in {formatDuration(Math.max(0, nextRefresh - elapsedSeconds))}.</div>
      </div>
    </section>
  );
}

function BottomBar() {
  const speed = useGameStore((state) => state.speed);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const dayIndex = useGameStore((state) => state.dayIndex);
  const dayPhase = useGameStore((state) => state.dayPhase);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const pendingEvent = useGameStore((state) => state.pendingEvent);
  const eventForecast = useGameStore((state) => state.eventForecast);
  const expeditions = useGameStore((state) => state.expeditions);
  const heroes = useGameStore((state) => state.heroes);
  const log = useGameStore((state) => state.log);
  const pollution = useGameStore((state) => state.pollution);
  const reactor = useGameStore((state) => state.reactor);
  const setSpeed = useGameStore((state) => state.setSpeed);
  const saveGame = useGameStore((state) => state.saveGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const advanceTime = useGameStore((state) => state.advanceTime);
  const eventSummary = pendingEvent
    ? `${pendingEvent.title} awaiting response`
    : activeEvent
      ? `${activeEvent.title} (${Math.ceil(activeEvent.remaining)}s)`
      : eventForecast.map((event) => `${event.title} ${formatForecastWindow(event, elapsedSeconds)}`).join(" | ");
  const eventVisual = pendingEvent ?? activeEvent ?? eventForecast[0] ?? null;

  return (
    <footer className="bottom-bar">
      <div className="control-group">
        {speedOptions.map((option) => (
          <button key={option} className={speed === option ? "active" : ""} onClick={() => setSpeed(option)}>{option === 0 ? "Pause" : `${option}x`}</button>
        ))}
        <button onClick={() => advanceTime(10000)}>Advance +10s</button>
        <button onClick={saveGame}>Save</button>
        <button className="danger-lite" onClick={resetGame}>Reset</button>
      </div>
      <div className="status-block"><span>Elapsed</span><strong>{formatDuration(elapsedSeconds)}</strong></div>
      <div className="status-block"><span>Cycle</span><strong>Day {dayIndex} / {phaseLabels[dayPhase]}</strong></div>
      <div className="status-block"><span>Reactor</span><strong>T{reactor.tier} / {reactor.unlockedSlotIds.length} slots</strong></div>
            <div className={`status-block wide event-status ${eventVisual ? "with-art" : ""}`}>
        <span>Event</span>
        {eventVisual ? (
          <div className="event-status-body">
            <img src={eventVisual.art} alt={eventVisual.title} className="event-status-art" />
            <div>
              <strong>{eventSummary || "No forecast"}</strong>
              <small>{eventVisual.severity} threat picture</small>
            </div>
          </div>
        ) : <strong>{eventSummary || "No forecast"}</strong>}
      </div>
      <div className="status-block"><span>Pollution</span><strong>{pollution.toFixed(0)}%</strong></div>
      <div className="status-block wide"><span>Expeditions</span><strong>{expeditions.length > 0 ? expeditions.map((item) => {
        const names = item.heroIds.map((heroId) => heroes.find((hero) => hero.id === heroId)?.name.split(" ")[0] ?? heroId).join(",");
        return `${item.kind}:${Math.ceil(item.remaining)}s ${names}`;
      }).join(" | ") : "No missions underway"}</strong></div>
      <div className="status-block wide"><span>Log</span><strong>{log[0]}</strong></div>
    </footer>
  );
}

function CrisisModal() {
  const pendingEvent = useGameStore((state) => state.pendingEvent);
  const resources = useGameStore((state) => state.resources);
  const resolvePendingEvent = useGameStore((state) => state.resolvePendingEvent);
  if (!pendingEvent) return null;

  return (
    <div className="crisis-modal-backdrop">
      <section className={`crisis-modal ${pendingEvent.id} ${getSeverityClass(pendingEvent.severity)}`}>
        <div className="crisis-art-frame">
          <img src={pendingEvent.art} alt={pendingEvent.title} className="crisis-art" />
          <div className="crisis-art-overlay" />
          <div className="crisis-art-copy">
            <p className="eyebrow">Crisis Event</p>
            <h2>{pendingEvent.title}</h2>
            <span>{pendingEvent.severity}</span>
          </div>
        </div>
        <div className="crisis-body">
          <div className="crisis-copy">
            <p>{pendingEvent.description}</p>
            <div className="flow-tags">
              <span className="flow-tag warning">Gameplay paused until command is issued</span>
              <span className="flow-tag">Forecast became impact reality</span>
            </div>
          </div>
          <div className="crisis-options">
            {pendingEvent.responses.map((response) => {
              const affordable = canAffordFlow(resources, response.cost);
              return (
                <button key={response.id} className={`crisis-option ${affordable ? "" : "disabled"}`} onClick={() => resolvePendingEvent(response.id)} disabled={!affordable}>
                  <div className="crisis-option-head">
                    <strong>{response.label}</strong>
                    <span>Mitigation {Math.round(response.mitigation * 100)}%</span>
                  </div>
                  <p>{response.description}</p>
                  <small>Cost: {formatCost(response.cost)}</small>
                </button>
              );
            })}
            <button className="crisis-option ignore" onClick={() => resolvePendingEvent()}>
              <div className="crisis-option-head">
                <strong>Ignore / Minimal Response</strong>
                <span>High risk</span>
              </div>
              <p>Preserve stock now and accept the harsher fallout of meeting the crisis unprepared.</p>
              <small>No immediate spend</small>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function AlertStack() {
  const alerts = useGameStore((state) => state.alerts);
  const pendingEvent = useGameStore((state) => state.pendingEvent);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const eventForecast = useGameStore((state) => state.eventForecast);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const forecastHeroEvent = !pendingEvent && !activeEvent ? eventForecast[0] ?? null : null;
  const heroEvent = pendingEvent ?? activeEvent ?? forecastHeroEvent;
  const heroEventCaption = pendingEvent || activeEvent
    ? heroEvent?.description ?? ""
    : forecastHeroEvent
      ? formatForecastWindow(forecastHeroEvent, elapsedSeconds)
      : "";

  return (
    <div className="alert-stack">
      {heroEvent ? (
        <div className={`alert-card event-alert ${pendingEvent ? "pending" : activeEvent ? "active" : "forecast"} ${getSeverityClass(heroEvent.severity)}`}>
          <img src={heroEvent.art} alt={heroEvent.title} className="event-alert-art" />
          <div className="event-alert-copy">
            <span>{pendingEvent ? "Awaiting response" : activeEvent ? "Crisis active" : "Forecast tracked"}</span>
            <strong>{heroEvent.title}</strong>
            <small>{heroEventCaption}</small>
          </div>
        </div>
      ) : null}
      {alerts.map((alert) => <div key={alert.id} className={`alert-card ${alert.tone}`}><span className="alert-kicker">{alert.tone}</span><strong>{alert.text}</strong></div>)}
    </div>
  );
}
function OperationsPanel() {
  const buildings = useGameStore((state) => state.buildings);
  const expeditions = useGameStore((state) => state.expeditions);
  const population = useGameStore((state) => state.population);
  const heroes = useGameStore((state) => state.heroes);
  const pollution = useGameStore((state) => state.pollution);
  const freeRoles = getFreeRoles(buildings, expeditions, population.roles);
  const doctrineProfile = getDoctrineProfile(buildings);
  const doctrineSummary = summarizeDoctrineProfile(doctrineProfile) || "no doctrine mix yet";
  const technicalLoad = doctrineProfile.synthetic + doctrineProfile.engineered + doctrineProfile.fossil + doctrineProfile.radical;
  const staffingRisk = freeRoles.technicians <= 1 && technicalLoad >= 3 ? "overstretched" : freeRoles.technicians <= 3 || freeRoles.workers <= 4 ? "tight" : "stable";
  const heroSummary = `${heroes.filter((hero) => hero.status === "available").length} ready / ${heroes.filter((hero) => hero.status === "assigned").length} assigned / ${heroes.filter((hero) => hero.status === "injured" || hero.status === "recovering").length} recovering`;
  const bestSpecialist = heroes
    .filter((hero) => hero.status === "available")
    .map((hero) => {
      const skills = getHeroEffectiveSkills(hero);
      const best = Object.entries(skills).sort((left, right) => Number(right[1]) - Number(left[1]))[0];
      return `${hero.name.split(" ")[0]} ${best?.[0] ?? "general"} ${best?.[1] ?? 0}`;
    })[0] ?? "no free specialists";

  return (
    <section className="tutorial-panel">
      <p className="eyebrow">Directive</p>
      <h2>Operations Board</h2>
      <div className="mini-grid">
        {Object.entries(freeRoles).map(([role, amount]) => (
          <div key={role} className="mini-panel"><span>{role}</span><strong>{amount}</strong></div>
        ))}
      </div>
      <div className="mini-panel wide-panel">
        <span>Protection Spread</span>
        <strong>{formatProtection(population.protection)}</strong>
      </div>
      <div className="mini-panel wide-panel">
        <span>Doctrine Mix</span>
        <strong>{doctrineSummary}</strong>
      </div>
      <div className="mini-panel wide-panel">
        <span>Staffing Risk</span>
        <strong>{staffingRisk}</strong>
      </div>
      <div className="mini-panel wide-panel">
        <span>Heroes</span>
        <strong>{heroSummary}</strong>
      </div>
      <div className="mini-panel wide-panel">
        <span>Best Free Specialist</span>
        <strong>{bestSpecialist}</strong>
      </div>
      <div className="mini-panel wide-panel">
        <span>Doctrine Pressure</span>
        <strong>{pollution < 20 ? "stable" : pollution < 40 ? "strained" : "hazardous"}</strong>
      </div>
      <ol className="flat-list ordered">
        <li>Clean, storage, and resilient doctrines now soften toxic storm shock and contamination spikes.</li>
        <li>Bio and chemical doctrine stacks improve swarm response before you even field heavy towers.</li>
        <li>Synthetic, fossil, and radical stacks now raise contamination-surge fallout if you neglect buffers.</li>
        <li>If technical staffing falls behind an aggressive doctrine mix, stability starts to slip under load.</li>
        <li>Protection tiers still matter alongside gear; doctrine is support, not a replacement for hazard prep.</li>
      </ol>
    </section>
  );
}

export function App() {
  const view = useGameStore((state) => state.view);
  const speed = useGameStore((state) => state.speed);
  const advanceTime = useGameStore((state) => state.advanceTime);

  useEffect(() => {
    if (speed === 0) return undefined;
    const handle = window.setInterval(() => {
      advanceTime(1000 * speed);
    }, 1000);
    return () => window.clearInterval(handle);
  }, [advanceTime, speed]);

  return (
    <div className="app-shell">
      <ResourceHud />
      <TimeRail />
      <main className="main-layout">
        <div className="left-column">
          <ViewTabs />
          {view === "world" ? <WorldMap /> : null}
          {view === "city" ? <CityView /> : null}
          {view === "research" ? <ResearchCanvas /> : null}
          {view === "heroes" ? <HeroesView /> : null}
          <AlertStack />
        </div>
        <div className="right-column">
          <OperationsPanel />
          <DetailsPanel />
        </div>
      </main>
      <BottomBar />
      <CrisisModal />
    </div>
  );
}
























