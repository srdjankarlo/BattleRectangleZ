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

// Re-export MovementType so existing imports can still
// use:
//
// import { MovementType } from "./units/Unit";
export {
  MovementType,
} from "./Movement";

export class Unit {
  // --------------------------------------------------
  // Visual
  // --------------------------------------------------

  public readonly sprite:
    Phaser.GameObjects.Arc;

  private readonly healthEllipse:
    Phaser.GameObjects.Graphics;

  // --------------------------------------------------
  // Configuration
  // --------------------------------------------------

  public readonly config:
    Readonly<UnitConfig>;

  public readonly name: string;

  // --------------------------------------------------
  // Game systems
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
    // Store the configuration.
    this.config = config;

    this.name = config.name;

    // ----------------------------------------------
    // Create systems
    // ----------------------------------------------

    this.health =
      new Health(
        config.maxHealth,
      );

    this.combat =
      new Combat(
        config.bodyAttackDamage,
      );

    this.physics =
      new Physics(
        x,
        y,
        config.radius,
        arenaWidth,
        arenaHeight,
        config.mass ?? 1,
      );

    this.movement =
      new Movement(
        config.speed,
        config.movementType,
      );

    // Give Physics its initial velocity.
    this.movement.initialize(
      this.physics,
    );

    // ----------------------------------------------
    // Create visual object
    // ----------------------------------------------

    this.sprite =
      scene.add.circle(
        x,
        y,
        config.radius,
        config.color,
      );

    // ----------------------------------------------
    // Create health ellipse
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

    // Dead units don't move.
    if (!this.isAlive()) {
      return;
    }

    // Movement calculates how the unit should move.
    this.movement.update(
      deltaSeconds,
      this.physics,
    );

    // Physics actually moves the unit.
    this.physics.update(
      deltaSeconds,
    );

    // Keep unit inside arena.
    this.physics.handleWallCollision();

    // Copy physics position to Phaser object.
    this.syncSpriteToPhysics();

    // Update health ellipse position.
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
    // Physics
    // ----------------------------------------------

    const collisionOccurred =
      this.physics.resolveCollision(
        other.physics,
      );

    if (!collisionOccurred) {
      return;
    }

    // ----------------------------------------------
    // Capture BOTH attack states before applying
    // either attack.
    //
    // This is important because both units should
    // be able to kill each other in the same collision.
    // ----------------------------------------------

    const thisCanAttack =
      this.combat.canDealBodyDamage();

    const otherCanAttack =
      other.combat.canDealBodyDamage();

    const otherWasAlive =
      other.isAlive();

    const thisWasAlive =
      this.isAlive();

    // ----------------------------------------------
    // THIS -> OTHER
    // ----------------------------------------------

    if (
      thisCanAttack &&
      otherWasAlive
    ) {
      other.takeDamage(
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
      this.takeDamage(
        other.combat.bodyAttackDamage,
      );

      other.combat
        .startBodyDamageCooldown();
    }
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

    this.health.takeDamage(
      amount,
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
  // POSITION
  // --------------------------------------------------

  private syncSpriteToPhysics(): void {
    this.sprite.setPosition(
      this.physics.x,
      this.physics.y,
    );
  }

  // --------------------------------------------------
  // HEALTH
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

    // Background ellipse.
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

    // Current health.
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