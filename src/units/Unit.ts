import Phaser from "phaser";

import { Movement } from "./Movement";
import { Combat } from "./Combat";
import { Health } from "./Health";
import { Physics } from "./Physics";
import type { UnitConfig } from "./UnitConfig";
import { DamageType } from "./Damage";

export class Unit {
  // --------------------------------------------------
  // VISUAL
  // --------------------------------------------------

  public readonly sprite: Phaser.GameObjects.Arc;
  public readonly healthCircle: Phaser.GameObjects.Graphics;

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

    // ----------------------------------------------
    // Systems
    // ----------------------------------------------

    this.health = new Health(stats.maxHealth, stats.maxShield);
    this.combat = new Combat(stats.bodyAttackDamage);
    this.physics = new Physics(
      x,
      y,
      stats.radius,
      arenaWidth,
      arenaHeight,
      stats.mass,
    );

    this.movement = new Movement(stats.speed, config.movementType);
    this.movement.initialize(this.physics);

    // ----------------------------------------------
    // Visual
    // ----------------------------------------------

    this.sprite = scene.add.circle(x, y, stats.radius, config.color);
    this.sprite.setDepth(10);
    this.sprite.setStrokeStyle(3, 0xffffff, 0.9);

    // ----------------------------------------------
    // Health ellipse
    // ----------------------------------------------

    this.healthCircle = scene.add.graphics();
    this.healthCircle.setDepth(11);

    this.updateHealthCircle();
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(deltaSeconds: number): void {
    // Update combat timers.
    this.combat.update(deltaSeconds);

    // Dead units do nothing.
    if (!this.isAlive()) {
      return;
    }

    // Movement decides velocity.
    this.movement.update(deltaSeconds, this.physics);

    // Physics moves the unit.
    this.physics.update(deltaSeconds);

    // Physics keeps it inside the arena.
    this.physics.handleWallCollision();

    // Move visual representation.
    this.syncSpriteToPhysics();

    // Move health ellipse.
    this.updateHealthCircle();
  }

  // --------------------------------------------------
  // COLLISION
  // --------------------------------------------------

  resolveCollision(other: Unit): void {
    if (!this.isAlive() || !other.isAlive()) {
      return;
    }

    // Physical collision
    const collisionOccurred = this.physics.resolveCollision(other.physics);

    if (!collisionOccurred) {
      return;
    }

    // Same-team units physically collide, but cannot damage each other
    if (this.teamId === other.teamId) {
      return;
    }

    // Capture attack states before damage
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

    // Apply damage
    if (thisDamage > 0) {
      other.takeDamage(thisDamage);
      this.combat.startBodyDamageCooldown();
    }

    if (otherDamage > 0) {
      this.takeDamage(otherDamage);
      other.combat.startBodyDamageCooldown();
    }
  }

  // --------------------------------------------------
  // DAMAGE
  // --------------------------------------------------

  private takeDamage(amount: number): void {
    if (!this.isAlive()) {
      return;
    }

    this.health.takeDamage(amount);
    this.updateHealthCircle();

    if (!this.isAlive()) {
      this.die();
    }
  }

  // --------------------------------------------------
  // DEATH
  // --------------------------------------------------

  private die(): void {
    this.sprite.setVisible(false);
    this.healthCircle.setVisible(false);
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
    this.sprite.setPosition(this.physics.x, this.physics.y);
  }

  // --------------------------------------------------
  // HEALTH CIRCLE
  // --------------------------------------------------

  private updateHealthCircle(): void {
    this.healthCircle.clear();

    if (!this.isAlive()) {
      return;
    }

    const centerX = this.physics.x;
    const centerY = this.physics.y;

    const circleRadius = Math.max(3, this.physics.radius - 3);

    // Background ring
    this.healthCircle.lineStyle(4, 0x111111, 0.9);
    this.drawHealthCircle(centerX, centerY, circleRadius, 0, Math.PI * 2);

    // Health ring
    const healthRatio = this.getHealthRatio();
    const color = this.getHealthColor(healthRatio);
    const endAngle = -Math.PI / 2 + Math.PI * 2 * healthRatio;

    this.healthCircle.lineStyle(5, color, 1);
    this.drawHealthCircle(centerX, centerY, circleRadius, -Math.PI / 2, endAngle);
  }

  private getHealthColor(healthRatio: number): number {
    const ratio = Phaser.Math.Clamp(healthRatio, 0, 1);

    const colorStops = [
      { ratio: 1.0, r: 34, g: 197, b: 94 },
      { ratio: 0.75, r: 132, g: 204, b: 22 },
      { ratio: 0.5, r: 250, g: 204, b: 21 },
      { ratio: 0.25, r: 249, g: 115, b: 22 },
      { ratio: 0.0, r: 239, g: 68, b: 68 },
    ];

    for (let i = 0; i < colorStops.length - 1; i++) {
      const upper = colorStops[i];
      const lower = colorStops[i + 1];

      if (ratio <= upper.ratio && ratio >= lower.ratio) {
        const range = upper.ratio - lower.ratio;
        const progress = range === 0 ? 0 : (upper.ratio - ratio) / range;

        const r = Math.round(Phaser.Math.Linear(upper.r, lower.r, progress));
        const g = Math.round(Phaser.Math.Linear(upper.g, lower.g, progress));
        const b = Math.round(Phaser.Math.Linear(upper.b, lower.b, progress));

        return (r << 16) | (g << 8) | b;
      }
    }

    return 0xef4444;
  }

  private drawHealthCircle(
    centerX: number,
    centerY: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void {
    this.healthCircle.beginPath();
    const steps = 60;

    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const angle = startAngle + (endAngle - startAngle) * progress;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      if (i === 0) {
        this.healthCircle.moveTo(x, y);
      } else {
        this.healthCircle.lineTo(x, y);
      }
    }

    this.healthCircle.strokePath();
  }

  // --------------------------------------------------
  // CLEANUP
  // --------------------------------------------------

  public destroy(): void {
    this.sprite.destroy();
    this.healthCircle.destroy();
  }
}