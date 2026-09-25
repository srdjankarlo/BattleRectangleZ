import type { BattleSetup } from "../GameSetup";

// The currently selected battle setup is application state,
// not Phaser scene state. Keeping it here means main.ts and
// the BattleScene do not need to know about each other's internals.
let activeBattleSetup: BattleSetup | null = null;

export function setActiveBattleSetup(
  setup: BattleSetup | null,
): void {
  activeBattleSetup = setup;
}

export function getActiveBattleSetup(): BattleSetup | null {
  return activeBattleSetup;
}
