import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "../../src/game/state/store";
import { worldHexes, worldRadius } from "../../src/game/data/worldHexes";
import { regionDefinitions } from "../../src/game/data/sectors";

beforeEach(() => {
  useGameStore.getState().resetGame();
});

describe("Pestizide Punk store", () => {
  it("advances time and generates economy output", () => {
    const state = useGameStore.getState();
    const before = state.resources.materials;
    state.advanceTime(20000);
    const after = useGameStore.getState().resources.materials;
    expect(after).toBeGreaterThan(before);
  });

  it("can launch and resolve a survey expedition", () => {
    const state = useGameStore.getState();
    state.launchExpedition("scavenger-run", "survey");
    expect(useGameStore.getState().expeditions.length).toBeGreaterThan(0);
    state.advanceTime(30000);
    const region = useGameStore.getState().regions.find((item) => item.id === "scavenger-run");
    expect(region?.state).toBe("surveyed");
  });

  it("can toggle, upgrade, and specialize a city building", () => {
    const state = useGameStore.getState();
    const beforeMaterials = state.resources.materials;
    state.toggleBuilding("west");
    expect(useGameStore.getState().buildings.find((item) => item.slotId === "west")?.enabled).toBe(false);
    state.toggleBuilding("west");
    state.upgradeBuilding("west");
    state.chooseBuildingUpgrade("west", "throughput-smelter");
    const upgraded = useGameStore.getState().buildings.find((item) => item.slotId === "west");
    expect(upgraded?.enabled).toBe(true);
    expect(upgraded?.level).toBe(2);
    expect(upgraded?.upgradeOptionId).toBe("throughput-smelter");
    expect(useGameStore.getState().resources.materials).toBeLessThan(beforeMaterials);
  });

  it("keeps world hexes attached to a region or the city core on radius four map", () => {
    const regionTiles = worldHexes.filter((tile) => !tile.isCityCore);
    expect(worldRadius).toBe(4);
    expect(regionTiles.every((tile) => tile.regionId)).toBe(true);
    expect(worldHexes.some((tile) => tile.isCityCore)).toBe(true);
    expect(regionDefinitions).toHaveLength(13);
  });

  it("tracks pollution and protection layers", () => {
    const state = useGameStore.getState();
    expect(state.pollution).toBeGreaterThan(0);
    expect(state.population.protection.respiratory).toBeGreaterThanOrEqual(0);
    state.advanceTime(10000);
    expect(useGameStore.getState().pollution).toBeGreaterThanOrEqual(0);
  });

  it("lets radical doctrine upgrades push pollution upward", () => {
    const state = useGameStore.getState();
    state.upgradeBuilding("west");
    state.chooseBuildingUpgrade("west", "throughput-smelter");
    const beforePollution = useGameStore.getState().pollution;
    state.advanceTime(10000);
    expect(useGameStore.getState().pollution).toBeGreaterThan(beforePollution);
  });

  it("makes contamination surges harsher under radical doctrine load", () => {
    const radicalState = useGameStore.getState();
    radicalState.upgradeBuilding("west");
    radicalState.chooseBuildingUpgrade("west", "throughput-smelter");
    useGameStore.setState((state) => ({
      ...state,
      activeEvent: { id: "contamination-surge", title: "Contamination Surge", description: "", remaining: 12 }
    }));
    radicalState.advanceTime(10000);
    const radicalPollution = useGameStore.getState().pollution;

    useGameStore.getState().resetGame();
    const baselineState = useGameStore.getState();
    useGameStore.setState((state) => ({
      ...state,
      activeEvent: { id: "contamination-surge", title: "Contamination Surge", description: "", remaining: 12 }
    }));
    baselineState.advanceTime(10000);
    const baselinePollution = useGameStore.getState().pollution;

    expect(radicalPollution).toBeGreaterThan(baselinePollution);
  });

  it("tracks day phases and deterministic event forecasts", () => {
    const state = useGameStore.getState();
    expect(state.dayPhase).toBe("dawn");
    expect(state.eventForecast).toHaveLength(3);
    state.advanceTime(50000);
    const updated = useGameStore.getState();
    expect(["day", "dusk", "night", "dawn"]).toContain(updated.dayPhase);
    expect(updated.dayIndex).toBeGreaterThanOrEqual(1);
    expect(updated.eventForecast[0].startsAt).toBeGreaterThanOrEqual(updated.elapsedSeconds);
  });
});
