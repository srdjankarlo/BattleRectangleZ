export class Combat {
  public readonly bodyAttackDamage: number;

  private readonly bodyDamageCooldownDuration: number;

  private bodyDamageCooldown = 0;

  constructor(
    bodyAttackDamage: number,
    bodyDamageCooldownDuration = 0.3,
  ) {
    if (bodyAttackDamage < 0) {
      throw new Error(
        "Body attack damage cannot be negative.",
      );
    }

    if (bodyDamageCooldownDuration < 0) {
      throw new Error(
        "Body damage cooldown cannot be negative.",
      );
    }

    this.bodyAttackDamage =
      bodyAttackDamage;

    this.bodyDamageCooldownDuration =
      bodyDamageCooldownDuration;
  }

  update(deltaSeconds: number): void {
    if (this.bodyDamageCooldown > 0) {
      this.bodyDamageCooldown -= deltaSeconds;

      if (this.bodyDamageCooldown < 0) {
        this.bodyDamageCooldown = 0;
      }
    }
  }

  canDealBodyDamage(): boolean {
    return this.bodyDamageCooldown <= 0;
  }

  startBodyDamageCooldown(): void {
    this.bodyDamageCooldown =
      this.bodyDamageCooldownDuration;
  }
}