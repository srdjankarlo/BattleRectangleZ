import Phaser from "phaser";

import { Movement } from "./Movement";
import { Combat } from "./Combat";
import { Health } from "./Health";
import { Physics } from "./Physics";
import type { UnitConfig } from "./UnitConfig";
import { DamageType } from "./Damage";

export class Unit {
  // --------------------------------------------------
  // VISUALS
  // --------------------------------------------------
  public readonly sprite: Phaser.GameObjects.Image;
  public readonly healthBarBg: Phaser.GameObjects.Rectangle;
  public readonly healthBarFill: Phaser.GameObjects.Rectangle;

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

    // Systems
    this.health = new Health(stats.maxHealth, stats.maxShield);
    this.combat = new Combat(stats.bodyDamage);
    this.physics = new Physics(
      x,
      y,
      stats.width,
      stats.height,
      arenaWidth,
      arenaHeight,
      stats.mass,
    );

    this.movement = new Movement(stats.speed, config.movementType);
    this.movement.initialize(this.physics);

    // Unit Sprite
    this.sprite = scene.add.image(x, y, config.icon);
    this.sprite.setDisplaySize(stats.width, stats.height);
    this.sprite.setDepth(10);

    // Health Bar - Background (Dark Gray Frame)
    const barWidth = Math.max(30, stats.width);
    const barHeight = 6;
    const barOffsetY = stats.height / 2 + 8;

    this.healthBarBg = scene.add.rectangle(
      x,
      y - barOffsetY,
      barWidth,
      barHeight,
      0x111111,
    );
    this.healthBarBg.setDepth(11);
    this.healthBarBg.setStrokeStyle(1, 0x000000, 0.8);

    // Health Bar - Fill (Colored Bar)
    this.healthBarFill = scene.add.rectangle(
      x - barWidth / 2, // Left origin for scaleX shrinking
      y - barOffsetY,
      barWidth,
      barHeight - 2,
      0x22c55e,
    );
    this.healthBarFill.setOrigin(0, 0.5); // Anchor to left edge
    this.healthBarFill.setDepth(12);

    this.updateHealthBar();
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------
  update(deltaSeconds: number): void {
    this.combat.update(deltaSeconds);

    if (!this.isAlive()) {
      return;
    }

    this.movement.update(deltaSeconds, this.physics);
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
    const barOffsetY = this.physics.height / 2 + 8;
    const barWidth = Math.max(30, this.physics.width);

    this.sprite.setPosition(x, y);
    this.healthBarBg.setPosition(x, y - barOffsetY);
    this.healthBarFill.setPosition(x - barWidth / 2, y - barOffsetY);
  }

  // --------------------------------------------------
  // HEALTH BAR UPDATE (FAST SCALE ADAPTATION)
  // --------------------------------------------------
  private updateHealthBar(): void {
    if (!this.isAlive()) {
      return;
    }

    const healthRatio = this.getHealthRatio();

    // Scale fill bar horizontally from left origin
    this.healthBarFill.setScale(Phaser.Math.Clamp(healthRatio, 0, 1), 1);

    // Dynamic color change based on health ratio
    const color = this.getHealthColor(healthRatio);
    this.healthBarFill.setFillStyle(color);
  }

  private getHealthColor(healthRatio: number): number {
    if (healthRatio > 0.75) return 0x22c55e; // Green
    if (healthRatio > 0.5) return 0x84cc16;  // Lime
    if (healthRatio > 0.25) return 0xfacc15; // Yellow
    if (healthRatio > 0.1) return 0xf97316;  // Orange
    return 0xef4444;                          // Red
  }

  // --------------------------------------------------
  // DAMAGE & DEATH
  // --------------------------------------------------
  public resolveCollision(other: Unit): void {
    if (!this.isAlive() || !other.isAlive()) {
      return;
    }

    const collisionOccurred = this.physics.resolveCollision(other.physics);

    if (!collisionOccurred || this.teamId === other.teamId) {
      return;
    }

    const thisCanAttack = this.combat.canDealBodyDamage();
    const otherCanAttack = other.combat.canDealBodyDamage();

    const thisWasAlive = this.isAlive();
    const otherWasAlive = other.isAlive();

    let thisDamage = 0;
    let otherDamage = 0;

    if (thisCanAttack && otherWasAlive) {
      thisDamage = this.combat.calculateDamage(
        this.combat.bodyAttackDamage,
        DamageType.PHYSICAL,
        other.config.stats,
      );
    }

    if (otherCanAttack && thisWasAlive) {
      otherDamage = other.combat.calculateDamage(
        other.combat.bodyAttackDamage,
        DamageType.PHYSICAL,
        this.config.stats,
      );
    }

    if (thisDamage > 0) {
      other.takeDamage(thisDamage);
      this.combat.startBodyDamageCooldown();
    }

    if (otherDamage > 0) {
      this.takeDamage(otherDamage);
      other.combat.startBodyDamageCooldown();
    }
  }

  private takeDamage(amount: number): void {
    if (!this.isAlive()) {
      return;
    }

    this.health.takeDamage(amount);
    this.updateHealthBar(); // Only updates bar visuals when damage is taken

    if (!this.isAlive()) {
      this.die();
    }
  }

  private die(): void {
    this.sprite.setVisible(false);
    this.healthBarBg.setVisible(false);
    this.healthBarFill.setVisible(false);
  }

  public isAlive(): boolean {
    return this.health.isAlive();
  }

  public getHealth(): number {
    return this.health.getCurrentHealth();
  }

  public getMaxHealth(): number {
    return this.health.getMaxHealth();
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
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
  }
}