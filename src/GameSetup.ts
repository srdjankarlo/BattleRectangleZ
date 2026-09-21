import type { CharacterId } from "./characters/Characters";
import type { MovementType } from "./units/Movement";

export type GameMode =
  | "simulation"
  | "story"
  | "pvp";

export type MovementOverride =
  | "default"
  | MovementType;

export interface UnitSelection {
  characterId: CharacterId;
  movementOverride: MovementOverride;
}

export interface TeamSetup {
  id: number;
  units: UnitSelection[];
}

export interface BattleSetup {
  mode: GameMode;
  arenaWidth: number;
  arenaHeight: number;
  teams: TeamSetup[];
}
