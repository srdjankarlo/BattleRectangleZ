import Phaser from "phaser";

import { Movement } from "./Movement";
import {
  Combat,
  DEFAULT_BODY_ATTACK_RANGE,
} from "./Combat";
import { Health } from "./Health";
import { RangedAttack } from "./RangedAttack";
import { Physics } from "./Physics";
import type { UnitConfig } from "./UnitConfig";
import { DamageType } from "./Damage";
import type { DamageResult } from "./Health";

export class Unit {
  // --------------------------------------------------
  // VISUALS
  // --------------------------------------------------
  public readonly sprite: Phaser.GameObjects.Image;
  public readonly bodyAttackRangeIndicator: Phaser.GameObjects.Rectangle;
  public readonly healthBarBg: Phaser.GameObjects.Rectangle;
  public readonly healthBarFill: Phaser.GameObjects.Rectangle;

  private readonly healthBarWidth: number;
  private readonly healthBarOffsetY: number;

  private lastHealthRatio = -1;
  private lastHealthBarColor = -1;

  // --------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------
  public readonly config: Readonly<UnitConfig>;
  public readonly name: string;
  public readonly teamId: number;
  public readonly instanceNumber: number;

  // --------------------------------------------------
  // SYSTEMS
  // --------------------------------------------------
  public readonly movement: Movement;
  public readonly combat: Combat;
  public readonly health: Health;
  public readonly physics: Physics;
  public readonly rangedAttack: RangedAttack | null;

  constructor(
    scene: Phaser.Scene,
    config: UnitConfig,
    x: number,
    y: number,
    arenaWidth: number,
    arenaHeight: number,
    teamId: number,
    instanceNumber: number,
  ) {
    this.config = config;
    this.name = config.name;
    this.teamId = teamId;
    this.instanceNumber = instanceNumber;

    const stats = config.stats;

    this.health = new Health(
      stats.maxHealth,
      stats.maxShield ?? 0,
      stats.healthRegeneration ?? 0,
    );

    this.combat = new Combat(
      stats.bodyDamage,
      stats.bodyAttackSpeed,
      stats.lifeSteal ?? 0,
      stats.bodyAttackRange ?? DEFAULT_BODY_ATTACK_RANGE,
    );

    this.rangedAttack = stats.rangedAttack
      ? new RangedAttack(stats.rangedAttack)
      : null;

    this.physics = new Physics(
      x,
      y,
      stats.width,
      stats.height,
      arenaWidth,
      arenaHeight,
      stats.mass,
    );

    this.movement = new Movement(
      stats.speed,
      config.movementType,
    );

    this.movement.initialize(
      this.physics,
    );

    // Unit sprite.
    this.sprite = scene.add.image(
      x,
      y,
      config.icon,
    );

    this.sprite.setDisplaySize(
      stats.width,
      stats.height,
    );

    this.sprite.setDepth(10);

    // The red rectangle shows the exact body-attack area. It extends beyond
    // the icon, so an enemy can enter attack range before physical collision.
    this.bodyAttackRangeIndicator = scene.add.rectangle(
      x,
      y,
      stats.width + this.combat.bodyAttackRange * 2,
      stats.height + this.combat.bodyAttackRange * 2,
      0x000000,
      0,
    );

    this.bodyAttackRangeIndicator
      .setStrokeStyle(2, 0xef4444, 0.85)
      .setDepth(8);

    // Health bar geometry never changes during a battle,
    // so cache the values rather than recalculating them every frame.
    this.healthBarWidth = Math.max(
      30,
      stats.width,
    );

    this.healthBarOffsetY =
      stats.height / 2 + 8;

    this.healthBarBg = scene.add.rectangle(
      x,
      y - this.healthBarOffsetY,
      this.healthBarWidth,
      6,
      0x111111,
    );

    this.healthBarBg.setDepth(11);
    this.healthBarBg.setStrokeStyle(
      1,
      0x000000,
      0.8,
    );

    this.healthBarFill = scene.add.rectangle(
      x - this.healthBarWidth / 2,
      y - this.healthBarOffsetY,
      this.healthBarWidth,
      4,
      0x22c55e,
    );

    this.healthBarFill
      .setOrigin(0, 0.5)
      .setDepth(12);

    this.updateHealthBar();
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(deltaSeconds: number): void {
    this.combat.update(deltaSeconds);
    this.rangedAttack?.update(deltaSeconds);

    if (!this.isAlive()) {
      return;
    }

    // Regenerate HP before movement. Health owns the regeneration calculation;
    // Unit only refreshes the visual bar when HP actually changed.
    if (this.health.regenerate(deltaSeconds)) {
      this.updateHealthBar();
    }

    this.movement.update(
      deltaSeconds,
      this.physics,
    );

    this.physics.update(deltaSeconds);
    this.physics.handleWallCollision();

    this.syncSpriteToPhysics();
  }

  // --------------------------------------------------
  // POSITION SYNCHRONIZATION
  // --------------------------------------------------

  private syncSpriteToPhysics(): void {
    const x = this.physics.x;
    const y = this.physics.y;

    this.sprite.x = x;
    this.sprite.y = y;

    this.bodyAttackRangeIndicator.x = x;
    this.bodyAttackRangeIndicator.y = y;

    this.healthBarBg.x = x;
    this.healthBarBg.y =
      y - this.healthBarOffsetY;

    this.healthBarFill.x =
      x - this.healthBarWidth / 2;
    this.healthBarFill.y =
      y - this.healthBarOffsetY;
  }

  // --------------------------------------------------
  // HEALTH BAR
  // --------------------------------------------------

  private updateHealthBar(): void {
    if (!this.isAlive()) {
      return;
    }

    const healthRatio = Phaser.Math.Clamp(
      this.getHealthRatio(),
      0,
      1,
    );

    if (healthRatio !== this.lastHealthRatio) {
      this.lastHealthRatio = healthRatio;
      this.healthBarFill.setScale(
        healthRatio,
        1,
      );
    }

    const color =
      this.getHealthColor(healthRatio);

    if (color !== this.lastHealthBarColor) {
      this.lastHealthBarColor = color;
      this.healthBarFill.setFillStyle(
        color,
      );
    }
  }

  private getHealthColor(
    healthRatio: number,
  ): number {
    if (healthRatio > 0.75) {
      return 0x22c55e;
    }

    if (healthRatio > 0.5) {
      return 0x84cc16;
    }

    if (healthRatio > 0.25) {
      return 0xfacc15;
    }

    if (healthRatio > 0.1) {
      return 0xf97316;
    }

    return 0xef4444;
  }

  // --------------------------------------------------
  // DAMAGE & DEATH
  // --------------------------------------------------

  public resolveCollision(
    other: Unit,
  ): void {
    if (
      !this.isAlive() ||
      !other.isAlive()
    ) {
      return;
    }

    // Resolve physical collision separately from combat range. A unit can
    // therefore attack before its icon physically touches the enemy.
    this.physics.resolveCollision(other.physics);

    const thisInAttackRange =
      this.physics.isWithinAttackRange(
        other.physics,
        this.combat.bodyAttackRange,
      );

    const otherInAttackRange =
      other.physics.isWithinAttackRange(
        this.physics,
        other.combat.bodyAttackRange,
      );

    const thisCanAttack =
      thisInAttackRange &&
      this.combat.canDealBodyDamage();

    const otherCanAttack =
      otherInAttackRange &&
      other.combat.canDealBodyDamage();

    if (
      this.teamId === other.teamId ||
      (!thisCanAttack && !otherCanAttack)
    ) {
      return;
    }

    // Check both attack opportunities before applying either attack so the
    // result does not depend on which unit happens to be processed first.
    if (thisCanAttack) {
      other.receiveDamage(
        this.combat.bodyAttackDamage,
        DamageType.PHYSICAL,
        this,
      );
      this.combat.startBodyDamageCooldown();
    }

    if (otherCanAttack) {
      this.receiveDamage(
        other.combat.bodyAttackDamage,
        DamageType.PHYSICAL,
        other,
      );
      other.combat.startBodyDamageCooldown();
    }
  }

  /**
   * Applies raw incoming damage, handles resistance, health/shield damage,
   * death, and lifesteal for the attacking unit.
   *
   * Keeping this in Unit gives body attacks and projectiles exactly the same
   * damage pipeline instead of duplicating combat rules in two systems.
   */
  public receiveDamage(
    rawDamage: number,
    damageType: DamageType,
    attacker?: Unit,
  ): DamageResult {
    if (!this.isAlive()) {
      return {
        shieldDamage: 0,
        healthDamage: 0,
        totalDamage: 0,
      };
    }

    const finalDamage = attacker
      ? attacker.combat.calculateDamage(
          rawDamage,
          damageType,
          this.config.stats,
        )
      : rawDamage;

    const result = this.health.takeDamage(finalDamage);

    // The health bar represents HP, not shield. Do not update it when damage
    // is fully absorbed by the shield.
    if (result.healthDamage > 0) {
      this.updateHealthBar();
    }

    if (!this.isAlive()) {
      this.die();
    }

    if (
      attacker &&
      result.healthDamage > 0
    ) {
      const healing = attacker.combat.calculateLifeStealHealing(
        result.healthDamage,
      );

      if (healing > 0) {
        attacker.health.heal(healing);
        attacker.updateHealthBar();
      }
    }

    return result;
  }

  private die(): void {
    this.sprite.setVisible(false);
    this.bodyAttackRangeIndicator.setVisible(false);
    this.healthBarBg.setVisible(false);
    this.healthBarFill.setVisible(false);
  }

  // --------------------------------------------------
  // STATE ACCESSORS
  // --------------------------------------------------

  public isAlive(): boolean {
    return this.health.isAlive();
  }

  public getHealth(): number {
    return this.health.getCurrentHealth();
  }

  public getMaxHealth(): number {
    return this.health.getMaxHealth();
  }

  public getHealthRegeneration(): number {
    return this.health.getHealthRegeneration();
  }

  public getHealthRatio(): number {
    return this.health.getHealthRatio();
  }

  public getShield(): number {
    return this.health.getCurrentShield();
  }

  public getMaxShield(): number {
    return this.health.getMaxShield();
  }

  public destroy(): void {
    this.sprite.destroy();
    this.bodyAttackRangeIndicator.destroy();
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
  }
}
