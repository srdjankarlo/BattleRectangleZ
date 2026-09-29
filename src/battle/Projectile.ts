import Phaser from "phaser";

import { DamageType } from "../units/Damage";
import type { Unit } from "../units/Unit";

const PHYSICAL_PROJECTILE_COLOR = 0xff9f1c;
const MAGIC_PROJECTILE_COLOR = 0xa78bfa;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_STROKE_COLOR = 0x111111;
const PROJECTILE_STROKE_WIDTH = 1;
const TARGET_HIT_PADDING = 2;

/**
 * A lightweight projectile that travels toward the target's current position.
 *
 * Projectiles are short-lived GameObjects, so the simulation owns their list
 * and removes them immediately after they hit or lose their target.
 */
export class Projectile {
  private readonly sprite: Phaser.GameObjects.Arc;
  private readonly attacker: Unit;
  private readonly target: Unit;
  private readonly speed: number;
  private readonly damage: number;
  private readonly damageType: DamageType;

  constructor(
    layer: Phaser.GameObjects.Container,
    attacker: Unit,
    target: Unit,
    damage: number,
    speed: number,
    damageType: DamageType,
  ) {
    this.attacker = attacker;
    this.target = target;
    this.speed = speed;
    this.damage = damage;
    this.damageType = damageType;

    const projectileColor =
      damageType === DamageType.MAGIC
        ? MAGIC_PROJECTILE_COLOR
        : PHYSICAL_PROJECTILE_COLOR;

    this.sprite = layer.scene.add.circle(
      attacker.physics.x,
      attacker.physics.y,
      PROJECTILE_RADIUS,
      projectileColor,
    );

    this.sprite
      .setStrokeStyle(
        PROJECTILE_STROKE_WIDTH,
        PROJECTILE_STROKE_COLOR,
        0.9,
      )
      .setDepth(7);

    layer.add(this.sprite);
  }

  /**
   * Advances the projectile. Returns false when it should be removed.
   */
  update(deltaSeconds: number): boolean {
    if (!this.target.isAlive()) {
      this.destroy();
      return false;
    }

    const targetX = this.target.physics.x;
    const targetY = this.target.physics.y;

    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const distanceSquared = dx * dx + dy * dy;
    const hitDistance =
      this.target.physics.radius + PROJECTILE_RADIUS + TARGET_HIT_PADDING;
    const hitDistanceSquared = hitDistance * hitDistance;

    if (distanceSquared <= hitDistanceSquared) {
      this.target.receiveDamage(
        this.damage,
        this.damageType,
        this.attacker,
      );
      this.destroy();
      return false;
    }

    const distance = Math.sqrt(distanceSquared);
    const travelDistance = this.speed * deltaSeconds;

    if (travelDistance >= distance) {
      this.target.receiveDamage(
        this.damage,
        this.damageType,
        this.attacker,
      );
      this.destroy();
      return false;
    }

    const movementRatio = travelDistance / distance;

    this.sprite.x += dx * movementRatio;
    this.sprite.y += dy * movementRatio;

    return true;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
