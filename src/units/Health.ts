export class Health {
  private currentHealth: number;

  constructor(
    private readonly maxHealth: number,
  ) {
    if (maxHealth <= 0) {
      throw new Error(
        "Max health must be greater than 0.",
      );
    }

    this.currentHealth = maxHealth;
  }

  /**
   * Remove health.
   *
   * Health can never go below zero.
   */
  takeDamage(amount: number): void {
    if (amount < 0) {
      throw new Error(
        "Damage cannot be negative.",
      );
    }

    this.currentHealth = Math.max(
      0,
      this.currentHealth - amount,
    );
  }

  getCurrentHealth(): number {
    return this.currentHealth;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

  getHealthRatio(): number {
    return (
      this.currentHealth /
      this.maxHealth
    );
  }

  isAlive(): boolean {
    return this.currentHealth > 0;
  }
}