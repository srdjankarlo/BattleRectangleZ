/**
 * Statistics that describe the capabilities of a unit.
 *
 * These are mostly permanent characteristics of a
 * character. Current HP, current shield, velocity,
 * position, etc. belong to the unit's runtime state.
 */
import type { DamageType } from "./Damage";

export interface RangedAttackStats {
  range: number;
  damage: number;
  attackSpeed: number;
  projectileSpeed: number;
  damageType: DamageType;
}

export interface UnitStats {
  width: number;
  height: number;

  speed: number;
  mass: number;
  maxHealth: number;
  
  bodyDamage: number;
  bodyAttackSpeed: number;

  // Distance outside the unit's physical rectangle at which body attacks can
  // connect. Omitted means the default melee range is used.
  bodyAttackRange?: number;

  // Optional ranged attack. Omitted means the unit has no ranged attack.
  rangedAttack?: RangedAttackStats;

  // Optional defensive stats. Omitted means the unit has no resistance.
  armor?: number;
  magicResistance?: number;

  // HP regenerated per second. Omitted means 0 HP/sec.
  healthRegeneration?: number;

  // ToDo
  lifeSteal?: number;

  maxShield?: number;
}