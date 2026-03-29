import { beforeEach, describe, expect, it } from "vitest";
import { worldHexes } from "../../src/game/data/worldHexes";
import { useGameStore } from "../../src/game/state/store";

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

  it("can toggle and upgrade a city building", () => {
    const state = useGameStore.getState();
    const beforeMaterials = state.resources.materials;
    state.toggleBuilding("west");
    expect(useGameStore.getState().buildings.find((item) => item.slotId === "west")?.enabled).toBe(false);
    state.toggleBuilding("west");
    state.upgradeBuilding("west");
    const upgraded = useGameStore.getState().buildings.find((item) => item.slotId === "west");
    expect(upgraded?.enabled).toBe(true);
    expect(upgraded?.level).toBe(2);
    expect(useGameStore.getState().resources.materials).toBeLessThan(beforeMaterials);
  });

  it("keeps world hexes attached to a region or the city core", () => {
    const regionTiles = worldHexes.filter((tile) => !tile.isCityCore);
    expect(regionTiles.every((tile) => tile.regionId)).toBe(true);
    expect(worldHexes.some((tile) => tile.isCityCore)).toBe(true);
  });
});
