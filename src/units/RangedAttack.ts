import type { DamageType } from "./Damage";

export interface RangedAttackConfig {
  range: number;
  damage: number;
  attackSpeed: number;
  projectileSpeed: number;
  damageType: DamageType;
}

export class RangedAttack {
  public readonly range: number;
  public readonly damage: number;
  public readonly projectileSpeed: number;
  public readonly damageType: DamageType;

  private readonly cooldownDuration: number;
  private cooldown = 0;

  constructor(config: RangedAttackConfig) {
    if (config.range <= 0) {
      throw new Error("Ranged attack range must be greater than zero.");
    }

    if (config.damage < 0) {
      throw new Error("Ranged attack damage cannot be negative.");
    }

    if (config.attackSpeed <= 0) {
      throw new Error("Ranged attack speed must be greater than zero.");
    }

    if (config.projectileSpeed <= 0) {
      throw new Error("Projectile speed must be greater than zero.");
    }

    this.range = config.range;
    this.damage = config.damage;
    this.projectileSpeed = config.projectileSpeed;
    this.damageType = config.damageType;
    this.cooldownDuration = 1 / config.attackSpeed;
  }

  update(deltaSeconds: number): void {
    if (this.cooldown > 0) {
      this.cooldown -= deltaSeconds;

      if (this.cooldown < 0) {
        this.cooldown = 0;
      }
    }
  }

  canAttack(): boolean {
    return this.cooldown <= 0;
  }

  startCooldown(): void {
    this.cooldown = this.cooldownDuration;
  }
}
