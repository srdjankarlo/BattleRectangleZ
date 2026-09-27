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
  
  bodyDamage: number;
  bodyAttackSpeed: number;

  // Optional defensive stats. Omitted means the unit has no resistance.
  armor?: number;
  magicResistance?: number;

  // HP regenerated per second. Omitted means 0 HP/sec.
  healthRegeneration?: number;

  // ToDo
  lifeSteal?: number;

  maxShield?: number;
}