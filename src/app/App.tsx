import { useEffect, useMemo, useState } from "react";
import { buildingDefinitions, districtSlots } from "../game/data/buildings";
import { resourceDefinitions } from "../game/data/resources";
import { researchNodes } from "../game/data/research";
import { regionDefinitions } from "../game/data/sectors";
import { terrainAssetMap } from "../game/data/terrainAssets";
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
            {TERRAIN_TYPES.map((terrain) => {
              const asset = terrainAssetMap[terrain];
              return (
                <pattern key={terrain} id={`terrain-${terrain}`} patternUnits="userSpaceOnUse" width={HEX_WIDTH} height={HEX_SIZE * 2}>
                  <rect width={HEX_WIDTH} height={HEX_SIZE * 2} fill="#101311" />
                  <image href={asset.image} x={0} y={0} width={HEX_WIDTH} height={HEX_SIZE * 2} preserveAspectRatio="xMidYMid slice" />
                  <rect width={HEX_WIDTH} height={HEX_SIZE * 2} fill={asset.accent} />
                </pattern>
              );
            })}
          </defs>
          <rect width={worldGeometry.width} height={worldGeometry.height} fill="url(#worldGlow)" />
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
                <polygon className="hex-base" points={tile.points} fill={`url(#terrain-${tile.terrainType})`} />
                <polygon className="hex-danger" points={tile.points} fill={tile.dangerTint ?? terrain.accent} />
                <polygon className="hex-stroke" points={tile.points} stroke={terrain.stroke} />
                {!discovered ? <polygon className="hex-fog" points={tile.points} /> : null}
                {isCity ? (
                  <g className="city-reactor-mark">
                    <circle cx={tile.center.x} cy={tile.center.y} r={HEX_SIZE * 0.48} />
                    <circle cx={tile.center.x} cy={tile.center.y} r={HEX_SIZE * 0.27} />
                    <path d={`M ${tile.center.x - 12} ${tile.center.y + 12} L ${tile.center.x} ${tile.center.y - 14} L ${tile.center.x + 12} ${tile.center.y + 12}`} />
                    <text x={tile.center.x} y={tile.center.y + 30} textAnchor="middle">City</text>
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
  const selectSlot = useGameStore((state) => state.selectSlot);
  const setView = useGameStore((state) => state.setView);

  return (
    <section className="canvas-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">City View</p>
          <h2>Reactor District Slots</h2>
        </div>
        <button className="ghost-button" onClick={() => setView("world")}>Back To World</button>
      </div>
      <div className="city-plate">
        <div className="reactor-core"><span>REACTOR</span><strong>Core</strong></div>
        {districtSlots.map((slot) => {
          const building = buildings.find((item) => item.slotId === slot.id);
          const definition = building ? buildingMap[building.buildingId] : null;
          return (
            <button key={slot.id} className={`district-slot ${selectedSlotId === slot.id ? "selected" : ""} ${building ? "occupied" : "empty"}`} style={{ left: `${slot.x}%`, top: `${slot.y}%` }} onClick={() => selectSlot(slot.id)}>
              <span>{slot.label}</span>
              <strong>{definition?.name ?? "Empty Slot"}</strong>
              {building ? <small>L{building.level} {building.enabled ? "Online" : "Standby"}</small> : null}
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
  const regions = useGameStore((state) => state.regions);
  const buildings = useGameStore((state) => state.buildings);
  const buildInSlot = useGameStore((state) => state.buildInSlot);
  const toggleBuilding = useGameStore((state) => state.toggleBuilding);
  const upgradeBuilding = useGameStore((state) => state.upgradeBuilding);
  const chooseBuildingUpgrade = useGameStore((state) => state.chooseBuildingUpgrade);
  const researched = useGameStore((state) => state.researched);
  const activeResearch = useGameStore((state) => state.activeResearch);
  const startResearch = useGameStore((state) => state.startResearch);
  const resources = useGameStore((state) => state.resources);
  const protection = useGameStore((state) => state.population.protection);

  const selectedRegion = selectedRegionId ? regionMap[selectedRegionId] : null;
  const selectedRegionState = regions.find((region) => region.id === selectedRegionId);
  const selectedSlot = districtSlots.find((slot) => slot.id === selectedSlotId);
  const existingBuilding = buildings.find((item) => item.slotId === selectedSlotId);
  const existingDefinition = existingBuilding ? buildingMap[existingBuilding.buildingId] : null;
  const effectiveBuilding = existingBuilding && existingDefinition ? getEffectiveBuildingData(existingDefinition, existingBuilding) : null;
  const buildOptions = buildingDefinitions.filter((definition) => {
    if (definition.unlockTech && !researched.includes(definition.unlockTech)) return false;
    return !buildings.some((instance) => instance.slotId === selectedSlotId);
  });

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
          <p className="panel-copy">{selectedRegion.description}</p>
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

      {view === "city" && selectedSlot ? (
        <>
          <div className="panel-header">
            <div>
              <p className="eyebrow">District Slot</p>
              <h2>{selectedSlot.label}</h2>
            </div>
          </div>
          {existingBuilding && existingDefinition && effectiveBuilding ? (
            <>
              <p className="panel-copy">{existingDefinition.description}</p>
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
                          <small>{Object.entries(option.cost ?? {}).map(([resourceId, amount]) => `${resourceDefinitions.find((resource) => resource.id === (resourceId as ResourceId))?.label ?? resourceId} ${amount}`).join(" / ") || "No extra cost"}</small>
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
                  {buildOptions.map((definition) => (
                    <button key={definition.id} className="build-option" onClick={() => buildInSlot(selectedSlot.id, definition.id)}>
                      <span>{definition.name}</span>
                      <small>{definition.description}</small>
                      <small>{(definition.doctrineTags ?? []).join(" / ") || "generalist"}</small>
                    </button>
                  ))}
                  {buildOptions.length === 0 ? <div className="muted-box">All available buildings here are locked or already built.</div> : null}
                </div>
              </div>
            </>
          )}
        </>
      ) : null}

      {view === "research" ? (
        <>
          <div className="panel-header">
            <div>
              <p className="eyebrow">Technology</p>
              <h2>Progression Grid</h2>
            </div>
          </div>
          <div className="subsection">
            <h3>Active Research</h3>
            <div className="card-emphasis">{activeResearch ? `${researchNodes.find((item) => item.id === activeResearch.nodeId)?.name ?? "Unknown"} (${activeResearch.progress.toFixed(0)}%)` : "No active project"}</div>
          </div>
          <div className="tech-list">
            {researchNodes.map((node) => {
              const unlocked = researched.includes(node.id);
              const available = !unlocked && !activeResearch && node.prerequisites.every((item) => researched.includes(item)) && resources.research >= node.cost;
              return (
                <button key={node.id} className={`tech-node ${unlocked ? "done" : available ? "available" : "locked"}`} onClick={() => startResearch(node.id)} disabled={!available}>
                  <span>{node.branch}</span>
                  <strong>{node.name}</strong>
                  <small>{node.description}</small>
                  <small>{node.doctrineTags.join(" / ")}</small>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </aside>
  );
}

function ResearchCanvas() {
  const researched = useGameStore((state) => state.researched);
  const activeResearch = useGameStore((state) => state.activeResearch);
  const branches = [...new Set(researchNodes.map((node) => node.branch))];

  return (
    <section className="canvas-card">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Research Lattice</p>
          <h2>Industrial Doctrine Spread</h2>
        </div>
      </div>
      <div className="research-board wide-board">
        {branches.map((branch) => (
          <div key={branch} className="branch-column">
            <h3>{branch}</h3>
            {researchNodes.filter((node) => node.branch === branch).map((node) => (
              <article key={node.id} className={`branch-card ${researched.includes(node.id) ? "done" : activeResearch?.nodeId === node.id ? "active" : ""}`}>
                <span>Tier {node.tier}</span>
                <strong>{node.name}</strong>
                <small>{node.description}</small>
                <small>{node.doctrineTags.join(" / ")}</small>
              </article>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function BottomBar() {
  const speed = useGameStore((state) => state.speed);
  const elapsedSeconds = useGameStore((state) => state.elapsedSeconds);
  const activeEvent = useGameStore((state) => state.activeEvent);
  const expeditions = useGameStore((state) => state.expeditions);
  const log = useGameStore((state) => state.log);
  const pollution = useGameStore((state) => state.pollution);
  const setSpeed = useGameStore((state) => state.setSpeed);
  const saveGame = useGameStore((state) => state.saveGame);
  const resetGame = useGameStore((state) => state.resetGame);
  const advanceTime = useGameStore((state) => state.advanceTime);

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
      <div className="status-block"><span>Elapsed</span><strong>{Math.floor(elapsedSeconds / 60)}m {String(Math.floor(elapsedSeconds % 60)).padStart(2, "0")}s</strong></div>
      <div className="status-block wide"><span>Event</span><strong>{activeEvent ? `${activeEvent.title} (${Math.ceil(activeEvent.remaining)}s)` : "No active threat"}</strong></div>
      <div className="status-block"><span>Pollution</span><strong>{pollution.toFixed(0)}%</strong></div>
      <div className="status-block wide"><span>Expeditions</span><strong>{expeditions.length > 0 ? expeditions.map((item) => `${item.kind}:${Math.ceil(item.remaining)}s`).join(" | ") : "No missions underway"}</strong></div>
      <div className="status-block wide"><span>Log</span><strong>{log[0]}</strong></div>
    </footer>
  );
}

function AlertStack() {
  const alerts = useGameStore((state) => state.alerts);
  return <div className="alert-stack">{alerts.map((alert) => <div key={alert.id} className={`alert-card ${alert.tone}`}>{alert.text}</div>)}</div>;
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
    </div>
  );
}




