import { create } from "zustand";
import { buildingDefinitions, districtSlots, startingBuildings } from "../data/buildings";
import { researchNodes, startingResearch } from "../data/research";
import { regionDefinitions } from "../data/sectors";
import { worldHexes } from "../data/worldHexes";
import type {
  ActiveEvent,
  ActiveResearch,
  AlertMessage,
  BuildingDefinition,
  BuildingInstance,
  DoctrineTag,
  Expedition,
  ExpeditionKind,
  HazardId,
  ProtectionProfile,
  ProtectionSlotId,
  RegionDefinition,
  ResourceFlow,
  ResourceId,
  RoleId,
  SnapshotState,
  ViewMode
} from "../types";

const STORAGE_KEY = "pestizide-punk-save-v5";
const BUILDING_RATE_SCALE = 0.15;
const REGION_RATE_SCALE = 0.15;
const MAX_BUILDING_LEVEL = 2;
const EVENT_SEQUENCE: ActiveEvent[] = [
  {
    id: "toxic-storm",
    title: "Toxic Storm Front",
    description: "Solar output slumps and airborne contamination rises while the front passes.",
    remaining: 30
  },
  {
    id: "swarm-raid",
    title: "Swarm Pressure",
    description: "Mutant insects test the perimeter and punish weak food chains.",
    remaining: 26
  },
  {
    id: "contamination-surge",
    title: "Contamination Surge",
    description: "Runoff leaks push city pollution and contamination upward until systems recover.",
    remaining: 28
  }
];

const zeroProtection = (): Record<ProtectionSlotId, number> => ({
  respiratory: 0,
  chemical: 0,
  radiation: 0,
  environmental: 0
});

const researchProtectionBonuses: Partial<Record<string, ProtectionProfile>> = {
  "filter-masks": { respiratory: 1 },
  "field-clinic": { environmental: 1 },
  "papr-rigs": { respiratory: 2 },
  "sealed-suits": { chemical: 2, environmental: 1 },
  "decon-routines": { chemical: 1, radiation: 1 },
  "hazmat-lockers": { radiation: 2 }
};

interface GameStore extends SnapshotState {
  setView: (view: ViewMode) => void;
  selectRegion: (regionId: string) => void;
  selectSlot: (slotId: string) => void;
  buildInSlot: (slotId: string, buildingId: string) => void;
  toggleBuilding: (slotId: string) => void;
  upgradeBuilding: (slotId: string) => void;
  chooseBuildingUpgrade: (slotId: string, optionId: string) => void;
  startResearch: (nodeId: string) => void;
  launchExpedition: (regionId: string, kind: ExpeditionKind) => void;
  setSpeed: (speed: number) => void;
  advanceTime: (ms: number) => void;
  saveGame: () => void;
  resetGame: () => void;
  renderToText: () => string;
}

const buildingMap = Object.fromEntries(
  buildingDefinitions.map((definition) => [definition.id, definition])
) as Record<string, BuildingDefinition>;

const regionMap = Object.fromEntries(
  regionDefinitions.map((region) => [region.id, region])
) as Record<string, RegionDefinition>;

function mergeResourceFlow(base?: ResourceFlow, extra?: ResourceFlow) {
  const merged: ResourceFlow = { ...(base ?? {}) };
  Object.entries(extra ?? {}).forEach(([resourceId, amount]) => {
    merged[resourceId as ResourceId] = Number(merged[resourceId as ResourceId] ?? 0) + Number(amount ?? 0);
  });
  return merged;
}

function mergeHazardFlow(base?: Partial<Record<HazardId, number>>, extra?: Partial<Record<HazardId, number>>) {
  const merged: Partial<Record<HazardId, number>> = { ...(base ?? {}) };
  Object.entries(extra ?? {}).forEach(([hazardId, amount]) => {
    merged[hazardId as HazardId] = Number(merged[hazardId as HazardId] ?? 0) + Number(amount ?? 0);
  });
  return merged;
}

function mergeProtectionFlow(base?: ProtectionProfile, extra?: ProtectionProfile) {
  const merged: ProtectionProfile = { ...(base ?? {}) };
  Object.entries(extra ?? {}).forEach(([slotId, amount]) => {
    merged[slotId as ProtectionSlotId] = Number(merged[slotId as ProtectionSlotId] ?? 0) + Number(amount ?? 0);
  });
  return merged;
}

function getSelectedUpgradeOption(definition: BuildingDefinition, instance: BuildingInstance) {
  if (!instance.upgradeOptionId) return null;
  return definition.upgradeOptions?.find((option) => option.id === instance.upgradeOptionId) ?? null;
}

function getEffectiveBuildingData(definition: BuildingDefinition, instance: BuildingInstance) {
  const upgradeOption = getSelectedUpgradeOption(definition, instance);
  const doctrineTags = [...new Set([...(definition.doctrineTags ?? []), ...(upgradeOption?.doctrineTags ?? [])])];
  return {
    output: mergeResourceFlow(definition.output, upgradeOption?.output),
    upkeep: mergeResourceFlow(definition.upkeep, upgradeOption?.upkeep),
    storageCapacity: mergeResourceFlow(definition.storageCapacity, upgradeOption?.storageCapacity),
    protectionOutput: mergeProtectionFlow(definition.protectionOutput, upgradeOption?.protectionOutput),
    hazardMitigation: mergeHazardFlow(definition.hazardMitigation, upgradeOption?.hazardMitigation),
    emissions: Number(definition.emissions ?? 0) + Number(upgradeOption?.emissions ?? 0),
    wasteOutput: {
      pollution: Number(definition.wasteOutput?.pollution ?? 0) + Number(upgradeOption?.wasteOutput?.pollution ?? 0)
    },
    doctrineTags,
    upgradeOption
  };
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

function getDoctrineProfile(state: SnapshotState) {
  const profile = createDoctrineProfile();
  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    const effective = getEffectiveBuildingData(definition, instance);
    const weight = getBuildingMultiplier(instance.level);
    effective.doctrineTags.forEach((tag) => {
      profile[tag] += weight;
    });
  });
  return profile;
}

function getStaffingPressure(state: SnapshotState, doctrineProfile = getDoctrineProfile(state)) {
  const freeRoles = getFreeRoles(state);
  const industrialLoad = doctrineProfile.synthetic + doctrineProfile.engineered + doctrineProfile.fossil + doctrineProfile.radical;
  const supportCapacity = freeRoles.technicians + freeRoles.researchers * 0.5 + freeRoles.workers * 0.35;
  return Math.max(0, industrialLoad - supportCapacity);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function appendLog(log: string[], entry: string) {
  return [entry, ...log].slice(0, 8);
}

function appendAlert(alerts: AlertMessage[], alert: AlertMessage) {
  return [alert, ...alerts.filter((item) => item.id !== alert.id)].slice(0, 5);
}

function hasResearch(state: SnapshotState, techId: string) {
  return state.researched.includes(techId);
}

function getBuildingMultiplier(level: number) {
  return 1 + (level - 1) * 0.5;
}

function scaleValues<T extends string>(flow: Partial<Record<T, number>> | undefined, multiplier: number) {
  const scaled: Partial<Record<T, number>> = {};
  if (!flow) return scaled;
  Object.entries(flow).forEach(([key, amount]) => {
    scaled[key as T] = Number(amount ?? 0) * multiplier;
  });
  return scaled;
}

function mergeMaxProtection(target: Record<ProtectionSlotId, number>, source?: ProtectionProfile) {
  if (!source) return;
  Object.entries(source).forEach(([slot, amount]) => {
    target[slot as ProtectionSlotId] = Math.max(target[slot as ProtectionSlotId], Number(amount ?? 0));
  });
}

function addProtection(target: Record<ProtectionSlotId, number>, source?: ProtectionProfile, multiplier = 1) {
  if (!source) return;
  Object.entries(source).forEach(([slot, amount]) => {
    target[slot as ProtectionSlotId] += Number(amount ?? 0) * multiplier;
  });
}

function getTechProtection(state: SnapshotState) {
  const protection = zeroProtection();
  state.researched.forEach((techId) => {
    mergeMaxProtection(protection, researchProtectionBonuses[techId]);
  });
  return protection;
}

function getProtectionProfile(state: SnapshotState) {
  const protection = getTechProtection(state);
  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    const effective = getEffectiveBuildingData(definition, instance);
    addProtection(protection, effective.protectionOutput, getBuildingMultiplier(instance.level));
  });
  (Object.keys(protection) as ProtectionSlotId[]).forEach((slot) => {
    protection[slot] = clamp(protection[slot], 0, 6);
  });
  return protection;
}

function getUpgradeCost(definition: BuildingDefinition, level: number) {
  const cost: ResourceFlow = {};
  Object.entries(definition.cost).forEach(([resourceId, amount]) => {
    cost[resourceId as ResourceId] = Math.max(1, Math.ceil(Number(amount ?? 0) * 0.8 * level));
  });
  return cost;
}

function getUsedRoles(state: SnapshotState) {
  const used: Record<RoleId, number> = {
    workers: 0,
    technicians: 0,
    researchers: 0,
    rangers: 0
  };

  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    Object.entries(definition.staff).forEach(([role, amount]) => {
      used[role as RoleId] += Number(amount ?? 0);
    });
  });

  state.expeditions.forEach((expedition) => {
    Object.entries(expedition.staff).forEach(([role, amount]) => {
      used[role as RoleId] += Number(amount ?? 0);
    });
  });

  return used;
}

function getFreeRoles(state: SnapshotState) {
  const used = getUsedRoles(state);
  return {
    workers: state.population.roles.workers - used.workers,
    technicians: state.population.roles.technicians - used.technicians,
    researchers: state.population.roles.researchers - used.researchers,
    rangers: state.population.roles.rangers - used.rangers
  };
}

function getCityMitigation(state: SnapshotState) {
  const mitigation: Record<HazardId, number> = {
    toxicity: 0,
    spores: 0,
    radiation: 0,
    infestation: 0
  };

  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    const effective = getEffectiveBuildingData(definition, instance);
    const scaledMitigation = scaleValues(effective.hazardMitigation, getBuildingMultiplier(instance.level));
    Object.entries(scaledMitigation).forEach(([hazard, amount]) => {
      mitigation[hazard as HazardId] += Number(amount ?? 0);
    });
  });

  return mitigation;
}

function canAfford(resources: Record<ResourceId, number>, flow?: ResourceFlow) {
  if (!flow) return true;
  return Object.entries(flow).every(([resourceId, amount]) => resources[resourceId as ResourceId] >= Number(amount ?? 0));
}

function applyFlow(resources: Record<ResourceId, number>, flow?: ResourceFlow, multiplier = 1) {
  if (!flow) return;
  Object.entries(flow).forEach(([resourceId, amount]) => {
    resources[resourceId as ResourceId] += Number(amount ?? 0) * multiplier;
  });
}

function meetsRequirement(state: SnapshotState, requirement: RegionDefinition["access"]) {
  const techOk = (requirement.tech ?? []).every((techId) => hasResearch(state, techId));
  const gearTier = state.resources.gear >= 12 ? 3 : state.resources.gear >= 6 ? 2 : state.resources.gear >= 3 ? 1 : 0;
  const protection = state.population.protection;
  const protectionOk = Object.entries(requirement.protection ?? {}).every(
    ([slot, amount]) => protection[slot as ProtectionSlotId] >= Number(amount ?? 0)
  );
  return techOk && protectionOk && gearTier >= (requirement.gear ?? 0);
}

function createInitialState(): SnapshotState {
  const initialState: SnapshotState = {
    elapsedSeconds: 0,
    resources: {
      power: 42,
      water: 26,
      food: 28,
      materials: 42,
      biomass: 14,
      feedstock: 10,
      coal: 8,
      oil: 4,
      glass: 6,
      fertilizer: 4,
      pesticides: 4,
      research: 24,
      gear: 6
    },
    pollution: 10,
    view: "world",
    selectedRegionId: "toxic-forest",
    selectedSlotId: null,
    districts: districtSlots,
    buildings: startingBuildings,
    regions: regionDefinitions.map((region) => ({
      id: region.id,
      state: "known" as const,
      discovered: region.ring === 1
    })),
    researched: [...startingResearch],
    activeResearch: null,
    expeditions: [],
    activeEvent: null,
    population: {
      total: 58,
      health: 86,
      contamination: 12,
      stability: 74,
      roles: {
        workers: 26,
        technicians: 12,
        researchers: 10,
        rangers: 10
      },
      protection: zeroProtection()
    },
    speed: 0,
    alerts: [
      {
        id: "tutorial",
        tone: "info",
        text: "Balance clean power, dirty fuel, food chains, and protection before pushing deeper regions."
      }
    ],
    log: ["Industrial systems pass online. City core stable, pollution contained for now."]
  };
  initialState.population.protection = getProtectionProfile(initialState);
  return initialState;
}

function serializeState(state: SnapshotState) {
  return JSON.stringify(state);
}

function loadState(): SnapshotState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SnapshotState;
    parsed.population.protection = getProtectionProfile(parsed);
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: SnapshotState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, serializeState(state));
}

function cleanResourceBounds(state: SnapshotState) {
  (Object.keys(state.resources) as ResourceId[]).forEach((resourceId) => {
    state.resources[resourceId] = clamp(state.resources[resourceId], 0, 999);
  });
  state.pollution = clamp(state.pollution, 0, 100);
}

function createExpedition(kind: ExpeditionKind, regionId: string): Expedition {
  const baseDuration = kind === "survey" ? 18 : kind === "exploit" ? 24 : kind === "secure" ? 30 : 22;
  return {
    id: `${kind}-${regionId}-${Math.random().toString(36).slice(2, 7)}`,
    regionId,
    kind,
    remaining: baseDuration,
    total: baseDuration,
    staff:
      kind === "survey"
        ? { rangers: 2, researchers: 1 }
        : kind === "exploit"
          ? { workers: 3, rangers: 1 }
          : kind === "secure"
            ? { workers: 2, technicians: 1, rangers: 2 }
            : { workers: 2, technicians: 2 }
  };
}

function tickState(state: SnapshotState, seconds: number) {
  if (seconds <= 0) return;

  const dt = seconds;
  const previousElapsed = state.elapsedSeconds;
  state.elapsedSeconds += dt;
  const activeEvent = state.activeEvent;
  const mitigation = getCityMitigation(state);
  const doctrineProfile = getDoctrineProfile(state);
  const staffingPressure = getStaffingPressure(state, doctrineProfile);
  const freeRoles = getFreeRoles(state);
  const storageScore = state.buildings.filter((instance) => instance.enabled && getEffectiveBuildingData(buildingMap[instance.buildingId], instance).doctrineTags.includes("storage")).reduce((sum, instance) => sum + instance.level, 0);

  const baseDelta: Record<ResourceId, number> = {
    power: 0.55,
    water: -0.12,
    food: -0.08,
    materials: 0,
    biomass: 0,
    feedstock: 0,
    coal: 0,
    oil: 0,
    glass: 0,
    fertilizer: 0,
    pesticides: 0,
    research: 0.02,
    gear: 0
  };

  let pollutionDelta = -0.05;

  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    const effective = getEffectiveBuildingData(definition, instance);
    const multiplier = getBuildingMultiplier(instance.level) * BUILDING_RATE_SCALE;
    const weatherMultiplier = activeEvent?.id === "toxic-storm" && instance.buildingId === "solar-array" ? 0.35 : 1;

    Object.entries(effective.upkeep ?? {}).forEach(([resourceId, amount]) => {
      baseDelta[resourceId as ResourceId] -= Number(amount ?? 0) * weatherMultiplier * multiplier;
    });

    Object.entries(effective.output ?? {}).forEach(([resourceId, amount]) => {
      baseDelta[resourceId as ResourceId] += Number(amount ?? 0) * weatherMultiplier * multiplier;
    });

    pollutionDelta += Number(effective.emissions ?? 0) * multiplier;
    pollutionDelta += Number(effective.wasteOutput?.pollution ?? 0) * multiplier;
  });

  state.regions.forEach((regionRuntime) => {
    const definition = regionMap[regionRuntime.id];
    if (regionRuntime.state === "exploiting" || regionRuntime.state === "secured") {
      Object.entries(definition.resources).forEach(([resourceId, amount]) => {
        baseDelta[resourceId as ResourceId] += Number(amount ?? 0) * 0.5 * REGION_RATE_SCALE;
      });
    }
    if (regionRuntime.state === "outpost") {
      Object.entries(definition.resources).forEach(([resourceId, amount]) => {
        baseDelta[resourceId as ResourceId] += Number(amount ?? 0) * REGION_RATE_SCALE;
      });
    }
  });

  if (activeEvent?.id === "toxic-storm") {
    const stormBuffer = storageScore * 0.08 + doctrineProfile.clean * 0.015 + doctrineProfile.storage * 0.04 + doctrineProfile.resilient * 0.02;
    baseDelta.power -= Math.max(0.05, 0.35 - stormBuffer);
    state.population.contamination += Math.max(0.03, 0.12 - mitigation.toxicity * 0.03 - doctrineProfile.clean * 0.006 - doctrineProfile.resilient * 0.006) * dt;
  }

  if (activeEvent?.id === "swarm-raid") {
    const towerScore = state.buildings.filter((instance) => instance.enabled && ["spray-tower", "fumigation-tower"].includes(instance.buildingId)).reduce((sum, instance) => sum + instance.level, 0);
    const pestResponse = towerScore * 0.7 + doctrineProfile.bio * 0.35 + doctrineProfile.chemical * 0.4 + doctrineProfile.radical * 0.2;
    const foodPenalty = Math.max(0, 0.22 - pestResponse * 0.035);
    const stabilityPenalty = Math.max(0, 0.12 - pestResponse * 0.02);
    if (foodPenalty > 0) {
      baseDelta.food -= foodPenalty;
      state.population.stability -= stabilityPenalty * dt;
    }
  }

  if (activeEvent?.id === "contamination-surge") {
    baseDelta.water -= 0.2;
    pollutionDelta += Math.max(0.04, 0.16 + doctrineProfile.synthetic * 0.015 + doctrineProfile.fossil * 0.02 - doctrineProfile.clean * 0.012 - doctrineProfile.bio * 0.01);
    state.population.contamination += Math.max(0.02, 0.1 - mitigation.spores * 0.02 - doctrineProfile.clean * 0.008 - doctrineProfile.resilient * 0.008 + doctrineProfile.radical * 0.004) * dt;
  }

  (Object.keys(baseDelta) as ResourceId[]).forEach((resourceId) => {
    state.resources[resourceId] += baseDelta[resourceId] * dt;
  });
  state.pollution += pollutionDelta * dt;

  if (state.resources.food <= 4) {
    state.population.health -= 0.18 * dt;
    state.population.stability -= 0.16 * dt;
  }

  if (state.resources.water <= 3) {
    state.population.health -= 0.22 * dt;
    state.population.contamination += 0.18 * dt;
  }

  if (state.resources.power <= 2) {
    state.population.stability -= 0.18 * dt;
  }

  const clinicScore = state.buildings.filter((instance) => instance.enabled && instance.buildingId === "clinic").reduce((sum, instance) => sum + instance.level, 0);
  state.population.contamination -= clinicScore * 0.08 * dt;

  if (staffingPressure > 0) {
    state.population.stability -= staffingPressure * 0.025 * dt;
    pollutionDelta += staffingPressure * 0.01;
  }
  if (freeRoles.technicians <= 1 && doctrineProfile.synthetic + doctrineProfile.engineered + doctrineProfile.fossil >= 3) {
    state.population.stability -= 0.04 * dt;
  }

  if (state.pollution > 20) {
    state.population.contamination += Math.max(0, state.pollution - 20) * 0.006 * dt;
  }
  if (state.pollution > 35) {
    state.population.stability -= Math.max(0, state.pollution - 35) * 0.008 * dt;
  }
  if (state.pollution > 55) {
    state.population.health -= Math.max(0, state.pollution - 55) * 0.006 * dt;
  }

  if (state.population.contamination > 40) {
    state.population.health -= 0.12 * dt;
    state.population.stability -= 0.08 * dt;
  }

  if (state.activeResearch) {
    const researchRate = 0.65 + state.resources.research * 0.01;
    state.activeResearch.progress += researchRate * dt;
    const node = researchNodes.find((item) => item.id === state.activeResearch?.nodeId);
    if (node && state.activeResearch.progress >= node.cost) {
      state.researched = [...state.researched, node.id];
      state.activeResearch = null;
      state.population.protection = getProtectionProfile(state);
      state.alerts = appendAlert(state.alerts, {
        id: `research-${node.id}`,
        tone: "success",
        text: `${node.name} completed.`
      });
      state.log = appendLog(state.log, `Research complete: ${node.name}`);
    }
  }

  state.expeditions = state.expeditions
    .map((expedition) => ({ ...expedition, remaining: expedition.remaining - dt }))
    .filter((expedition) => {
      if (expedition.remaining > 0) return true;

      const regionRuntime = state.regions.find((region) => region.id === expedition.regionId);
      const regionDefinition = regionMap[expedition.regionId];
      if (!regionRuntime || !regionDefinition) return false;

      if (expedition.kind === "survey") {
        regionRuntime.state = "surveyed";
        regionRuntime.discovered = true;
        applyFlow(state.resources, regionDefinition.surveyReward);
      }
      if (expedition.kind === "exploit") {
        regionRuntime.state = "exploiting";
      }
      if (expedition.kind === "secure") {
        regionRuntime.state = "secured";
        applyFlow(state.resources, regionDefinition.secureReward);
      }
      if (expedition.kind === "outpost") {
        regionRuntime.state = "outpost";
      }

      state.log = appendLog(state.log, `${regionDefinition.name}: ${expedition.kind} mission completed.`);
      state.alerts = appendAlert(state.alerts, {
        id: `expedition-${expedition.id}`,
        tone: "success",
        text: `${regionDefinition.name} ${expedition.kind} mission completed.`
      });
      return false;
    });

  if (activeEvent) {
    activeEvent.remaining -= dt;
    if (activeEvent.remaining <= 0) {
      state.activeEvent = null;
      state.log = appendLog(state.log, `${activeEvent.title} dissipated.`);
    }
  } else if (Math.floor(previousElapsed / 90) < Math.floor(state.elapsedSeconds / 90)) {
    const template = EVENT_SEQUENCE[(Math.floor(state.elapsedSeconds / 90) - 1) % EVENT_SEQUENCE.length];
    state.activeEvent = { ...template };
    state.alerts = appendAlert(state.alerts, {
      id: `event-${Math.floor(state.elapsedSeconds)}`,
      tone: "danger",
      text: `${template.title}: ${template.description}`
    });
    state.log = appendLog(state.log, `Threat event: ${template.title}`);
  }

  state.population.protection = getProtectionProfile(state);
  state.population.health = clamp(state.population.health, 0, 100);
  state.population.contamination = clamp(state.population.contamination, 0, 100);
  state.population.stability = clamp(state.population.stability, 0, 100);
  cleanResourceBounds(state);

  if (state.resources.food <= 6) {
    state.alerts = appendAlert(state.alerts, { id: "low-food", tone: "warning", text: "Food stores are running low." });
  }
  if (state.resources.water <= 6) {
    state.alerts = appendAlert(state.alerts, { id: "low-water", tone: "warning", text: "Water purification is under pressure." });
  }
  if (state.resources.power <= 8) {
    state.alerts = appendAlert(state.alerts, { id: "low-power", tone: "warning", text: "Power reserves are sagging under current load." });
  }
  if (state.pollution >= 35) {
    state.alerts = appendAlert(state.alerts, { id: "high-pollution", tone: "danger", text: "City pollution is amplifying contamination and unrest." });
  }
  if (staffingPressure >= 1.5) {
    state.alerts = appendAlert(state.alerts, { id: "staffing-strain", tone: "warning", text: "Doctrine load is outpacing technical staffing." });
  }
}

function cloneSnapshot(state: SnapshotState): SnapshotState {
  return {
    elapsedSeconds: state.elapsedSeconds,
    resources: { ...state.resources },
    pollution: state.pollution,
    view: state.view,
    selectedRegionId: state.selectedRegionId,
    selectedSlotId: state.selectedSlotId,
    districts: state.districts.map((slot) => ({ ...slot })),
    buildings: state.buildings.map((building) => ({ ...building })),
    regions: state.regions.map((region) => ({ ...region })),
    researched: [...state.researched],
    activeResearch: state.activeResearch ? { ...state.activeResearch } : null,
    expeditions: state.expeditions.map((expedition) => ({ ...expedition, staff: { ...expedition.staff } })),
    activeEvent: state.activeEvent ? { ...state.activeEvent } : null,
    population: {
      ...state.population,
      roles: { ...state.population.roles },
      protection: { ...state.population.protection }
    },
    speed: state.speed,
    alerts: state.alerts.map((alert) => ({ ...alert })),
    log: [...state.log]
  };
}

function makeStoreState(): SnapshotState {
  return loadState() ?? createInitialState();
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...makeStoreState(),

  setView: (view) => set({ view }),

  selectRegion: (regionId) => set({ selectedRegionId: regionId, view: "world" }),

  selectSlot: (slotId) => set({ selectedSlotId: slotId, view: "city" }),

  buildInSlot: (slotId, buildingId) =>
    set((state) => {
      const definition = buildingMap[buildingId];
      const slot = state.districts.find((item) => item.id === slotId);
      const isBuilt = state.buildings.some((item) => item.slotId === slotId);
      if (!definition || !slot || isBuilt) return state;
      if (definition.unlockTech && !hasResearch(state, definition.unlockTech)) return state;
      if (!canAfford(state.resources, definition.cost)) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `cost-${slotId}`,
            tone: "warning",
            text: `Insufficient stock to build ${definition.name}.`
          })
        };
      }

      const freeRoles = getFreeRoles(state);
      const staffOk = Object.entries(definition.staff).every(([role, amount]) => freeRoles[role as RoleId] >= Number(amount ?? 0));
      if (!staffOk) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `staff-${slotId}`,
            tone: "warning",
            text: `Not enough free staff to build ${definition.name}.`
          })
        };
      }

      const resources = { ...state.resources };
      applyFlow(resources, definition.cost, -1);
      const nextState = {
        ...state,
        resources,
        buildings: [...state.buildings, { slotId, buildingId, enabled: true, level: 1 } as BuildingInstance],
        population: { ...state.population, protection: getProtectionProfile({ ...state, resources, buildings: [...state.buildings, { slotId, buildingId, enabled: true, level: 1 }] as BuildingInstance[] }) },
        log: appendLog(state.log, `${definition.name} commissioned at ${slot.label}.`),
        alerts: appendAlert(state.alerts, { id: `build-${slotId}`, tone: "success", text: `${definition.name} built at ${slot.label}.` }),
        selectedSlotId: slotId
      };
      saveState(nextState);
      return nextState;
    }),

  toggleBuilding: (slotId) =>
    set((state) => {
      const building = state.buildings.find((item) => item.slotId === slotId);
      if (!building) return state;
      const definition = buildingMap[building.buildingId];

      if (!building.enabled) {
        const freeRoles = getFreeRoles(state);
        const staffOk = Object.entries(definition.staff).every(([role, amount]) => freeRoles[role as RoleId] >= Number(amount ?? 0));
        if (!staffOk) {
          return {
            ...state,
            alerts: appendAlert(state.alerts, {
              id: `reactivate-${slotId}`,
              tone: "warning",
              text: `Not enough free staff to reactivate ${definition.name}.`
            })
          };
        }
      }

      const buildings = state.buildings.map((item) => item.slotId === slotId ? { ...item, enabled: !item.enabled } : item);
      const nextState = {
        ...state,
        buildings,
        population: { ...state.population, protection: getProtectionProfile({ ...state, buildings }) },
        log: appendLog(state.log, `${definition.name} ${building.enabled ? "put on standby" : "brought back online"}.`)
      };
      saveState(nextState);
      return nextState;
    }),

  upgradeBuilding: (slotId) =>
    set((state) => {
      const building = state.buildings.find((item) => item.slotId === slotId);
      if (!building || building.level >= MAX_BUILDING_LEVEL) return state;
      const definition = buildingMap[building.buildingId];
      const upgradeCost = getUpgradeCost(definition, building.level);
      if (!canAfford(state.resources, upgradeCost)) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `upgrade-${slotId}`,
            tone: "warning",
            text: `Insufficient stock to upgrade ${definition.name}.`
          })
        };
      }

      const resources = { ...state.resources };
      applyFlow(resources, upgradeCost, -1);
      const buildings = state.buildings.map((item) => item.slotId === slotId ? { ...item, level: item.level + 1 } : item);
      const nextState = {
        ...state,
        resources,
        buildings,
        population: { ...state.population, protection: getProtectionProfile({ ...state, resources, buildings }) },
        log: appendLog(state.log, `${definition.name} upgraded to level ${building.level + 1}.`),
        alerts: appendAlert(state.alerts, {
          id: `upgrade-ok-${slotId}`,
          tone: "success",
          text: `${definition.name} upgraded to level ${building.level + 1}.`
        })
      };
      saveState(nextState);
      return nextState;
    }),

  chooseBuildingUpgrade: (slotId, optionId) =>
    set((state) => {
      const building = state.buildings.find((item) => item.slotId === slotId);
      if (!building || building.level < MAX_BUILDING_LEVEL || building.upgradeOptionId) return state;
      const definition = buildingMap[building.buildingId];
      const upgradeOption = definition.upgradeOptions?.find((option) => option.id === optionId);
      if (!upgradeOption) return state;
      if (!canAfford(state.resources, upgradeOption.cost)) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `doctrine-${slotId}`,
            tone: "warning",
            text: `Insufficient stock to commission ${upgradeOption.name}.`
          })
        };
      }

      const resources = { ...state.resources };
      applyFlow(resources, upgradeOption.cost, -1);
      const buildings = state.buildings.map((item) => item.slotId === slotId ? { ...item, upgradeOptionId: optionId } : item);
      const nextState = {
        ...state,
        resources,
        buildings,
        pollution: clamp(state.pollution + Math.max(0, Number(upgradeOption.wasteOutput?.pollution ?? 0) * 2), 0, 100),
        population: { ...state.population, protection: getProtectionProfile({ ...state, resources, buildings }) },
        log: appendLog(state.log, `${definition.name} doctrine locked: ${upgradeOption.name}.`),
        alerts: appendAlert(state.alerts, {
          id: `doctrine-ok-${slotId}`,
          tone: "success",
          text: `${definition.name} now runs the ${upgradeOption.name} doctrine.`
        })
      };
      saveState(nextState);
      return nextState;
    }),

  startResearch: (nodeId) =>
    set((state) => {
      const node = researchNodes.find((item) => item.id === nodeId);
      if (!node || hasResearch(state, nodeId) || state.activeResearch) return state;
      if (!node.prerequisites.every((item) => hasResearch(state, item))) return state;
      if (state.resources.research < node.cost) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, { id: `research-short-${nodeId}`, tone: "warning", text: `Need ${node.cost} research to start ${node.name}.` })
        };
      }
      const nextState = {
        ...state,
        resources: { ...state.resources, research: state.resources.research - node.cost },
        activeResearch: { nodeId, progress: 0 } as ActiveResearch,
        log: appendLog(state.log, `Research started: ${node.name}`)
      };
      saveState(nextState);
      return nextState;
    }),

  launchExpedition: (regionId, kind) =>
    set((state) => {
      const regionDefinition = regionMap[regionId];
      const regionRuntime = state.regions.find((item) => item.id === regionId);
      if (!regionDefinition || !regionRuntime) return state;

      const requirement = kind === "survey"
        ? regionDefinition.access
        : kind === "exploit"
          ? regionDefinition.exploit
          : kind === "secure"
            ? regionDefinition.secure
            : { tech: ["relay-network"] };

      if (!meetsRequirement(state, requirement)) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, { id: `requirement-${regionId}-${kind}`, tone: "warning", text: `${regionDefinition.name} needs more tech, protection, or gear for ${kind}.` })
        };
      }
      if (state.expeditions.some((item) => item.regionId === regionId)) return state;

      const expedition = createExpedition(kind, regionId);
      const freeRoles = getFreeRoles(state);
      const staffOk = Object.entries(expedition.staff).every(([role, amount]) => freeRoles[role as RoleId] >= Number(amount ?? 0));
      if (!staffOk) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, { id: `expedition-staff-${regionId}`, tone: "warning", text: `Not enough free staff for ${kind} mission.` })
        };
      }

      const nextState = {
        ...state,
        regions: state.regions.map((region) => region.id === regionId && kind === "survey" ? { ...region, state: "surveying" as const } : region),
        expeditions: [...state.expeditions, expedition],
        log: appendLog(state.log, `${regionDefinition.name}: ${kind} mission launched.`)
      };
      saveState(nextState);
      return nextState;
    }),

  setSpeed: (speed) => set({ speed }),

  advanceTime: (ms) =>
    set((state) => {
      const nextState = cloneSnapshot(state);
      tickState(nextState, ms / 1000);
      saveState(nextState);
      return nextState;
    }),

  saveGame: () => saveState(get()),

  resetGame: () => {
    const nextState = createInitialState();
    saveState(nextState);
    set(nextState);
  },

  renderToText: () => {
    const state = get();
    return JSON.stringify({
      coordinateSystem: "world map uses axial hex coordinates with screen origin centered in the board, x right, y down",
      mode: state.view,
      elapsedSeconds: state.elapsedSeconds,
      selectedRegionId: state.selectedRegionId,
      selectedSlotId: state.selectedSlotId,
      resources: state.resources,
      pollution: state.pollution,
      population: {
        health: state.population.health,
        contamination: state.population.contamination,
        stability: state.population.stability,
        protection: state.population.protection,
        freeRoles: getFreeRoles(state),
        staffingPressure: getStaffingPressure(state)
      },
      doctrineProfile: getDoctrineProfile(state),
      buildings: state.buildings.map((building) => ({
        slotId: building.slotId,
        buildingId: building.buildingId,
        level: building.level,
        enabled: building.enabled,
        doctrineTags: getEffectiveBuildingData(buildingMap[building.buildingId], building).doctrineTags,
      })),
      activeResearch: state.activeResearch,
      activeEvent: state.activeEvent?.title ?? null,
      expeditions: state.expeditions.map((item) => ({ regionId: item.regionId, kind: item.kind, remaining: item.remaining })),
      regions: state.regions.map((region) => ({ id: region.id, state: region.state, discovered: region.discovered, hexCount: regionMap[region.id]?.hexTileIds.length ?? 0 })),
      worldHexes: {
        total: worldHexes.length,
        discovered: worldHexes.filter((tile) => tile.isCityCore || (tile.regionId ? state.regions.find((region) => region.id === tile.regionId)?.discovered : false)).length
      },
      alerts: state.alerts.map((alert) => alert.text)
    });
  }
}));







