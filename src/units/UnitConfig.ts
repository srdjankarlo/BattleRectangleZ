import type { AIType } from "./AIType";
import type { MovementType } from "./Movement";
import type { UnitStats } from "./Stats";

/**
 * Describes a character template. Current runtime state stays inside Unit.
 */
export interface UnitConfig {
  name: string;
  stats: UnitStats;
  movementType: MovementType;
  aiType: AIType;

  // Temporary prototype representation. Eventually this becomes animations.
  icon: string;
}
