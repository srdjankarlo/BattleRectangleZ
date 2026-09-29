import Phaser from "phaser";

import { DamageType } from "../units/Damage";
import type { RangedAttack } from "../units/RangedAttack";
import type { Unit } from "../units/Unit";

const PHYSICAL_PROJECTILE_COLOR = 0xff9f1c;
const MAGIC_PROJECTILE_COLOR = 0xa78bfa;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_STROKE_COLOR = 0x111111;
const PROJECTILE_STROKE_WIDTH = 1;
const TARGET_HIT_PADDING = 2;
const MAX_PROJECTILE_LIFETIME = 8;

/**
 * A projectile can either follow its target or continue along the firing
 * direction. Straight projectiles can hit any enemy that crosses their path.
 */
export class Projectile {
  private readonly sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private readonly attacker: Unit;
  private readonly target: Unit;
  private readonly speed: number;
  private readonly damage: number;
  private readonly damageType: DamageType;
  private readonly behavior: "homing" | "straight";
  private readonly directionX: number;
  private readonly directionY: number;
  private readonly maxTravelDistance: number;

  private traveledDistance = 0;
  private lifetime = 0;

  constructor(
    layer: Phaser.GameObjects.Container,
    attacker: Unit,
    target: Unit,
    attack: RangedAttack,
  ) {
    this.attacker = attacker;
    this.target = target;
    this.speed = attack.projectileSpeed;
    this.damage = attack.damage;
    this.damageType = attack.damageType;
    this.behavior = attack.projectileBehavior;
    this.maxTravelDistance = attack.range + attacker.physics.radius + target.physics.radius;

    const dx = target.physics.x - attacker.physics.x;
    const dy = target.physics.y - attacker.physics.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    this.directionX = dx / distance;
    this.directionY = dy / distance;

    if (attack.projectileSprite) {
      const image = layer.scene.add.image(
        attacker.physics.x,
        attacker.physics.y,
        attack.projectileSprite,
      );
      image.setDisplaySize(18, 18).setDepth(7);
      this.sprite = image;
    } else {
      const projectileColor =
        attack.damageType === DamageType.MAGIC
          ? MAGIC_PROJECTILE_COLOR
          : PHYSICAL_PROJECTILE_COLOR;

      const circle = layer.scene.add.circle(
        attacker.physics.x,
        attacker.physics.y,
        PROJECTILE_RADIUS,
        projectileColor,
      );
      circle
        .setStrokeStyle(PROJECTILE_STROKE_WIDTH, PROJECTILE_STROKE_COLOR, 0.9)
        .setDepth(7);
      this.sprite = circle;
    }

    layer.add(this.sprite);
  }

  /**
   * Advances the projectile. Returns false when it should be removed.
   */
  update(deltaSeconds: number, units: readonly Unit[]): boolean {
    if (!this.attacker.isAlive()) {
      this.destroy();
      return false;
    }

    if (this.behavior === "homing") {
      if (!this.target.isAlive() || this.target.teamId === this.attacker.teamId) {
        this.destroy();
        return false;
      }

      return this.updateHoming(deltaSeconds);
    }

    return this.updateStraight(deltaSeconds, units);
  }

  private updateHoming(deltaSeconds: number): boolean {
    const targetX = this.target.physics.x;
    const targetY = this.target.physics.y;
    const dx = targetX - this.sprite.x;
    const dy = targetY - this.sprite.y;
    const distanceSquared = dx * dx + dy * dy;
    const hitDistance =
      this.target.physics.radius + PROJECTILE_RADIUS + TARGET_HIT_PADDING;

    if (distanceSquared <= hitDistance * hitDistance) {
      this.applyDamage(this.target);
      return false;
    }

    const distance = Math.sqrt(distanceSquared);
    const travelDistance = this.speed * deltaSeconds;

    if (travelDistance >= distance) {
      this.applyDamage(this.target);
      return false;
    }

    this.sprite.x += (dx / distance) * travelDistance;
    this.sprite.y += (dy / distance) * travelDistance;
    this.traveledDistance += travelDistance;
    this.lifetime += deltaSeconds;

    if (this.traveledDistance >= this.maxTravelDistance || this.lifetime >= MAX_PROJECTILE_LIFETIME) {
      this.destroy();
      return false;
    }

    return true;
  }

  private updateStraight(deltaSeconds: number, units: readonly Unit[]): boolean {
    const travelDistance = this.speed * deltaSeconds;
    const previousX = this.sprite.x;
    const previousY = this.sprite.y;
    const nextX = previousX + this.directionX * travelDistance;
    const nextY = previousY + this.directionY * travelDistance;

    for (const candidate of units) {
      if (
        candidate === this.attacker ||
        candidate.teamId === this.attacker.teamId ||
        !candidate.isAlive()
      ) {
        continue;
      }

      const hitRadius = candidate.physics.radius + PROJECTILE_RADIUS + TARGET_HIT_PADDING;
      if (this.segmentHitsCircle(previousX, previousY, nextX, nextY, candidate.physics.x, candidate.physics.y, hitRadius)) {
        this.applyDamage(candidate);
        return false;
      }
    }

    this.sprite.x = nextX;
    this.sprite.y = nextY;
    this.traveledDistance += travelDistance;
    this.lifetime += deltaSeconds;

    if (this.traveledDistance >= this.maxTravelDistance || this.lifetime >= MAX_PROJECTILE_LIFETIME) {
      this.destroy();
      return false;
    }

    return true;
  }

  private segmentHitsCircle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    centerX: number,
    centerY: number,
    radius: number,
  ): boolean {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;

    if (lengthSquared <= 0) {
      const dx = centerX - startX;
      const dy = centerY - startY;
      return dx * dx + dy * dy <= radius * radius;
    }

    const projection = Phaser.Math.Clamp(
      ((centerX - startX) * segmentX + (centerY - startY) * segmentY) / lengthSquared,
      0,
      1,
    );

    const closestX = startX + segmentX * projection;
    const closestY = startY + segmentY * projection;
    const dx = centerX - closestX;
    const dy = centerY - closestY;

    return dx * dx + dy * dy <= radius * radius;
  }

  private applyDamage(target: Unit): void {
    if (target.isAlive()) {
      target.receiveDamage(this.damage, this.damageType, this.attacker);
    }

    this.destroy();
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
