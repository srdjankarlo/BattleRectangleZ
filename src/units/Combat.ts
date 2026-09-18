export class Combat {
  private bodyDamageCooldown = 0;

  constructor(
    public readonly bodyAttackDamage: number,
    private readonly bodyDamageCooldownDuration = 0.3,
  ) {
    if (bodyAttackDamage < 0) {
      throw new Error(
        "Body attack damage cannot be negative.",
      );
    }
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