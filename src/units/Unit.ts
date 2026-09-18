import Phaser from "phaser";

import {
  Movement,
  MovementType,
} from "./Movement";

import { Combat } from "./Combat";
import { Health } from "./Health";
import { Physics } from "./Physics";

// Re-export MovementType so main.ts can keep importing it
// from Unit.ts for now.
export {
  MovementType,
} from "./Movement";

export class Unit {
  // --------------------------------------------------
  // Visual
  // --------------------------------------------------

  public readonly sprite: Phaser.GameObjects.Arc;

  private readonly healthEllipse:
    Phaser.GameObjects.Graphics;

  // --------------------------------------------------
  // Game systems
  // --------------------------------------------------

  public readonly movement: Movement;
  public readonly combat: Combat;
  public readonly health: Health;
  public readonly physics: Physics;

  // --------------------------------------------------
  // Basic information
  // --------------------------------------------------

  public readonly name: string;

  constructor(
    scene: Phaser.Scene,
    name: string,
    x: number,
    y: number,
    radius: number,
    speed: number,
    maxHealth: number,
    bodyAttackDamage: number,
    movementType: MovementType,
    color: number,
    arenaWidth: number,
    arenaHeight: number,
  ) {
    this.name = name;

    // ----------------------------------------------
    // Create systems
    // ----------------------------------------------

    this.health =
      new Health(maxHealth);

    this.combat =
      new Combat(bodyAttackDamage);

    this.physics =
      new Physics(
        x,
        y,
        radius,
        arenaWidth,
        arenaHeight,
      );

    this.movement =
      new Movement(
        speed,
        movementType,
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
        radius,
        color,
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

  update(deltaSeconds: number): void {
    // Combat cooldown needs updating even though it
    // is not directly related to movement.
    this.combat.update(
      deltaSeconds,
    );

    // Dead units don't move.
    if (!this.isAlive()) {
      return;
    }

    // Movement decides how the unit should move.
    this.movement.update(
      deltaSeconds,
      this.physics,
    );

    // Physics applies the movement.
    this.physics.update(
      deltaSeconds,
    );

    // Physics handles arena boundaries.
    this.physics.handleWallCollision();

    // Copy the physics position to the
    // visible Phaser object.
    this.syncSpriteToPhysics();

    // Keep health ellipse around unit.
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

    // First solve the physical collision.
    const collisionOccurred =
      this.physics.resolveCollision(
        other.physics,
      );

    if (!collisionOccurred) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * Capture both attack states BEFORE dealing
     * any damage.
     *
     * This fixes the bug where the first unit to
     * kill the other prevented the dead unit from
     * dealing its own final attack.
     */
    const thisCanAttack =
      this.combat.canDealBodyDamage();

    const otherCanAttack =
      other.combat.canDealBodyDamage();

    const thisTargetWasAlive =
      other.isAlive();

    const otherTargetWasAlive =
      this.isAlive();

    // ----------------------------------------------
    // Apply THIS unit's damage.
    // ----------------------------------------------

    if (
      thisCanAttack &&
      thisTargetWasAlive
    ) {
      other.takeDamage(
        this.combat.bodyAttackDamage,
      );

      this.combat
        .startBodyDamageCooldown();
    }

    // ----------------------------------------------
    // Apply OTHER unit's damage.
    // ----------------------------------------------

    if (
      otherCanAttack &&
      otherTargetWasAlive
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
    // Hide immediately.
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

    // ----------------------------------------------
    // Background ellipse
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
    // Current health
    // ----------------------------------------------

    const healthRatio =
      this.getHealthRatio();

    const healthEndAngle =
      -Math.PI / 2 +
      Math.PI * 2 *
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
        ) * progress;

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