import { create } from "zustand";
import { buildingDefinitions, districtSlots, startingBuildings } from "../data/buildings";
import { researchNodes, startingResearch } from "../data/research";
import { regionDefinitions } from "../data/sectors";
import { eventDefinitions } from "../data/events";
import { baseReactorUnlockedSlotIds, getReactorTierBonuses, reactorUpgradeDefinitions } from "../data/reactor";
import { worldHexes } from "../data/worldHexes";
import type {
  ActiveEvent,
  ActiveResearch,
  AlertMessage,
  BuildingDefinition,
  BuildingInstance,
  DayPhaseId,
  DoctrineTag,
  EventDefinition,
  EventId,
  EventResponseOption,
  Expedition,
  ExpeditionKind,
  HazardId,
  ProtectionProfile,
  ProtectionSlotId,
  RegionDefinition,
  ReactorState,
  ResourceFlow,
  ResourceId,
  RoleId,
  ScheduledEvent,
  SnapshotState,
  ViewMode
} from "../types";

const STORAGE_KEY = "pestizide-punk-save-v8";
const BUILDING_RATE_SCALE = 0.15;
const REGION_RATE_SCALE = 0.15;
const MAX_BUILDING_LEVEL = 2;
const DAY_LENGTH_SECONDS = 180;
const DAY_PHASE_SECONDS = DAY_LENGTH_SECONDS / 4;
const FORECAST_EVENT_COUNT = 3;

function deterministicUnit(seed: number, salt = 0) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233 + 0.9182) * 43758.5453;
  return value - Math.floor(value);
}

function pickEventId(sequenceIndex: number): EventId {
  const roll = deterministicUnit(sequenceIndex, 3);
  if (roll < 0.34) return "toxic-storm";
  if (roll < 0.68) return "swarm-raid";
  return "contamination-surge";
}

function getForecastIntel(state: SnapshotState, eventId?: EventId) {
  const baseLead = hasResearch(state, "atmospheric-watch") ? 160 : 118;
  const baseWindow = hasResearch(state, "atmospheric-watch") ? 30 : 50;
  let leadTime = baseLead;
  let windowSize = baseWindow;
  if (eventId === "swarm-raid" && hasResearch(state, "swarm-tracking")) {
    leadTime += 34;
    windowSize -= 12;
  }
  if (eventId === "contamination-surge" && hasResearch(state, "contamination-analytics")) {
    leadTime += 34;
    windowSize -= 12;
  }
  return {
    leadTime,
    windowSize: clamp(windowSize, 12, 54),
    certainty: clamp(1 - windowSize / 72, 0.32, 0.92)
  };
}

function createScheduledEventForIndex(sequenceIndex: number, startAt: number, state: SnapshotState): ScheduledEvent {
  const id = pickEventId(sequenceIndex);
  const definition = eventDefinitionMap[id];
  const intel = getForecastIntel(state, id);
  const duration = definition.baseDuration + Math.floor(deterministicUnit(sequenceIndex, 7) * 8);
  const halfWindow = intel.windowSize / 2;
  return {
    id,
    title: definition.title,
    description: definition.description,
    severity: definition.severity,
    art: definition.art,
    startsAt: startAt,
    duration,
    forecastStart: Math.max(0, startAt - halfWindow),
    forecastEnd: startAt + halfWindow,
    certainty: intel.certainty
  };
}

function getScheduledEventsAroundTime(state: SnapshotState, elapsedSeconds: number, count = FORECAST_EVENT_COUNT) {
  const visible: ScheduledEvent[] = [];
  let startAt = 34;
  let sequenceIndex = 0;
  let guard = 0;
  while (visible.length < count && guard < 64) {
    sequenceIndex += 1;
    startAt += 72 + Math.floor(deterministicUnit(sequenceIndex, 5) * 62);
    const scheduled = createScheduledEventForIndex(sequenceIndex, startAt, state);
    if (scheduled.startsAt >= elapsedSeconds) {
      visible.push(scheduled);
    }
    guard += 1;
  }
  return visible;
}

function findTriggeredScheduledEvent(state: SnapshotState, previousElapsed: number, currentElapsed: number) {
  let startAt = 34;
  let sequenceIndex = 0;
  let guard = 0;
  while (guard < 128) {
    sequenceIndex += 1;
    startAt += 72 + Math.floor(deterministicUnit(sequenceIndex, 5) * 62);
    if (startAt > currentElapsed) return null;
    if (startAt > previousElapsed && startAt <= currentElapsed) {
      return createScheduledEventForIndex(sequenceIndex, startAt, state);
    }
    guard += 1;
  }
  return null;
}

function createPendingEventFromSchedule(scheduled: ScheduledEvent): ActiveEvent {
  const definition = eventDefinitionMap[scheduled.id];
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    severity: definition.severity,
    art: definition.art,
    remaining: scheduled.duration,
    startedAt: scheduled.startsAt,
    responseState: "pending",
    responses: definition.responses.map((response) => ({
      ...response,
      cost: response.cost ? { ...response.cost } : undefined,
      immediate: response.immediate ? { ...response.immediate, resources: response.immediate.resources ? { ...response.immediate.resources } : undefined } : undefined,
      timedModifier: response.timedModifier ? { ...response.timedModifier } : undefined,
      tags: response.tags ? [...response.tags] : undefined
    })),
    mitigation: 0
  };
}

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
  selectResearch: (nodeId: string) => void;
  setView: (view: ViewMode) => void;
  selectRegion: (regionId: string) => void;
  selectSlot: (slotId: string | null) => void;
  buildInSlot: (slotId: string, buildingId: string) => void;
  toggleBuilding: (slotId: string) => void;
  upgradeBuilding: (slotId: string) => void;
  chooseBuildingUpgrade: (slotId: string, optionId: string) => void;
  upgradeReactor: () => void;
  resolvePendingEvent: (responseId?: string) => void;
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

const eventDefinitionMap = Object.fromEntries(
  eventDefinitions.map((definition) => [definition.id, definition])
) as Record<EventId, EventDefinition>;

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

function getDayPhase(elapsedSeconds: number): DayPhaseId {
  const phaseSeconds = elapsedSeconds % DAY_LENGTH_SECONDS;
  if (phaseSeconds < DAY_PHASE_SECONDS) return "dawn";
  if (phaseSeconds < DAY_PHASE_SECONDS * 2) return "day";
  if (phaseSeconds < DAY_PHASE_SECONDS * 3) return "dusk";
  return "night";
}

function getSolarPhaseMultiplier(dayPhase: DayPhaseId) {
  if (dayPhase === "day") return 1;
  if (dayPhase === "dawn" || dayPhase === "dusk") return 0.6;
  return 0.2;
}

function getFieldPhaseMultiplier(dayPhase: DayPhaseId) {
  if (dayPhase === "day") return 1;
  if (dayPhase === "dawn" || dayPhase === "dusk") return 0.88;
  return 0.7;
}

function getNightHazardMultiplier(dayPhase: DayPhaseId) {
  if (dayPhase === "dusk") return 1.08;
  if (dayPhase === "night") return 1.16;
  return 1;
}

function getExpeditionPhaseMultiplier(dayPhase: DayPhaseId) {
  if (dayPhase === "dusk") return 1.08;
  if (dayPhase === "night") return 1.16;
  return 1;
}

function getDistrictsForUnlockedSlots(unlockedSlotIds: string[]) {
  const unlocked = new Set(unlockedSlotIds);
  return districtSlots.filter((slot) => unlocked.has(slot.id));
}

function getNextReactorUpgradeId(tier: number) {
  return reactorUpgradeDefinitions.find((definition) => definition.tier === tier + 1)?.id ?? null;
}

function createReactorState(tier = 1, unlockedSlotIds = baseReactorUnlockedSlotIds): ReactorState {
  return {
    tier,
    modules: [],
    unlockedSlotIds: [...unlockedSlotIds],
    nextUpgradeId: getNextReactorUpgradeId(tier)
  };
}

function syncTemporalState(state: SnapshotState) {
  state.dayIndex = Math.floor(state.elapsedSeconds / DAY_LENGTH_SECONDS) + 1;
  state.dayProgress = (state.elapsedSeconds % DAY_LENGTH_SECONDS) / DAY_LENGTH_SECONDS;
  state.dayPhase = getDayPhase(state.elapsedSeconds);
  state.eventForecast = getScheduledEventsAroundTime(state, state.elapsedSeconds);
}

function applyImmediateEventConsequences(state: SnapshotState, immediate?: EventResponseOption["immediate"]) {
  if (!immediate) return;
  applyFlow(state.resources, immediate.resources);
  state.pollution = clamp(state.pollution + Number(immediate.pollution ?? 0), 0, 100);
  state.population.contamination = clamp(state.population.contamination + Number(immediate.contamination ?? 0), 0, 100);
  state.population.stability = clamp(state.population.stability + Number(immediate.stability ?? 0), 0, 100);
  state.population.health = clamp(state.population.health + Number(immediate.health ?? 0), 0, 100);
}

function getIgnoreResponseId(event: ActiveEvent) {
  return event.responses.find((response) => /ignore|ride it out|let it run/i.test(response.id + response.label))?.id ?? event.responses[event.responses.length - 1]?.id;
}

function resolvePendingEventInState(state: SnapshotState, responseId?: string) {
  if (!state.pendingEvent) return true;
  const pending = state.pendingEvent;
  const selectedResponse = pending.responses.find((response) => response.id === responseId) ?? pending.responses.find((response) => response.id === getIgnoreResponseId(pending)) ?? pending.responses[pending.responses.length - 1];
  if (!selectedResponse) return true;
  if (selectedResponse.cost && !canAfford(state.resources, selectedResponse.cost)) {
    state.alerts = appendAlert(state.alerts, {
      id: `event-cost-${pending.id}` ,
      tone: "warning",
      text: `Insufficient stock to execute ${selectedResponse.label}.`
    });
    return false;
  }

  applyFlow(state.resources, selectedResponse.cost, -1);
  applyImmediateEventConsequences(state, selectedResponse.immediate);

  const durationScale = selectedResponse.timedModifier?.durationScale ?? 1;
  state.activeEvent = {
    ...pending,
    responseState: "active",
    selectedResponseId: selectedResponse.id,
    mitigation: clamp(selectedResponse.mitigation, 0, 0.92),
    timedModifier: selectedResponse.timedModifier ? { ...selectedResponse.timedModifier } : undefined,
    remaining: Math.max(8, pending.remaining * durationScale)
  };
  state.pendingEvent = null;
  state.log = appendLog(state.log, `${pending.title}: ${selectedResponse.label} authorized.`);
  state.alerts = appendAlert(state.alerts, {
    id: `event-response-${pending.id}-${selectedResponse.id}` ,
    tone: selectedResponse.mitigation >= 0.5 ? "success" : "warning",
    text: `${pending.title}: ${selectedResponse.label}.`
  });
  return true;
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
  const reactor = createReactorState();
  const initialState: SnapshotState = {
    elapsedSeconds: 0,
    dayIndex: 1,
    dayProgress: 0,
    dayPhase: "dawn",
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
    selectedResearchId: "renewable-grid",
    districts: getDistrictsForUnlockedSlots(reactor.unlockedSlotIds),
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
    pendingEvent: null,
    eventForecast: [],
    reactor,
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
  syncTemporalState(initialState);
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
    parsed.dayIndex ??= 1;
    parsed.dayProgress ??= 0;
    parsed.dayPhase ??= "dawn";
    parsed.eventForecast ??= [];
    parsed.pendingEvent ??= null;
    parsed.reactor ??= createReactorState();
    parsed.reactor.modules ??= [];
    parsed.reactor.unlockedSlotIds ??= [...baseReactorUnlockedSlotIds];
    parsed.reactor.nextUpgradeId ??= getNextReactorUpgradeId(parsed.reactor.tier ?? 1);
    parsed.districts = getDistrictsForUnlockedSlots(parsed.reactor.unlockedSlotIds);
    if (!parsed.regions || parsed.regions.length !== regionDefinitions.length) return null;
    parsed.selectedResearchId ??= "renewable-grid";
    if (parsed.selectedSlotId && !parsed.districts.some((slot) => slot.id === parsed.selectedSlotId)) {
      parsed.selectedSlotId = null;
    }
    parsed.population.protection = getProtectionProfile(parsed);
    syncTemporalState(parsed);
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

function createExpedition(kind: ExpeditionKind, regionId: string, dayPhase: DayPhaseId): Expedition {
  const baseDuration = kind === "survey" ? 18 : kind === "exploit" ? 24 : kind === "secure" ? 30 : 22;
  const adjustedDuration = Math.ceil(baseDuration * getExpeditionPhaseMultiplier(dayPhase));
  return {
    id: `${kind}-${regionId}-${Math.random().toString(36).slice(2, 7)}`,
    regionId,
    kind,
    remaining: adjustedDuration,
    total: adjustedDuration,
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
  syncTemporalState(state);
  const dayPhase = state.dayPhase;
  const nightHazardMultiplier = getNightHazardMultiplier(dayPhase);
  const reactorBonuses = getReactorTierBonuses(state.reactor.tier);
  const activeEvent = state.activeEvent;
  const activeResponse = activeEvent?.responses.find((response) => response.id === activeEvent.selectedResponseId) ?? null;
  const mitigationFactor = 1 - Number(activeEvent?.mitigation ?? 0);
  const eventModifier = activeEvent?.timedModifier;
  const mitigation = getCityMitigation(state);
  Object.entries(reactorBonuses.hazardMitigation).forEach(([hazard, amount]) => {
    mitigation[hazard as HazardId] = Number(mitigation[hazard as HazardId] ?? 0) + Number(amount ?? 0);
  });
  const doctrineProfile = getDoctrineProfile(state);
  const staffingPressure = getStaffingPressure(state, doctrineProfile);
  const freeRoles = getFreeRoles(state);
  const storageScore = state.buildings.filter((instance) => instance.enabled && getEffectiveBuildingData(buildingMap[instance.buildingId], instance).doctrineTags.includes("storage")).reduce((sum, instance) => sum + instance.level, 0);

  const baseDelta: Record<ResourceId, number> = {
    power: 0.55 + reactorBonuses.passivePower * 0.12,
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
    research: 0.02 + reactorBonuses.researchRate * 0.06,
    gear: 0
  };

  let pollutionDelta = -0.05 - reactorBonuses.contaminationShield * 0.05;

  state.buildings.forEach((instance) => {
    if (!instance.enabled) return;
    const definition = buildingMap[instance.buildingId];
    const effective = getEffectiveBuildingData(definition, instance);
    const multiplier = getBuildingMultiplier(instance.level) * BUILDING_RATE_SCALE;
    const phaseMultiplier = instance.buildingId === "solar-array" ? getSolarPhaseMultiplier(dayPhase) : instance.buildingId === "external-fields" ? getFieldPhaseMultiplier(dayPhase) : 1;
    const weatherMultiplier = activeEvent?.id === "toxic-storm" && instance.buildingId === "solar-array" ? 0.35 * phaseMultiplier : phaseMultiplier;

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
    const stormBuffer = storageScore * 0.08 + doctrineProfile.clean * 0.015 + doctrineProfile.storage * 0.04 + doctrineProfile.resilient * 0.02 + reactorBonuses.contaminationShield * 0.24;
    const powerPenalty = Math.max(0.04, (0.35 - stormBuffer) * mitigationFactor - Number(eventModifier?.powerPenaltyOffset ?? 0));
    const contaminationRate = Math.max(0.015, 0.12 - mitigation.toxicity * 0.03 - doctrineProfile.clean * 0.006 - doctrineProfile.resilient * 0.006 + Number(eventModifier?.contaminationRateOffset ?? 0));
    baseDelta.power -= powerPenalty;
    state.population.contamination += contaminationRate * dt;
  }

  if (activeEvent?.id === "swarm-raid") {
    const towerScore = state.buildings.filter((instance) => instance.enabled && ["spray-tower", "fumigation-tower", "pheromone-hub"].includes(instance.buildingId)).reduce((sum, instance) => sum + instance.level, 0);
    const pestResponse = towerScore * 0.7 + doctrineProfile.bio * 0.35 + doctrineProfile.chemical * 0.4 + doctrineProfile.radical * 0.2 + (activeResponse?.tags?.includes("bio") ? 0.3 : 0);
    const foodPenalty = Math.max(0, 0.22 * mitigationFactor - pestResponse * 0.035 - Number(eventModifier?.foodPenaltyOffset ?? 0));
    const stabilityPenalty = Math.max(0, 0.12 * mitigationFactor - pestResponse * 0.02);
    if (foodPenalty > 0) {
      baseDelta.food -= foodPenalty;
      state.population.stability -= stabilityPenalty * dt;
    }
  }

  if (activeEvent?.id === "contamination-surge") {
    const waterPenalty = 0.2 * mitigationFactor + Number(eventModifier?.waterPenaltyOffset ?? 0);
    baseDelta.water -= waterPenalty;
    pollutionDelta += Math.max(0.02, 0.16 * mitigationFactor + doctrineProfile.synthetic * 0.015 + doctrineProfile.fossil * 0.02 - doctrineProfile.clean * 0.012 - doctrineProfile.bio * 0.01 + Number(eventModifier?.pollutionRateOffset ?? 0));
    const contaminationRate = Math.max(0.01, 0.1 * mitigationFactor - mitigation.spores * 0.02 - doctrineProfile.clean * 0.008 - doctrineProfile.resilient * 0.008 + doctrineProfile.radical * 0.004 + Number(eventModifier?.contaminationRateOffset ?? 0));
    state.population.contamination += contaminationRate * nightHazardMultiplier * dt;
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
  state.population.contamination -= reactorBonuses.contaminationShield * 0.22 * dt;
  state.population.stability += reactorBonuses.stabilitySupport * dt;

  if (staffingPressure > 0) {
    state.population.stability -= staffingPressure * 0.025 * dt;
    state.pollution += staffingPressure * 0.01 * dt;
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
    const researchRate = 0.65 + state.resources.research * 0.01 + reactorBonuses.researchRate;
    state.activeResearch.progress += researchRate * dt;
    const node = researchNodes.find((item) => item.id === state.activeResearch?.nodeId);
    if (node && state.activeResearch.progress >= node.cost) {
      state.researched = [...state.researched, node.id];
      state.activeResearch = null;
      state.population.protection = getProtectionProfile(state);
      state.alerts = appendAlert(state.alerts, {
        id: `research-${node.id}` ,
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
        id: `expedition-${expedition.id}` ,
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
  }

  if (!state.activeEvent && !state.pendingEvent) {
    const triggered = findTriggeredScheduledEvent(state, previousElapsed, state.elapsedSeconds);
    if (triggered) {
      state.pendingEvent = createPendingEventFromSchedule(triggered);
      state.speed = 0;
      state.alerts = appendAlert(state.alerts, {
        id: `event-${Math.floor(state.elapsedSeconds)}` ,
        tone: "danger",
        text: `${triggered.title} has reached the city. Choose a response.`
      });
      state.log = appendLog(state.log, `Threat event: ${triggered.title}`);
    }
  }

  syncTemporalState(state);
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

function cloneEvent(event: ActiveEvent | null) {
  if (!event) return null;
  return {
    ...event,
    responses: event.responses.map((response) => ({
      ...response,
      cost: response.cost ? { ...response.cost } : undefined,
      immediate: response.immediate ? { ...response.immediate, resources: response.immediate.resources ? { ...response.immediate.resources } : undefined } : undefined,
      timedModifier: response.timedModifier ? { ...response.timedModifier } : undefined,
      tags: response.tags ? [...response.tags] : undefined
    })),
    timedModifier: event.timedModifier ? { ...event.timedModifier } : undefined
  };
}

function cloneSnapshot(state: SnapshotState): SnapshotState {
  return {
    elapsedSeconds: state.elapsedSeconds,
    dayIndex: state.dayIndex,
    dayProgress: state.dayProgress,
    dayPhase: state.dayPhase,
    resources: { ...state.resources },
    pollution: state.pollution,
    view: state.view,
    selectedRegionId: state.selectedRegionId,
    selectedSlotId: state.selectedSlotId,
    selectedResearchId: state.selectedResearchId,
    districts: state.districts.map((slot) => ({ ...slot })),
    buildings: state.buildings.map((building) => ({ ...building })),
    regions: state.regions.map((region) => ({ ...region })),
    researched: [...state.researched],
    activeResearch: state.activeResearch ? { ...state.activeResearch } : null,
    expeditions: state.expeditions.map((expedition) => ({ ...expedition, staff: { ...expedition.staff } })),
    activeEvent: cloneEvent(state.activeEvent),
    pendingEvent: cloneEvent(state.pendingEvent),
    eventForecast: state.eventForecast.map((event) => ({ ...event })),
    reactor: {
      ...state.reactor,
      modules: [...state.reactor.modules],
      unlockedSlotIds: [...state.reactor.unlockedSlotIds]
    },
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

  selectResearch: (nodeId) => set({ selectedResearchId: nodeId, view: "research" }),

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

  upgradeReactor: () =>
    set((state) => {
      const nextUpgrade = reactorUpgradeDefinitions.find((definition) => definition.id === state.reactor.nextUpgradeId) ?? null;
      if (!nextUpgrade) return state;
      const techReady = nextUpgrade.tech.every((techId) => hasResearch(state, techId));
      if (!techReady) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `reactor-tech-${nextUpgrade.id}` ,
            tone: "warning",
            text: `${nextUpgrade.name} requires more research before installation.`
          })
        };
      }
      if (!canAfford(state.resources, nextUpgrade.cost)) {
        return {
          ...state,
          alerts: appendAlert(state.alerts, {
            id: `reactor-cost-${nextUpgrade.id}` ,
            tone: "warning",
            text: `Insufficient stock to upgrade the reactor with ${nextUpgrade.name}.`
          })
        };
      }
      const resources = { ...state.resources };
      applyFlow(resources, nextUpgrade.cost, -1);
      const unlockedSlotIds = [...new Set([...state.reactor.unlockedSlotIds, ...nextUpgrade.unlockSlotIds])];
      const reactor = createReactorState(nextUpgrade.tier, unlockedSlotIds);
      const nextState = {
        ...state,
        resources,
        reactor,
        districts: getDistrictsForUnlockedSlots(unlockedSlotIds),
        pollution: clamp(state.pollution - nextUpgrade.bonuses.contaminationShield * 4, 0, 100),
        log: appendLog(state.log, `Reactor upgraded: ${nextUpgrade.name}.`),
        alerts: appendAlert(state.alerts, {
          id: `reactor-ok-${nextUpgrade.id}` ,
          tone: "success",
          text: `${nextUpgrade.name} commissioned. New city slots are now online.`
        }),
        selectedSlotId: null
      };
      nextState.population.protection = getProtectionProfile(nextState);
      saveState(nextState);
      return nextState;
    }),

  resolvePendingEvent: (responseId) =>
    set((state) => {
      if (!state.pendingEvent) return state;
      const nextState = cloneSnapshot(state);
      const resolved = resolvePendingEventInState(nextState, responseId);
      if (!resolved) return nextState;
      nextState.population.protection = getProtectionProfile(nextState);
      cleanResourceBounds(nextState);
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

      const expedition = createExpedition(kind, regionId, state.dayPhase);
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

  setSpeed: (speed) => set((state) => { if (speed > 0 && state.pendingEvent) { const nextState = cloneSnapshot(state); resolvePendingEventInState(nextState, getIgnoreResponseId(nextState.pendingEvent!)); nextState.speed = speed; saveState(nextState); return nextState; } return { ...state, speed }; }),

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
      selectedResearchId: state.selectedResearchId,
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
      dayIndex: state.dayIndex,
      dayProgress: state.dayProgress,
      dayPhase: state.dayPhase,
      eventForecast: state.eventForecast,
      activeEvent: state.activeEvent?.title ?? null,
      activeEventRemaining: state.activeEvent?.remaining ?? null,
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



























