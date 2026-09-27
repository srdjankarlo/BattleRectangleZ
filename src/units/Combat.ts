import type {
  UnitStats,
} from "./Stats";

import {
  DamageType,
} from "./Damage";

export class Combat {
  public readonly bodyAttackDamage: number;
  private readonly bodyDamageCooldownDuration: number;
  private bodyDamageCooldown = 0;
  public readonly lifeSteal: number;

  constructor(
    bodyAttackDamage: number,
    bodyAttackSpeed: number, // like attack speed, to prevent units from constantly dealing damage if they are glued one to another or have multiple bumps in 1s
    lifeSteal = 0,
  ) {
    if (bodyAttackDamage < 0) {
      throw new Error("Body attack damage cannot be negative.",);
    }

    if (bodyAttackSpeed <= 0) {
      throw new Error("Body attack speed must be greater than zero.",);
    }

    if (lifeSteal < 0) {
      throw new Error("Life steal cannot be negative.",);
    }

    this.bodyAttackDamage = bodyAttackDamage;
    this.bodyDamageCooldownDuration = 1 / bodyAttackSpeed;
    this.lifeSteal = lifeSteal;
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(deltaSeconds: number): void {
    if (this.bodyDamageCooldown > 0) {
      this.bodyDamageCooldown -= deltaSeconds;

      if (this.bodyDamageCooldown < 0) {
        this.bodyDamageCooldown = 0;
      }
    }
  }

  // --------------------------------------------------
  // BODY ATTACK
  // --------------------------------------------------

  canDealBodyDamage(): boolean {
    return this.bodyDamageCooldown <= 0;
  }

  startBodyDamageCooldown(): void {
    this.bodyDamageCooldown = this.bodyDamageCooldownDuration;
  }

  calculateLifeStealHealing(healthDamage: number): number {
    if (healthDamage <= 0 || this.lifeSteal <= 0) {
      return 0;
    }

    return healthDamage * (this.lifeSteal / 100);
  }

  // --------------------------------------------------
  // DAMAGE CALCULATION
  // --------------------------------------------------

  /**
   * Calculates how much damage gets through the
   * target's armor or magic resistance.
   *
   * This is a prototype formula:
   *
   * finalDamage =
   * rawDamage * 100 / (100 + resistance)
   *
   * It means increasing resistance always reduces
   * incoming damage, but never makes damage reach zero.
   */
  calculateDamage(
    rawDamage: number,
    damageType: DamageType,
    targetStats: UnitStats,
  ): number {
    if (rawDamage < 0) {
      throw new Error(
        "Raw damage cannot be negative.",
      );
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

    const damageMultiplier = 100 / (100 + resistance);

    return rawDamage * damageMultiplier;
  }
}