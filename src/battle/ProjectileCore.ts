import { applyDamage } from "../units/CombatRules";
import type { CombatUnit } from "../units/CombatRules";
import type { RangedAttack } from "../units/RangedAttack";
import { DamageType } from "../units/Damage";

const TARGET_HIT_PADDING = 2;
const MAX_PROJECTILE_LIFETIME = 8;
const PROJECTILE_RADIUS = 4;

export interface ProjectileUnit extends CombatUnit {
  readonly teamId: number;
}

export type ProjectileBehavior = "homing" | "straight";

/**
 * Phaser-free projectile simulation. The live Phaser Projectile wraps this
 * state and adds only rendering; the balance simulator uses this class
 * directly. This keeps projectile movement/hit behavior identical.
 */
export class ProjectileCore<T extends ProjectileUnit> {
  public x: number;
  public y: number;

  private readonly attacker: T;
  private readonly target: T;
  private readonly speed: number;
  private readonly damage: number;
  private readonly damageType: DamageType;
  private readonly behavior: ProjectileBehavior;
  private readonly directionX: number;
  private readonly directionY: number;
  private readonly maxTravelDistance: number;

  private currentDirectionX: number;
  private currentDirectionY: number;
  private traveledDistance = 0;
  private lifetime = 0;

  constructor(
    attacker: T,
    target: T,
    attack: RangedAttack,
  ) {
    this.attacker = attacker;
    this.target = target;
    this.speed = attack.projectileSpeed;
    this.damage = attack.damage;
    this.damageType = attack.damageType;
    this.behavior = attack.projectileBehavior;
    this.maxTravelDistance =
      attack.range +
      attacker.physics.radius +
      target.physics.radius;

    this.x = attacker.physics.x;
    this.y = attacker.physics.y;

    const dx = target.physics.x - attacker.physics.x;
    const dy = target.physics.y - attacker.physics.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    this.directionX = dx / distance;
    this.directionY = dy / distance;
    this.currentDirectionX = this.directionX;
    this.currentDirectionY = this.directionY;
  }

  update(deltaSeconds: number, units: readonly T[]): boolean {
    if (!this.attacker.isAlive()) {
      return false;
    }

    if (this.behavior === "homing") {
      if (!this.target.isAlive() || this.target.teamId === this.attacker.teamId) {
        return false;
      }

      return this.updateHoming(deltaSeconds);
    }

    return this.updateStraight(deltaSeconds, units);
  }

  private updateHoming(deltaSeconds: number): boolean {
    const dx = this.target.physics.x - this.x;
    const dy = this.target.physics.y - this.y;
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

    this.currentDirectionX = dx / distance;
    this.currentDirectionY = dy / distance;
    this.x += this.currentDirectionX * travelDistance;
    this.y += this.currentDirectionY * travelDistance;

    return this.finishStep(travelDistance, deltaSeconds);
  }

  private updateStraight(deltaSeconds: number, units: readonly T[]): boolean {
    const travelDistance = this.speed * deltaSeconds;
    const previousX = this.x;
    const previousY = this.y;
    const nextX = previousX + this.currentDirectionX * travelDistance;
    const nextY = previousY + this.currentDirectionY * travelDistance;

    for (const candidate of units) {
      if (
        candidate === this.attacker ||
        candidate.teamId === this.attacker.teamId ||
        !candidate.isAlive()
      ) {
        continue;
      }

      const hitRadius =
        candidate.physics.radius + PROJECTILE_RADIUS + TARGET_HIT_PADDING;

      if (
        this.segmentHitsCircle(
          previousX,
          previousY,
          nextX,
          nextY,
          candidate.physics.x,
          candidate.physics.y,
          hitRadius,
        )
      ) {
        this.applyDamage(candidate);
        return false;
      }
    }

    this.x = nextX;
    this.y = nextY;
    return this.finishStep(travelDistance, deltaSeconds);
  }

  private finishStep(
    travelDistance: number,
    deltaSeconds: number,
  ): boolean {
    this.traveledDistance += travelDistance;
    this.lifetime += deltaSeconds;

    return (
      this.traveledDistance < this.maxTravelDistance &&
      this.lifetime < MAX_PROJECTILE_LIFETIME
    );
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

    const projection = Math.max(
      0,
      Math.min(
        1,
        ((centerX - startX) * segmentX +
          (centerY - startY) * segmentY) /
          lengthSquared,
      ),
    );

    const closestX = startX + segmentX * projection;
    const closestY = startY + segmentY * projection;
    const dx = centerX - closestX;
    const dy = centerY - closestY;

    return dx * dx + dy * dy <= radius * radius;
  }

  private applyDamage(target: T): void {
    if (target.isAlive()) {
      applyDamage(
        this.attacker,
        target,
        this.damage,
        this.damageType,
      );
    }
  }
}
