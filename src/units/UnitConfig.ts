import type {
  MovementType,
} from "./Movement";

import type {
  UnitStats,
} from "./Stats";

/**
 * Describes what kind of unit this is.
 *
 * UnitConfig is DATA.
 *
 * It describes the character template,
 * not the character's current state during a match.
 */
export interface UnitConfig {
  name: string;

  stats: UnitStats;

  movementType: MovementType;

  // Temporary prototype representation.
  // Eventually this will become sprites/animations.
  color: number;
}