import { Combat } from "./Combat";
import { DamageType } from "./Damage";
import type { DamageResult, Health } from "./Health";
import { Physics } from "./Physics";
import type { MeleeAttack } from "./MeleeAttack";
import type { UnitConfig } from "./UnitConfig";

/**
 * Minimum interface shared by the live Phaser unit and the headless balance
 * simulation. The actual combat rules do not depend on rendering.
 */
export interface CombatUnit {
  readonly teamId: number;
  readonly config: Readonly<UnitConfig>;
  readonly combat: Combat;
  readonly health: Health;
  readonly physics: Physics;
  readonly meleeAttack: MeleeAttack | null;
  onHealthChanged?: () => void;
  isAlive(): boolean;
}

export const ZERO_DAMAGE_RESULT: DamageResult = {
  shieldDamage: 0,
  healthDamage: 0,
  totalDamage: 0,
};

/**
 * Applies one attack through the game's actual resistance, shield, health,
 * and lifesteal rules. Visual death handling remains with the live Unit.
 */
export function applyDamage(
  attacker: CombatUnit,
  target: CombatUnit,
  rawDamage: number,
  damageType: DamageType,
): DamageResult {
  if (!attacker.isAlive() || !target.isAlive()) {
    return ZERO_DAMAGE_RESULT;
  }

  const finalDamage = attacker.combat.calculateDamage(
    rawDamage,
    damageType,
    target.config.stats,
  );

  const result = target.health.takeDamage(finalDamage);
  target.onHealthChanged?.();

  if (result.healthDamage > 0) {
    const healing = attacker.combat.calculateLifeStealHealing(
      result.healthDamage,
    );

    if (healing > 0) {
      attacker.health.heal(healing);
      attacker.onHealthChanged?.();
    }
  }

  return result;
}

/**
 * Shared directional melee range check. Range extends from the attacker's
 * rectangular body on every side, matching the live game's melee geometry.
 */
export function isWithinMeleeRange(
  attacker: CombatUnit,
  target: CombatUnit,
): boolean {
  const attack = attacker.config.stats.meleeAttack;

  if (!attack) {
    return false;
  }

  return attacker.physics.isWithinRange(target.physics, attack.range);
}

/** Executes one melee attack through the shared range/damage/cooldown rules. */
export function performMeleeAttack(
  attacker: CombatUnit,
  target: CombatUnit,
): boolean {
  const attack = attacker.meleeAttack;

  if (
    !attack ||
    !attacker.isAlive() ||
    !target.isAlive() ||
    attacker.teamId === target.teamId ||
    !isWithinMeleeRange(attacker, target) ||
    !attack.canAttack()
  ) {
    return false;
  }

  applyDamage(attacker, target, attack.damage, attack.damageType);
  attack.startCooldown();
  return true;
}

/** Shared ranged attack range check used by live and headless simulation. */
export function isWithinRangedRange(
  attacker: CombatUnit,
  target: CombatUnit,
): boolean {
  const attack = attacker.config.stats.rangedAttack;

  if (!attack) {
    return false;
  }

  const dx = target.physics.x - attacker.physics.x;
  const dy = target.physics.y - attacker.physics.y;
  const distanceSquared = dx * dx + dy * dy;
  const range = attack.range + target.physics.radius;

  return distanceSquared <= range * range;
}
