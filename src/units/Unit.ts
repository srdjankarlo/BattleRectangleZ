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
      stats.maxShield,
    );

    this.combat = new Combat(
      stats.bodyDamage,
    );

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

    if (!this.isAlive()) {
      return;
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

    const collisionOccurred =
      this.physics.resolveCollision(
        other.physics,
      );

    // Same-team units still collide physically,
    // but do not deal body damage to each other.
    if (
      !collisionOccurred ||
      this.teamId === other.teamId
    ) {
      return;
    }

    const thisCanAttack =
      this.combat.canDealBodyDamage();

    const otherCanAttack =
      other.combat.canDealBodyDamage();

    const thisWasAlive =
      this.isAlive();

    const otherWasAlive =
      other.isAlive();

    let thisDamage = 0;
    let otherDamage = 0;

    if (
      thisCanAttack &&
      otherWasAlive
    ) {
      thisDamage =
        this.combat.calculateDamage(
          this.combat.bodyAttackDamage,
          DamageType.PHYSICAL,
          other.config.stats,
        );
    }

    if (
      otherCanAttack &&
      thisWasAlive
    ) {
      otherDamage =
        other.combat.calculateDamage(
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

  private takeDamage(
    amount: number,
  ): void {
    if (!this.isAlive()) {
      return;
    }

    const result = this.health.takeDamage(
      amount,
    );

    // The health bar represents HP, not shield. Do not update it
    // when damage is fully absorbed by the shield.
    if (result.healthDamage > 0) {
      this.updateHealthBar();
    }

    if (!this.isAlive()) {
      this.die();
    }
  }

  private die(): void {
    this.sprite.setVisible(false);
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
