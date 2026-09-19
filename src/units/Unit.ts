import Phaser from "phaser";

import {
  Movement,
} from "./Movement";

import {
  Combat,
} from "./Combat";

import {
  Health,
} from "./Health";

import {
  Physics,
} from "./Physics";

import type {
  UnitConfig,
} from "./UnitConfig";

import {
  DamageType,
} from "./Damage";

export class Unit {
  // --------------------------------------------------
  // VISUAL
  // --------------------------------------------------

  public readonly sprite:
    Phaser.GameObjects.Arc;

  private readonly healthEllipse:
    Phaser.GameObjects.Graphics;

  // --------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------

  public readonly config:
    Readonly<UnitConfig>;

  public readonly name: string;

  // --------------------------------------------------
  // SYSTEMS
  // --------------------------------------------------

  public readonly movement:
    Movement;

  public readonly combat:
    Combat;

  public readonly health:
    Health;

  public readonly physics:
    Physics;

  constructor(
    scene: Phaser.Scene,
    config: UnitConfig,
    x: number,
    y: number,
    arenaWidth: number,
    arenaHeight: number,
  ) {
    this.config = config;
    this.name = config.name;

    const stats =
      config.stats;

    // ----------------------------------------------
    // Systems
    // ----------------------------------------------

    this.health =
      new Health(
        stats.maxHealth,
        stats.maxShield,
      );

    this.combat =
      new Combat(
        stats.bodyAttackDamage,
      );

    this.physics =
      new Physics(
        x,
        y,
        stats.radius,
        arenaWidth,
        arenaHeight,
        stats.mass,
      );

    this.movement =
      new Movement(
        stats.speed,
        config.movementType,
      );

    this.movement.initialize(
      this.physics,
    );

    // ----------------------------------------------
    // Visual
    // ----------------------------------------------

    this.sprite =
      scene.add.circle(
        x,
        y,
        stats.radius,
        config.color,
      );

    // ----------------------------------------------
    // Health ellipse
    // ----------------------------------------------

    this.healthEllipse =
      scene.add.graphics();

    this.updateHealthEllipse();
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(
    deltaSeconds: number,
  ): void {
    // Update combat timers.
    this.combat.update(
      deltaSeconds,
    );

    // Dead units do nothing.
    if (!this.isAlive()) {
      return;
    }

    // Movement decides velocity.
    this.movement.update(
      deltaSeconds,
      this.physics,
    );

    // Physics moves the unit.
    this.physics.update(
      deltaSeconds,
    );

    // Physics keeps it inside the arena.
    this.physics.handleWallCollision();

    // Move visual representation.
    this.syncSpriteToPhysics();

    // Move health ellipse.
    this.updateHealthEllipse();
  }

  // --------------------------------------------------
  // COLLISION
  // --------------------------------------------------

  resolveCollision(
    other: Unit,
  ): void {
    if (
      !this.isAlive() ||
      !other.isAlive()
    ) {
      return;
    }

    // ----------------------------------------------
    // PHYSICAL COLLISION
    // ----------------------------------------------

    const collisionOccurred =
      this.physics.resolveCollision(
        other.physics,
      );

    if (!collisionOccurred) {
      return;
    }

    // ----------------------------------------------
    // CAPTURE BOTH ATTACK STATES FIRST
    // ----------------------------------------------

    const thisCanAttack =
      this.combat.canDealBodyDamage();

    const otherCanAttack =
      other.combat.canDealBodyDamage();

    const thisWasAlive =
      this.isAlive();

    const otherWasAlive =
      other.isAlive();

    // ----------------------------------------------
    // THIS -> OTHER
    // ----------------------------------------------

    if (
      thisCanAttack &&
      otherWasAlive
    ) {
      this.attack(
        other,
        DamageType.PHYSICAL,
        this.combat.bodyAttackDamage,
      );

      this.combat
        .startBodyDamageCooldown();
    }

    // ----------------------------------------------
    // OTHER -> THIS
    // ----------------------------------------------

    if (
      otherCanAttack &&
      thisWasAlive
    ) {
      other.attack(
        this,
        DamageType.PHYSICAL,
        other.combat.bodyAttackDamage,
      );

      other.combat
        .startBodyDamageCooldown();
    }
  }

  // --------------------------------------------------
  // ATTACK
  // --------------------------------------------------

  private attack(
    target: Unit,
    damageType: DamageType,
    rawDamage: number,
  ): void {
    if (!this.isAlive()) {
      return;
    }

    if (!target.isAlive()) {
      return;
    }

    const finalDamage =
      this.combat.calculateDamage(
        rawDamage,
        damageType,
        target.config.stats,
      );

    target.takeDamage(
      finalDamage,
    );
  }

  // --------------------------------------------------
  // DAMAGE
  // --------------------------------------------------

  private takeDamage(
    amount: number,
  ): void {
    if (!this.isAlive()) {
      return;
    }

    const result =
      this.health.takeDamage(
        amount,
      );

    console.log(
      `${this.name} took ${result.totalDamage.toFixed(1)} damage.`,
      `Shield: ${result.shieldDamage.toFixed(1)}`,
      `HP: ${result.healthDamage.toFixed(1)}`,
    );

    this.updateHealthEllipse();

    if (!this.isAlive()) {
      this.die();
    }
  }

  // --------------------------------------------------
  // DEATH
  // --------------------------------------------------

  private die(): void {
    this.sprite.setVisible(false);

    this.healthEllipse.setVisible(
      false,
    );
  }

  // --------------------------------------------------
  // STATE
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

  // --------------------------------------------------
  // POSITION
  // --------------------------------------------------

  private syncSpriteToPhysics(): void {
    this.sprite.setPosition(
      this.physics.x,
      this.physics.y,
    );
  }

  // --------------------------------------------------
  // HEALTH ELLIPSE
  // --------------------------------------------------

  private updateHealthEllipse(): void {
    this.healthEllipse.clear();

    if (!this.isAlive()) {
      return;
    }

    const centerX =
      this.physics.x;

    const centerY =
      this.physics.y;

    const radiusX =
      this.physics.radius + 8;

    const radiusY =
      this.physics.radius + 12;

    // ----------------------------------------------
    // Background
    // ----------------------------------------------

    this.healthEllipse.lineStyle(
      3,
      0x444444,
      1,
    );

    this.drawEllipse(
      centerX,
      centerY,
      radiusX,
      radiusY,
      0,
      Math.PI * 2,
    );

    // ----------------------------------------------
    // Health
    // ----------------------------------------------

    const healthRatio =
      this.getHealthRatio();

    const healthEndAngle =
      -Math.PI / 2 +
      Math.PI *
      2 *
      healthRatio;

    this.healthEllipse.lineStyle(
      4,
      0x00ff66,
      1,
    );

    this.drawEllipse(
      centerX,
      centerY,
      radiusX,
      radiusY,
      -Math.PI / 2,
      healthEndAngle,
    );
  }

  private drawEllipse(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    startAngle: number,
    endAngle: number,
  ): void {
    this.healthEllipse.beginPath();

    const steps = 60;

    for (
      let i = 0;
      i <= steps;
      i++
    ) {
      const progress =
        i / steps;

      const angle =
        startAngle +
        (
          endAngle -
          startAngle
        ) *
        progress;

      const x =
        centerX +
        Math.cos(angle) *
        radiusX;

      const y =
        centerY +
        Math.sin(angle) *
        radiusY;

      if (i === 0) {
        this.healthEllipse.moveTo(
          x,
          y,
        );
      } else {
        this.healthEllipse.lineTo(
          x,
          y,
        );
      }
    }

    this.healthEllipse.strokePath();
  }

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  public destroy(): void {
    this.sprite.destroy();
    this.healthEllipse.destroy();
  }
}