/**
 * Statistics that describe the capabilities of a unit.
 *
 * These are mostly permanent characteristics of a
 * character. Current HP, current shield, velocity,
 * position, etc. belong to the unit's runtime state.
 */
export interface UnitStats {
  width: number;
  height: number;
  speed: number;
  mass: number;
  maxHealth: number;
  bodyAttackDamage: number;
  armor: number;
  magicResistance: number;
  maxShield: number;
}