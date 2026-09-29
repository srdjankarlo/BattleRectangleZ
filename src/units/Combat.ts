import type { UnitStats } from "./Stats";
import { DamageType } from "./Damage";

/**
 * Shared damage rules used by every attack type.
 *
 * Attack cooldowns belong to MeleeAttack/RangedAttack, not to Combat.
 */
export class Combat {
  public readonly lifeSteal: number;

  constructor(lifeSteal = 0) {
    if (lifeSteal < 0) {
      throw new Error("Life steal cannot be negative.");
    }

    this.lifeSteal = lifeSteal;
  }

  calculateLifeStealHealing(healthDamage: number): number {
    if (healthDamage <= 0 || this.lifeSteal <= 0) {
      return 0;
    }

    return healthDamage * (this.lifeSteal / 100);
  }

  /**
   * Prototype resistance formula shared by melee and ranged attacks.
   */
  calculateDamage(
    rawDamage: number,
    damageType: DamageType,
    targetStats: UnitStats,
  ): number {
    if (rawDamage < 0) {
      throw new Error("Raw damage cannot be negative.");
    }

    let resistance = 0;

    switch (damageType) {
      case DamageType.PHYSICAL:
        resistance = targetStats.armor ?? 0;
        break;
      case DamageType.MAGIC:
        resistance = targetStats.magicResistance ?? 0;
        break;
    }

    return rawDamage * (100 / (100 + resistance));
  }
}
