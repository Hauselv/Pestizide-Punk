import { beforeEach, describe, expect, it } from "vitest";
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
    const sector = useGameStore.getState().sectors.find((item) => item.id === "scavenger-run");
    expect(sector?.state).toBe("surveyed");
  });
});
