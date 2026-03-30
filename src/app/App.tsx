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
  Expedition,
  ExpeditionKind,
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

  expeditions.forEach((expedition) => {
    Object.entries(expedition.staff).forEach(([role, amount]) => {
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

function getHexPoints(center: { x: number; y: number }) {
  const points: string[] = [];
  for (let index = 0; index < 6; index += 1) {
    const angle = ((60 * index - 30) * Math.PI) / 180;
    points.push(`${center.x + HEX_SIZE * Math.cos(angle)},${center.y + HEX_SIZE * Math.sin(angle)}`);
  }
  return points.join(" ");
}

const worldGeometry = (() => {
  const projected = worldHexes.map((tile) => {
    const center = hexToPixel(tile);
    return { ...tile, center, points: getHexPoints(center) };
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
    return { ...tile, center, points: getHexPoints(center) };
  });

  return { width, height, tiles: normalized };
})();

const tileMap = Object.fromEntries(worldGeometry.tiles.map((tile) => [tile.id, tile])) as Record<string, HexTileDefinition & { center: { x: number; y: number }; points: string }>;

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
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  const regionRuntimeMap = useMemo(() => Object.fromEntries(regions.map((region) => [region.id, region])), [regions]);
  const discoveredRegions = regions.filter((region) => region.discovered).length;

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
      <div className="world-frame">
        <svg className="world-svg" viewBox={`0 0 ${worldGeometry.width} ${worldGeometry.height}`} role="img" aria-label="Hex world overview map">
          <defs>
            <radialGradient id="worldGlow" cx="50%" cy="44%" r="65%">
              <stop offset="0%" stopColor="rgba(255, 192, 96, 0.26)" />
              <stop offset="100%" stopColor="rgba(13, 15, 18, 0)" />
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
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const labelCenter = regionCenters[region.id];
            if (!runtime?.discovered || !labelCenter) return null;
            const selected = selectedRegionId === region.id;
            const hovered = hoveredRegionId === region.id;
            return (
              <circle
                key={`${region.id}-halo`}
                className={["region-state-halo", runtime.state, selected ? "selected" : "", hovered ? "hovered" : ""].filter(Boolean).join(" ")}
                cx={labelCenter.x}
                cy={labelCenter.y}
                r={HEX_SIZE * (0.66 + region.hexTileIds.length * 0.14)}
              />
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
          {regionDefinitions.map((region) => {
            const runtime = regionRuntimeMap[region.id];
            const labelCenter = regionCenters[region.id];
            if (!runtime?.discovered || !labelCenter) return null;
            return (
              <g key={`${region.id}-label`} className={`region-label ${selectedRegionId === region.id ? "selected" : ""}`}>
                <text x={labelCenter.x} y={labelCenter.y + HEX_SIZE * 1.22} textAnchor="middle">{region.name}</text>
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
  const tabs: { id: ViewMode; label: string }[] = [{ id: "world", label: "World" }, { id: "city", label: "City" }, { id: "research", label: "Research" }];

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

  const regionDefinition = selectedRegionId ? regionMap[selectedRegionId] : null;
  const regionRuntime = regions.find((region) => region.id === selectedRegionId);
  if (!regionDefinition || !regionRuntime) return null;

  const canStart = (kind: ExpeditionKind) => {
    const requirement = kind === "survey" ? regionDefinition.access : kind === "exploit" ? regionDefinition.exploit : kind === "secure" ? regionDefinition.secure : { tech: ["relay-network"] };
    const techOk = (requirement.tech ?? []).every((techId) => researched.includes(techId));
    const gearTier = resources.gear >= 12 ? 3 : resources.gear >= 6 ? 2 : resources.gear >= 3 ? 1 : 0;
    const protectionOk = Object.entries(requirement.protection ?? {}).every(([slot, amount]) => protection[slot as ProtectionSlotId] >= Number(amount ?? 0));
    return techOk && protectionOk && gearTier >= (requirement.gear ?? 0);
  };

  const actions = [
    { kind: "survey" as ExpeditionKind, label: "Survey Region", requirement: regionDefinition.access, disabled: regionRuntime.state !== "known" },
    { kind: "exploit" as ExpeditionKind, label: "Start Exploitation", requirement: regionDefinition.exploit, disabled: regionRuntime.state !== "surveyed" || !canStart("exploit") },
    { kind: "secure" as ExpeditionKind, label: "Secure Region", requirement: regionDefinition.secure, disabled: regionRuntime.state !== "exploiting" || !canStart("secure") },
    { kind: "outpost" as ExpeditionKind, label: "Raise Outpost", requirement: { tech: ["relay-network"] }, disabled: regionRuntime.state !== "secured" || !canStart("outpost") }
  ];

  return (
    <div className="action-stack">
      {actions.map((item) => (
        <button key={item.kind} disabled={item.disabled} onClick={() => launchExpedition(regionDefinition.id, item.kind)}>
          <span>{item.label}</span>
          <small>{item.disabled && item.kind !== "survey" ? getBlockedReason(item.requirement, researched, resources.gear, protection) : getRequirementSummary(item.requirement, researched, resources.gear, protection).join(" / ")}</small>
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
function BottomBar() {
  const speed = useGameStore((state) => state.speed);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const dayIndex = useGameStore((state) => state.dayIndex);
  const dayPhase = useGameStore((state) => state.dayPhase);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const pendingEvent = useGameStore((state) => state.pendingEvent);
  const eventForecast = useGameStore((state) => state.eventForecast);
  const expeditions = useGameStore((state) => state.expeditions);
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
      <div className="status-block wide"><span>Expeditions</span><strong>{expeditions.length > 0 ? expeditions.map((item) => `${item.kind}:${Math.ceil(item.remaining)}s`).join(" | ") : "No missions underway"}</strong></div>
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
      <section className={`crisis-modal ${pendingEvent.id}`}>
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
  const pollution = useGameStore((state) => state.pollution);
  const freeRoles = getFreeRoles(buildings, expeditions, population.roles);
  const doctrineProfile = getDoctrineProfile(buildings);
  const doctrineSummary = summarizeDoctrineProfile(doctrineProfile) || "no doctrine mix yet";
  const technicalLoad = doctrineProfile.synthetic + doctrineProfile.engineered + doctrineProfile.fossil + doctrineProfile.radical;
  const staffingRisk = freeRoles.technicians <= 1 && technicalLoad >= 3 ? "overstretched" : freeRoles.technicians <= 3 || freeRoles.workers <= 4 ? "tight" : "stable";

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
























