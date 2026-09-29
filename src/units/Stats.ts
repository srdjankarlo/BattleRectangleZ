/**
 * Statistics that describe the capabilities of a unit.
 *
 * These are mostly permanent characteristics of a character. Current HP,
 * current shield, velocity, position, cooldowns, etc. belong to runtime state.
 */
import type { DamageType } from "./Damage";

export type ProjectileBehavior = "homing" | "straight";

export interface MeleeAttackStats {
  range: number;
  damage: number;
  attackSpeed: number;
  damageType: DamageType;
  /** Optional PNG/SVG weapon sprite. Omitted for the default rectangle. */
  sprite?: string;
}

export interface RangedAttackStats {
  range: number;
  damage: number;
  attackSpeed: number;
  projectileSpeed: number;
  damageType: DamageType;
  /** Homing follows the target. Straight keeps the firing direction. */
  projectileBehavior?: ProjectileBehavior;
  /** Optional projectile image. Omitted for the default simple projectile. */
  projectileSprite?: string;
}

export interface UnitStats {
  width: number;
  height: number;
  speed: number;
  mass: number;
  maxHealth: number;

  meleeAttack?: MeleeAttackStats;
  rangedAttack?: RangedAttackStats;

  // Optional defensive stats. Omitted means the value is 0.
  armor?: number;
  magicResistance?: number;

  // HP regenerated per second. Omitted means 0 HP/sec.
  healthRegeneration?: number;

  // Percentage of actual HP damage dealt that is returned as healing.
  lifeSteal?: number;

  maxShield?: number;
}

