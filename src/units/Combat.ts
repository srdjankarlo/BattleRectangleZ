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

  constructor(
    bodyAttackDamage: number,
    bodyAttackSpeed: number, // like attack speed, to prevent units from constantly dealing damage if they are in the corner
  ) {
    if (bodyAttackDamage < 0) {
      throw new Error(
        "Body attack damage cannot be negative.",
      );
    }

    if (bodyAttackSpeed <= 0) {
      throw new Error(
        "Body attack speed must be greater than zero.",
      );
    }

    this.bodyAttackDamage =
      bodyAttackDamage;

    this.bodyDamageCooldownDuration =
      1 / bodyAttackSpeed;
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(deltaSeconds: number): void {
    if (this.bodyDamageCooldown > 0) {
      this.bodyDamageCooldown -=
        deltaSeconds;

      if (this.bodyDamageCooldown < 0) {
        this.bodyDamageCooldown = 0;
      }
    }
  }

  // --------------------------------------------------
  // BODY ATTACK
  // --------------------------------------------------

  canDealBodyDamage(): boolean {
    return (
      this.bodyDamageCooldown <= 0
    );
  }

  startBodyDamageCooldown(): void {
    this.bodyDamageCooldown =
      this.bodyDamageCooldownDuration;
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
        resistance = targetStats.armor;
        break;

      case DamageType.MAGIC:
        resistance =
          targetStats.magicResistance;
        break;
    }

    const damageMultiplier =
      100 /
      (100 + resistance);

    return rawDamage *
      damageMultiplier;
  }
}