export type ResourceId =
  | "power"
  | "water"
  | "food"
  | "materials"
  | "biomass"
  | "feedstock"
  | "coal"
  | "oil"
  | "glass"
  | "fertilizer"
  | "pesticides"
  | "research"
  | "gear";

export type RoleId = "workers" | "technicians" | "researchers" | "rangers";
export type ViewMode = "world" | "city" | "research";
export type HazardId = "toxicity" | "spores" | "radiation" | "infestation";
export type ProtectionSlotId = "respiratory" | "chemical" | "radiation" | "environmental";
export type DoctrineTag =
  | "clean"
  | "fossil"
  | "bio"
  | "synthetic"
  | "chemical"
  | "radical"
  | "engineered"
  | "storage"
  | "resilient";
export type PestControlTag = "bio" | "chemical" | "industrial" | "radical";
export type TerrainType =
  | "city-core"
  | "toxic-forest"
  | "fungal-wetlands"
  | "overgrown-ruins"
  | "scavenger-scrapland"
  | "chemical-waste"
  | "irradiated-badlands"
  | "industrial-hulk"
  | "mutant-nest"
  | "neutral-rock"
  | "petro-marsh"
  | "steam-fissures"
  | "flooded-dam"
  | "algae-salt-flats"
  | "ash-farmland";
export type BuildingCategory =
  | "energy"
  | "production"
  | "research"
  | "defense"
  | "population"
  | "medicine"
  | "logistics"
  | "waste";

export interface ResourceDefinition {
  id: ResourceId;
  label: string;
  short: string;
  color: string;
}

export type PartialRecord<K extends string, T> = Partial<Record<K, T>>;

export interface HazardProfile extends PartialRecord<HazardId, number> {}
export interface ProtectionProfile extends PartialRecord<ProtectionSlotId, number> {}
export interface ResourceFlow extends PartialRecord<ResourceId, number> {}
export interface StaffingCost extends PartialRecord<RoleId, number> {}
export interface WasteOutput {
  pollution?: number;
}

export interface BuildingUpgradeOption {
  id: string;
  name: string;
  description: string;
  cost?: ResourceFlow;
  output?: ResourceFlow;
  upkeep?: ResourceFlow;
  wasteOutput?: WasteOutput;
  emissions?: number;
  storageCapacity?: ResourceFlow;
  protectionOutput?: ProtectionProfile;
  hazardMitigation?: PartialRecord<HazardId, number>;
  doctrineTags?: DoctrineTag[];
}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;
  cost: ResourceFlow;
  staff: StaffingCost;
  upkeep?: ResourceFlow;
  output?: ResourceFlow;
  fuelInput?: ResourceFlow;
  wasteOutput?: WasteOutput;
  emissions?: number;
  storageCapacity?: ResourceFlow;
  protectionOutput?: ProtectionProfile;
  hazardMitigation?: PartialRecord<HazardId, number>;
  hazardExposureModifier?: ProtectionProfile;
  doctrineTags?: DoctrineTag[];
  pestControlTags?: PestControlTag[];
  unlockTech?: string;
  upgradeOptions?: BuildingUpgradeOption[];
}

export interface BuildingInstance {
  slotId: string;
  buildingId: string;
  enabled: boolean;
  level: number;
  upgradeOptionId?: string;
}

export interface DistrictSlot {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface SectorActionRequirement {
  tech?: string[];
  gear?: number;
  protection?: ProtectionProfile;
}

export interface HexCoord {
  q: number;
  r: number;
}

export interface HexTileDefinition extends HexCoord {
  id: string;
  terrainType: TerrainType;
  regionId: string | null;
  decorVariant: number;
  dangerTint?: string;
  isCityCore?: boolean;
  isVisible?: boolean;
}

export type RegionStateId =
  | "known"
  | "surveying"
  | "surveyed"
  | "exploiting"
  | "secured"
  | "outpost";

export interface RegionDefinition {
  id: string;
  name: string;
  archetype: string;
  ring: number;
  primaryTerrain: TerrainType;
  secondaryTerrains?: TerrainType[];
  detailImage?: string;
  description: string;
  hazard: HazardProfile;
  resources: ResourceFlow;
  surveyReward?: ResourceFlow;
  secureReward?: ResourceFlow;
  access: SectorActionRequirement;
  exploit: SectorActionRequirement;
  secure: SectorActionRequirement;
  hexTileIds: string[];
}

export interface RegionRuntime {
  id: string;
  state: RegionStateId;
  discovered: boolean;
}

export interface ResearchNode {
  id: string;
  name: string;
  branch: string;
  tier: number;
  description: string;
  cost: number;
  prerequisites: string[];
  unlocks: string[];
  doctrineTags: DoctrineTag[];
}

export interface ActiveResearch {
  nodeId: string;
  progress: number;
}

export type ExpeditionKind = "survey" | "exploit" | "secure" | "outpost";

export interface Expedition {
  id: string;
  regionId: string;
  kind: ExpeditionKind;
  remaining: number;
  total: number;
  staff: StaffingCost;
}

export type EventId = "toxic-storm" | "swarm-raid" | "contamination-surge";
export type DayPhaseId = "dawn" | "day" | "dusk" | "night";

export interface ActiveEvent {
  id: EventId;
  title: string;
  description: string;
  remaining: number;
}

export interface ScheduledEvent {
  id: EventId;
  title: string;
  description: string;
  startsAt: number;
  duration: number;
}

export interface PopulationState {
  total: number;
  health: number;
  contamination: number;
  stability: number;
  roles: Record<RoleId, number>;
  protection: Record<ProtectionSlotId, number>;
}

export interface AlertMessage {
  id: string;
  tone: "warning" | "danger" | "info" | "success";
  text: string;
}

export interface SnapshotState {
  elapsedSeconds: number;
  dayIndex: number;
  dayProgress: number;
  dayPhase: DayPhaseId;
  resources: Record<ResourceId, number>;
  pollution: number;
  view: ViewMode;
  selectedRegionId: string | null;
  selectedSlotId: string | null;
  selectedResearchId: string | null;
  districts: DistrictSlot[];
  buildings: BuildingInstance[];
  regions: RegionRuntime[];
  researched: string[];
  activeResearch: ActiveResearch | null;
  expeditions: Expedition[];
  activeEvent: ActiveEvent | null;
  eventForecast: ScheduledEvent[];
  population: PopulationState;
  speed: number;
  alerts: AlertMessage[];
  log: string[];
}

