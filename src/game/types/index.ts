export type ResourceId =
  | "energy"
  | "water"
  | "food"
  | "materials"
  | "biomass"
  | "feedstock"
  | "pesticides"
  | "research"
  | "gear";

export type RoleId = "workers" | "technicians" | "researchers" | "rangers";
export type ViewMode = "world" | "city" | "research";
export type HazardId = "toxicity" | "spores" | "radiation" | "infestation";
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
  | "neutral-rock";
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
export interface ResourceFlow extends PartialRecord<ResourceId, number> {}
export interface StaffingCost extends PartialRecord<RoleId, number> {}

export interface BuildingDefinition {
  id: string;
  name: string;
  category: BuildingCategory;
  description: string;
  cost: ResourceFlow;
  staff: StaffingCost;
  upkeep?: ResourceFlow;
  output?: ResourceFlow;
  hazardMitigation?: PartialRecord<HazardId, number>;
  unlockTech?: string;
}

export interface BuildingInstance {
  slotId: string;
  buildingId: string;
  enabled: boolean;
  level: number;
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

export interface ActiveEvent {
  id: EventId;
  title: string;
  description: string;
  remaining: number;
}

export interface PopulationState {
  total: number;
  health: number;
  contamination: number;
  stability: number;
  roles: Record<RoleId, number>;
}

export interface AlertMessage {
  id: string;
  tone: "warning" | "danger" | "info" | "success";
  text: string;
}

export interface SnapshotState {
  elapsedSeconds: number;
  resources: Record<ResourceId, number>;
  view: ViewMode;
  selectedRegionId: string | null;
  selectedSlotId: string | null;
  districts: DistrictSlot[];
  buildings: BuildingInstance[];
  regions: RegionRuntime[];
  researched: string[];
  activeResearch: ActiveResearch | null;
  expeditions: Expedition[];
  activeEvent: ActiveEvent | null;
  population: PopulationState;
  speed: number;
  alerts: AlertMessage[];
  log: string[];
}
