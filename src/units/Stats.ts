/**
 * Statistics that describe the capabilities of a unit.
 *
 * These are mostly permanent characteristics of a
 * character. Current HP, current shield, velocity,
 * position, etc. belong to the unit's runtime state.
 */
export interface UnitStats {
  // Physical size.
  radius: number;

  // Movement speed in pixels per second.
  speed: number;

  // Used for physical collisions.
  mass: number;

  // Maximum HP.
  maxHealth: number;

  // Damage dealt by physically hitting another unit.
  bodyAttackDamage: number;

  // Reduces physical damage.
  armor: number;

  // Reduces magic damage.
  magicResistance: number;

  // Maximum amount of shield.
  //
  // 0 means the character has no shield.
  maxShield: number;
}