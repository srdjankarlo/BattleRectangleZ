import type {
  CharacterId,
} from "./characters/Characters";

import type {
  MovementType,
} from "./units/Movement";

// --------------------------------------------------
// GAME MODES
// --------------------------------------------------

export type GameMode =
  | "simulation"
  | "story"
  | "pvp";

// --------------------------------------------------
// MOVEMENT OVERRIDE
// --------------------------------------------------

/*
 * "default" means:
 *
 * Use the movement type defined by the character.
 *
 * Otherwise the player can override it.
 */
export type MovementOverride =
  | "default"
  | MovementType;

// --------------------------------------------------
// UNIT SELECTION
// --------------------------------------------------

export interface UnitSelection {
  characterId: CharacterId;
  movementOverride: MovementOverride;
}

// --------------------------------------------------
// TEAM
// --------------------------------------------------

export interface TeamSetup {
  id: number;
  units: UnitSelection[];
}

// --------------------------------------------------
// ARENAS
// --------------------------------------------------

export const ARENAS = {
  tiny: {
    label: "Tiny (200 × 200)",
    width: 200,
    height: 200,
  },

  small: {
    label: "Small (500 × 500)",
    width: 500,
    height: 500,
  },

  medium: {
    label: "Medium (1000 × 1000)",
    width: 1000,
    height: 1000,
  },

  big: {
    label: "Big (1500 × 1500)",
    width: 1500,
    height: 1500,
  },

  large: {
    label: "Large (2000 × 2000)",
    width: 2000,
    height: 2000,
  },
} as const;

export type ArenaId =
  keyof typeof ARENAS;

// --------------------------------------------------
// COMPLETE BATTLE SETUP
// --------------------------------------------------

export interface BattleSetup {
  mode: GameMode;

  arenaWidth: number;
  arenaHeight: number;

  teams: TeamSetup[];
}