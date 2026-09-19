export interface DamageResult {
  shieldDamage: number;
  healthDamage: number;
  totalDamage: number;
}

export class Health {
  private readonly maxHealth: number;
  private currentHealth: number;

  private readonly maxShield: number;
  private currentShield: number;

  constructor(
    maxHealth: number,
    maxShield: number,
  ) {
    if (maxHealth <= 0) {
      throw new Error(
        "Max health must be greater than 0.",
      );
    }

    if (maxShield < 0) {
      throw new Error(
        "Max shield cannot be negative.",
      );
    }

    this.maxHealth = maxHealth;
    this.currentHealth = maxHealth;

    this.maxShield = maxShield;
    this.currentShield = maxShield;
  }

  // --------------------------------------------------
  // DAMAGE
  // --------------------------------------------------

  /**
   * Apply already-mitigated damage.
   *
   * Shield absorbs damage first.
   * Remaining damage is applied to HP.
   */
  takeDamage(amount: number): DamageResult {
    if (amount < 0) {
      throw new Error(
        "Damage cannot be negative.",
      );
    }

    // Shield absorbs damage first.
    const shieldDamage = Math.min(
      this.currentShield,
      amount,
    );

    this.currentShield -= shieldDamage;

    // Damage remaining after shield.
    const remainingDamage =
      amount - shieldDamage;

    // Apply remaining damage to HP.
    const healthDamage = Math.min(
      this.currentHealth,
      remainingDamage,
    );

    this.currentHealth -= healthDamage;

    return {
      shieldDamage,
      healthDamage,
      totalDamage:
        shieldDamage + healthDamage,
    };
  }

  // --------------------------------------------------
  // HEALTH
  // --------------------------------------------------

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

  // --------------------------------------------------
  // SHIELD
  // --------------------------------------------------

  getCurrentShield(): number {
    return this.currentShield;
  }

  getMaxShield(): number {
    return this.maxShield;
  }

  getShieldRatio(): number {
    if (this.maxShield === 0) {
      return 0;
    }

    return (
      this.currentShield /
      this.maxShield
    );
  }

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  isAlive(): boolean {
    return this.currentHealth > 0;
  }
}