import type { DamageType } from "./Damage";

export interface MeleeAttackConfig {
  range: number;
  damage: number;
  attackSpeed: number;
  damageType: DamageType;
  sprite?: string;
}

/**
 * Pure melee-attack state. The Phaser weapon animation lives in Unit so this
 * class can also be used by the headless balance simulator without Phaser.
 */
export class MeleeAttack {
  public readonly range: number;
  public readonly damage: number;
  public readonly attackSpeed: number;
  public readonly damageType: DamageType;
  public readonly sprite?: string;
  public readonly cooldownDuration: number;

  private cooldown = 0;

  constructor(config: MeleeAttackConfig) {
    if (config.range <= 0) {
      throw new Error("Melee attack range must be greater than zero.");
    }

    if (config.damage < 0) {
      throw new Error("Melee attack damage cannot be negative.");
    }

    if (config.attackSpeed <= 0) {
      throw new Error("Melee attack speed must be greater than zero.");
    }

    this.range = config.range;
    this.damage = config.damage;
    this.attackSpeed = config.attackSpeed;
    this.damageType = config.damageType;
    this.sprite = config.sprite;
    this.cooldownDuration = 1 / config.attackSpeed;
  }

  update(deltaSeconds: number): void {
    if (this.cooldown <= 0) {
      return;
    }

    this.cooldown -= deltaSeconds;

    if (this.cooldown < 0) {
      this.cooldown = 0;
    }
  }

  canAttack(): boolean {
    return this.cooldown <= 0;
  }

  startCooldown(): void {
    this.cooldown = this.cooldownDuration;
  }

  reset(): void {
    this.cooldown = 0;
  }
}
