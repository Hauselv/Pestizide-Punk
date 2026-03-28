import { create } from "zustand";
import { buildingDefinitions, districtSlots, startingBuildings } from "../data/buildings";
import { researchNodes, startingResearch } from "../data/research";
import { sectorDefinitions } from "../data/sectors";
import type {
  ActiveEvent,
  ActiveResearch,
  AlertMessage,
  BuildingDefinition,
  BuildingInstance,
  Expedition,
  ExpeditionKind,
  HazardId,
  ResourceFlow,
  ResourceId,
  RoleId,
  SectorDefinition,
  SnapshotState,
  ViewMode
} from "../types";

const STORAGE_KEY = 'pestizide-punk-save-v2';
const BUILDING_RATE_SCALE = 0.15;
const SECTOR_RATE_SCALE = 0.15;
const EVENT_SEQUENCE: ActiveEvent[] = [
  {
    id: "toxic-storm",
    title: "Toxic Storm Front",
    description: "Solar output collapses and contamination climbs while the cloud passes.",
    remaining: 30
  },
  {
    id: "swarm-raid",
    title: "Swarm Pressure",
    description: "Mutant insects test the perimeter and chew through exposed stockpiles.",
    remaining: 26
  },
  {
    id: "contamination-surge",
    title: "Contamination Surge",
    description: "Leaking runoff pushes city contamination upward until systems recover.",
    remaining: 28
  }
];

interface GameStore extends SnapshotState {
  setView: (view: ViewMode) => void;
  selectSector: (sectorId: string) => void;
  selectSlot: (slotId: string) => void;
  buildInSlot: (slotId: string, buildingId: string) => void;
  startResearch: (nodeId: string) => void;
  launchExpedition: (sectorId: string, kind: ExpeditionKind) => void;
  setSpeed: (speed: number) => void;
  advanceTime: (ms: number) => void;
  saveGame: () => void;
  resetGame: () => void;
  renderToText: () => string;
}

const buildingMap = Object.fromEntries(
  buildingDefinitions.map((definition) => [definition.id, definition])
) as Record<string, BuildingDefinition>;

const sectorMap = Object.fromEntries(
  sectorDefinitions.map((sector) => [sector.id, sector])
) as Record<string, SectorDefinition>;

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
    Object.entries(definition.hazardMitigation ?? {}).forEach(([hazard, amount]) => {
      mitigation[hazard as HazardId] += Number(amount ?? 0);
    });
  });

  return mitigation;
}

function canAfford(resources: Record<ResourceId, number>, flow?: ResourceFlow) {
  if (!flow) return true;
  return Object.entries(flow).every(
    ([resourceId, amount]) => resources[resourceId as ResourceId] >= Number(amount ?? 0)
  );
}

function applyFlow(resources: Record<ResourceId, number>, flow?: ResourceFlow, multiplier = 1) {
  if (!flow) return;
  Object.entries(flow).forEach(([resourceId, amount]) => {
    resources[resourceId as ResourceId] += Number(amount ?? 0) * multiplier;
  });
}

function meetsRequirement(state: SnapshotState, requirement: SectorDefinition["access"]) {
  const techOk = (requirement.tech ?? []).every((techId) => hasResearch(state, techId));
  const gearTier = state.resources.gear >= 10 ? 2 : state.resources.gear >= 4 ? 1 : 0;
  return techOk && gearTier >= (requirement.gear ?? 0);
}

function createInitialState(): SnapshotState {
  return {
    elapsedSeconds: 0,
    resources: {
      energy: 42,
      water: 26,
      food: 28,
      materials: 42,
      biomass: 12,
      feedstock: 8,
      pesticides: 4,
      research: 18,
      gear: 4
    },
    view: "world",
    selectedSectorId: "toxic-forest",
    selectedSlotId: null,
    districts: districtSlots,
    buildings: startingBuildings,
    sectors: sectorDefinitions.map((sector) => ({
      id: sector.id,
      state: "known" as const,
      discovered: sector.ring === 1
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
      }
    },
    speed: 1,
    alerts: [
      {
        id: "tutorial",
        tone: "info",
        text: "Survey ring-1 sectors, unlock filter masks, then exploit biomass and salvage."
      }
    ],
    log: ["City council briefing ready. Reactor output stable. First ring sectors await survey."]
  };
}

function serializeState(state: SnapshotState) {
  return JSON.stringify(state);
}

function loadState(): SnapshotState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SnapshotState;
  } catch {
    return null;
  }
}

function saveState(state: SnapshotState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, serializeState(state));
}

function cleanResourceBounds(state: SnapshotState) {
  const resourceIds = Object.keys(state.resources) as ResourceId[];
  resourceIds.forEach((resourceId) => {
    state.resources[resourceId] = clamp(state.resources[resourceId], 0, 999);
  });
}

function createExpedition(kind: ExpeditionKind, sectorId: string): Expedition {
  const baseDuration =
    kind === "survey" ? 18 : kind === "exploit" ? 24 : kind === "secure" ? 30 : 22;

  return {
    id: `${kind}-${sectorId}-${Math.random().toString(36).slice(2, 7)}`,
    sectorId,
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

  const baseDelta: Record<ResourceId, number> = {
    energy: 0.6,
    water: -0.12,
    food: -0.08,
    materials: 0,
    biomass: 0,
    feedstock: 0,
    pesticides: 0,
    research: 0.02,
    gear: 0
  };

  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    const multiplier =
      activeEvent?.id === "toxic-storm" && instance.buildingId === "solar-array" ? 0.35 : 1;
    Object.entries(definition.upkeep ?? {}).forEach(([resourceId, amount]) => {
      baseDelta[resourceId as ResourceId] -= Number(amount ?? 0) * multiplier * BUILDING_RATE_SCALE;
    });
    Object.entries(definition.output ?? {}).forEach(([resourceId, amount]) => {
      baseDelta[resourceId as ResourceId] += Number(amount ?? 0) * multiplier * BUILDING_RATE_SCALE;
    });
  });

  state.sectors.forEach((sectorRuntime) => {
    const definition = sectorMap[sectorRuntime.id];
    if (sectorRuntime.state === "exploiting" || sectorRuntime.state === "secured") {
      Object.entries(definition.resources).forEach(([resourceId, amount]) => {
        if (resourceId in baseDelta) {
          baseDelta[resourceId as ResourceId] += Number(amount ?? 0) * 0.5 * SECTOR_RATE_SCALE;
        }
      });
    }
    if (sectorRuntime.state === "outpost") {
      Object.entries(definition.resources).forEach(([resourceId, amount]) => {
        if (resourceId in baseDelta) {
          baseDelta[resourceId as ResourceId] += Number(amount ?? 0) * SECTOR_RATE_SCALE;
        }
      });
    }
  });

  if (activeEvent?.id === "toxic-storm") {
    baseDelta.energy -= 1;
    state.population.contamination += Math.max(0.05, 0.12 - mitigation.toxicity * 0.03) * dt;
  }

  if (activeEvent?.id === "swarm-raid") {
    const sprayTowerCount = state.buildings.filter(
      (instance) => instance.enabled && instance.buildingId === "spray-tower"
    ).length;
    if (sprayTowerCount === 0) {
      baseDelta.food -= 0.4;
      state.population.stability -= 0.12 * dt;
    }
  }

  if (activeEvent?.id === "contamination-surge") {
    baseDelta.water -= 0.4;
    state.population.contamination += Math.max(0.04, 0.1 - mitigation.spores * 0.02) * dt;
  }

  (Object.keys(baseDelta) as ResourceId[]).forEach((resourceId) => {
    state.resources[resourceId] += baseDelta[resourceId] * dt;
  });

  if (state.resources.food <= 4) {
    state.population.health -= 0.18 * dt;
    state.population.stability -= 0.16 * dt;
  }

  if (state.resources.water <= 3) {
    state.population.health -= 0.22 * dt;
    state.population.contamination += 0.18 * dt;
  }

  if (state.resources.energy <= 2) {
    state.population.stability -= 0.18 * dt;
  }

  const clinicCount = state.buildings.filter(
    (instance) => instance.enabled && instance.buildingId === "clinic"
  ).length;
  state.population.contamination -= clinicCount * 0.08 * dt;

  if (state.population.contamination > 40) {
    state.population.health -= 0.12 * dt;
    state.population.stability -= 0.08 * dt;
  }

  if (state.activeResearch) {
    const researchRate = 0.6 + state.resources.research * 0.01;
    state.activeResearch.progress += researchRate * dt;
    const node = researchNodes.find((item) => item.id === state.activeResearch?.nodeId);
    if (node && state.activeResearch.progress >= node.cost) {
      state.researched = [...state.researched, node.id];
      state.activeResearch = null;
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

      const sectorRuntime = state.sectors.find((sector) => sector.id === expedition.sectorId);
      const sectorDefinition = sectorMap[expedition.sectorId];
      if (!sectorRuntime || !sectorDefinition) return false;

      if (expedition.kind === "survey") {
        sectorRuntime.state = "surveyed";
        sectorRuntime.discovered = true;
        applyFlow(state.resources, sectorDefinition.surveyReward);
      }

      if (expedition.kind === "exploit") {
        sectorRuntime.state = "exploiting";
      }

      if (expedition.kind === "secure") {
        sectorRuntime.state = "secured";
        applyFlow(state.resources, sectorDefinition.secureReward);
      }

      if (expedition.kind === "outpost") {
        sectorRuntime.state = "outpost";
      }

      state.log = appendLog(
        state.log,
        `${sectorDefinition.name}: ${expedition.kind} mission completed.`
      );
      state.alerts = appendAlert(state.alerts, {
        id: `expedition-${expedition.id}`,
        tone: "success",
        text: `${sectorDefinition.name} ${expedition.kind} mission completed.`
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
    const template =
      EVENT_SEQUENCE[(Math.floor(state.elapsedSeconds / 90) - 1) % EVENT_SEQUENCE.length];
    state.activeEvent = { ...template };
    state.alerts = appendAlert(state.alerts, {
      id: `event-${Math.floor(state.elapsedSeconds)}`,
      tone: "danger",
      text: `${template.title}: ${template.description}`
    });
    state.log = appendLog(state.log, `Threat event: ${template.title}`);
  }

  state.population.health = clamp(state.population.health, 0, 100);
  state.population.contamination = clamp(state.population.contamination, 0, 100);
  state.population.stability = clamp(state.population.stability, 0, 100);
  cleanResourceBounds(state);

  if (state.resources.food <= 6) {
    state.alerts = appendAlert(state.alerts, {
      id: "low-food",
      tone: "warning",
      text: "Food stores are running low."
    });
  }
  if (state.resources.water <= 6) {
    state.alerts = appendAlert(state.alerts, {
      id: "low-water",
      tone: "warning",
      text: "Water purification is under pressure."
    });
  }
  if (state.population.contamination >= 35) {
    state.alerts = appendAlert(state.alerts, {
      id: "high-contamination",
      tone: "danger",
      text: "City contamination is reaching dangerous levels."
    });
  }
}

function cloneSnapshot(state: SnapshotState): SnapshotState {
  return {
    elapsedSeconds: state.elapsedSeconds,
    resources: { ...state.resources },
    view: state.view,
    selectedSectorId: state.selectedSectorId,
    selectedSlotId: state.selectedSlotId,
    districts: state.districts.map((slot) => ({ ...slot })),
    buildings: state.buildings.map((building) => ({ ...building })),
    sectors: state.sectors.map((sector) => ({ ...sector })),
    researched: [...state.researched],
    activeResearch: state.activeResearch ? { ...state.activeResearch } : null,
    expeditions: state.expeditions.map((expedition) => ({
      ...expedition,
      staff: { ...expedition.staff }
    })),
    activeEvent: state.activeEvent ? { ...state.activeEvent } : null,
    population: {
      ...state.population,
      roles: { ...state.population.roles }
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

  selectSector: (sectorId) => set({ selectedSectorId: sectorId, view: "world" }),

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
      const staffOk = Object.entries(definition.staff).every(
        ([role, amount]) => freeRoles[role as RoleId] >= Number(amount ?? 0)
      );
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
        buildings: [...state.buildings, { slotId, buildingId, enabled: true } as BuildingInstance],
        log: appendLog(state.log, `${definition.name} commissioned at ${slot.label}.`),
        alerts: appendAlert(state.alerts, {
          id: `build-${slotId}`,
          tone: "success",
          text: `${definition.name} built at ${slot.label}.`
        }),
        selectedSlotId: slotId
      };
      saveState(nextState);
      return nextState;
    }),

  startResearch: (nodeId) =>
    set((state) => {
      const node = researchNodes.find((item) => item.id === nodeId);
      if (!node || hasResearch(state, nodeId) || state.activeResearch) return state;
      const prerequisitesMet = node.prerequisites.every((item) => hasResearch(state, item));
      if (!prerequisitesMet) return state;
      if (state.resources.research < node.cost) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `research-short-${nodeId}`,
            tone: "warning",
            text: `Need ${node.cost} research to start ${node.name}.`
          })
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

  launchExpedition: (sectorId, kind) =>
    set((state) => {
      const sectorDefinition = sectorMap[sectorId];
      const sectorRuntime = state.sectors.find((item) => item.id === sectorId);
      if (!sectorDefinition || !sectorRuntime) return state;

      const requirement =
        kind === "survey"
          ? sectorDefinition.access
          : kind === "exploit"
            ? sectorDefinition.exploit
            : kind === "secure"
              ? sectorDefinition.secure
              : { tech: ["relay-network"] };

      if (!meetsRequirement(state, requirement)) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `requirement-${sectorId}-${kind}`,
            tone: "warning",
            text: `${sectorDefinition.name} needs more tech or gear for ${kind}.`
          })
        };
      }

      if (state.expeditions.some((item) => item.sectorId === sectorId)) return state;
      const expedition = createExpedition(kind, sectorId);
      const freeRoles = getFreeRoles(state);
      const staffOk = Object.entries(expedition.staff).every(
        ([role, amount]) => freeRoles[role as RoleId] >= Number(amount ?? 0)
      );
      if (!staffOk) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `expedition-staff-${sectorId}`,
            tone: "warning",
            text: `Not enough free staff for ${kind} mission.`
          })
        };
      }

      const nextState = {
        ...state,
        sectors: state.sectors.map((sector) =>
          sector.id === sectorId && kind === "survey"
            ? { ...sector, state: "surveying" as const }
            : sector
        ),
        expeditions: [...state.expeditions, expedition],
        log: appendLog(state.log, `${sectorDefinition.name}: ${kind} mission launched.`)
      };
      saveState(nextState);
      return nextState;
    }),

  setSpeed: (speed) => set({ speed }),

  advanceTime: (ms) =>
    set((state) => {
      const nextState = cloneSnapshot(state);
      const seconds = ms / 1000;
      tickState(nextState, seconds);
      saveState(nextState);
      return nextState;
    }),

  saveGame: () => {
    saveState(get());
  },

  resetGame: () => {
    const nextState = createInitialState();
    saveState(nextState);
    set(nextState);
  },

  renderToText: () => {
    const state = get();
    return JSON.stringify({
      coordinateSystem: "world-map center origin in screen percentages, x right, y down",
      mode: state.view,
      elapsedSeconds: state.elapsedSeconds,
      selectedSectorId: state.selectedSectorId,
      selectedSlotId: state.selectedSlotId,
      resources: state.resources,
      population: {
        health: state.population.health,
        contamination: state.population.contamination,
        stability: state.population.stability,
        freeRoles: getFreeRoles(state)
      },
      activeResearch: state.activeResearch,
      activeEvent: state.activeEvent?.title ?? null,
      expeditions: state.expeditions.map((item) => ({
        sectorId: item.sectorId,
        kind: item.kind,
        remaining: item.remaining
      })),
      sectors: state.sectors.map((sector) => ({
        id: sector.id,
        state: sector.state,
        discovered: sector.discovered
      })),
      alerts: state.alerts.map((alert) => alert.text)
    });
  }
}));




