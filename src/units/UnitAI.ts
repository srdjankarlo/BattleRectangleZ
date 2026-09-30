import { AIType } from "./AIType";
import type { MeleeAttack } from "./MeleeAttack";
import type { Physics } from "./Physics";
import type { RangedAttack } from "./RangedAttack";
import type { UnitConfig } from "./UnitConfig";

const AI_UPDATE_INTERVAL = 0.15;
const SUPPORT_DISTANCE = 90;
const SUPPORT_TOO_CLOSE_DISTANCE = 55;
const SUPPORT_HEALTH_THRESHOLD = 0.85;
const NEEDS_SUPPORT_HEALTH_THRESHOLD = 0.35;
const RETURN_FROM_SUPPORT_THRESHOLD = 0.7;
const SUPPORT_RETREAT_DISTANCE = 80;
const MARKSMAN_MIN_RANGE_RATIO = 0.55;
const MARKSMAN_IDEAL_RANGE_RATIO = 0.72;
const MARKSMAN_MAX_RANGE_RATIO = 0.9;

/**
 * Minimal interface shared by live Phaser units and headless balance units.
 * No Phaser types are required, so the exact same AI can run in both places.
 */
export interface AIUnit {
  readonly config: Readonly<UnitConfig>;
  readonly teamId: number;
  readonly physics: Physics;
  readonly meleeAttack: MeleeAttack | null;
  readonly rangedAttack: RangedAttack | null;

  isAlive(): boolean;
  getHealthRatio(): number;
  getMaxHealth(): number;
}

/**
 * High-level target selection and movement behavior.
 *
 * AI decisions are throttled to 0.15 seconds. Movement itself remains
 * frame-by-frame, using the last chosen velocity between AI decisions.
 */
export class UnitAI<T extends AIUnit> {
  public readonly type: AIType;

  private readonly owner: T;
  private readonly enabled: boolean;
  private currentEnemyTarget: T | null = null;
  private movementTarget: T | null = null;
  private updateTimer = 0;
  private retreating = false;
  private movementDirectiveActive = false;
  private readonly strafeDirection: number;

  constructor(owner: T, type: AIType, enabled = true) {
    this.owner = owner;
    this.type = type;
    this.enabled = enabled;
    this.strafeDirection = owner.teamId % 2 === 0 ? 1 : -1;
  }

  update(deltaSeconds: number, units: readonly T[]): void {
    if (!this.enabled) {
      this.currentEnemyTarget = null;
      this.movementTarget = null;
      this.retreating = false;
      this.movementDirectiveActive = false;

      // AI-off units still auto-acquire the nearest enemy so their attack
      // systems can be tested without movement AI controlling the unit.
      this.updateTimer -= deltaSeconds;
      if (this.updateTimer <= 0) {
        this.updateTimer = AI_UPDATE_INTERVAL;
        this.currentEnemyTarget = this.chooseEnemy(units);
      }
      return;
    }

    this.updateTimer -= deltaSeconds;

    if (this.updateTimer > 0) {
      return;
    }

    this.updateTimer = AI_UPDATE_INTERVAL;
    this.chooseTargets(units);
    this.applyMovementIntent();
  }

  getCombatTarget(): T | null {
    if (!this.currentEnemyTarget?.isAlive()) {
      return null;
    }

    return this.currentEnemyTarget;
  }

  isRetreating(): boolean {
    return this.retreating;
  }

  controlsMovement(): boolean {
    return this.movementDirectiveActive;
  }

  private chooseTargets(units: readonly T[]): void {
    if (!this.owner.isAlive()) {
      this.clearTargets();
      return;
    }

    // Combatants that are badly hurt seek a Support first and a Tank if there
    // is no Support available. Supports and Tanks remain on their own jobs.
    if (this.type !== AIType.SUPPORT && this.type !== AIType.TANK) {
      this.updateSupportRetreatState(units);

      if (this.retreating) {
        this.movementTarget = this.findSupportOrTank(units);

        if (this.movementTarget) {
          this.currentEnemyTarget = null;
          return;
        }

        // The safety unit may have died. Resume normal combat if nobody is
        // available to retreat to.
        this.retreating = false;
      }
    }

    if (this.type === AIType.SUPPORT) {
      this.movementTarget = this.chooseAllyToSupport(units);

      if (this.movementTarget) {
        this.currentEnemyTarget = null;
      } else {
        // A Support with nobody to help participates in combat normally.
        this.currentEnemyTarget = this.chooseEnemy(units);
      }

      return;
    }

    this.currentEnemyTarget = this.chooseEnemy(units);
    this.movementTarget = this.currentEnemyTarget;
  }

  private chooseEnemy(units: readonly T[]): T | null {
    let best: T | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (
        candidate === this.owner ||
        candidate.teamId === this.owner.teamId ||
        !candidate.isAlive()
      ) {
        continue;
      }

      if (this.type === AIType.TANK) {
        const score = -this.getEstimatedDps(candidate);
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
        }
        continue;
      }

      if (this.type === AIType.ASSASSIN) {
        const score = this.getAssassinTargetScore(candidate);
        if (score < bestScore) {
          best = candidate;
          bestScore = score;
        }
        continue;
      }

      const distance = this.distanceSquared(candidate);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    }

    return best;
  }

  private chooseAllyToSupport(units: readonly T[]): T | null {
    let best: T | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (
        candidate === this.owner ||
        candidate.teamId !== this.owner.teamId ||
        !candidate.isAlive()
      ) {
        continue;
      }

      if (candidate.getHealthRatio() > SUPPORT_HEALTH_THRESHOLD) {
        continue;
      }

      const score = this.getSupportScore(candidate);
      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    return best;
  }

  private findSupportOrTank(units: readonly T[]): T | null {
    let nearestSupport: T | null = null;
    let nearestSupportDistance = Number.POSITIVE_INFINITY;
    let nearestTank: T | null = null;
    let nearestTankDistance = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (
        candidate === this.owner ||
        candidate.teamId !== this.owner.teamId ||
        !candidate.isAlive()
      ) {
        continue;
      }

      const distance = this.distanceSquared(candidate);

      if (candidate.config.aiType === AIType.SUPPORT) {
        if (distance < nearestSupportDistance) {
          nearestSupport = candidate;
          nearestSupportDistance = distance;
        }
        continue;
      }

      if (
        candidate.config.aiType === AIType.TANK &&
        distance < nearestTankDistance
      ) {
        nearestTank = candidate;
        nearestTankDistance = distance;
      }
    }

    // Support is preferred because it is the actual potential healing source.
    return nearestSupport ?? nearestTank;
  }

  private updateSupportRetreatState(units: readonly T[]): void {
    if (
      !this.retreating &&
      this.owner.getHealthRatio() <= NEEDS_SUPPORT_HEALTH_THRESHOLD
    ) {
      this.retreating = this.findSupportOrTank(units) !== null;
      return;
    }

    if (
      this.retreating &&
      this.owner.getHealthRatio() >= RETURN_FROM_SUPPORT_THRESHOLD
    ) {
      this.retreating = false;
    }
  }

  private applyMovementIntent(): void {
    this.movementDirectiveActive = true;

    if (!this.owner.isAlive()) {
      return;
    }

    if (this.type === AIType.SUPPORT) {
      if (this.movementTarget) {
        this.moveSupport();
      } else {
        this.moveToTarget(this.currentEnemyTarget, 0);
      }
      return;
    }

    if (this.retreating) {
      this.moveToTarget(this.movementTarget, SUPPORT_RETREAT_DISTANCE);
      return;
    }

    if (this.type === AIType.MARKSMAN) {
      this.moveMarksman();
      return;
    }

    this.moveToTarget(this.movementTarget, 0);
  }

  private moveMarksman(): void {
    const target = this.currentEnemyTarget;
    const attack = this.owner.rangedAttack;

    if (!target || !attack) {
      this.owner.physics.setVelocity(0, 0);
      return;
    }

    const distance = Math.sqrt(this.distanceSquared(target));
    const desiredDistance = attack.range * MARKSMAN_IDEAL_RANGE_RATIO;
    const minimumDistance = attack.range * MARKSMAN_MIN_RANGE_RATIO;
    const maximumDistance = attack.range * MARKSMAN_MAX_RANGE_RATIO;

    const dx = target.physics.x - this.owner.physics.x;
    const dy = target.physics.y - this.owner.physics.y;

    if (distance < minimumDistance) {
      this.setDirection(-dx, -dy);
      return;
    }

    if (distance > maximumDistance) {
      this.setDirection(dx, dy);
      return;
    }

    const strafeX = -dy * this.strafeDirection;
    const strafeY = dx * this.strafeDirection;

    if (Math.abs(distance - desiredDistance) > attack.range * 0.08) {
      const radialDirection = distance < desiredDistance ? -1 : 1;
      this.setDirection(
        strafeX + dx * radialDirection * 0.25,
        strafeY + dy * radialDirection * 0.25,
      );
      return;
    }

    this.setDirection(strafeX, strafeY);
  }

  private moveSupport(): void {
    const target = this.movementTarget;

    if (!target) {
      this.owner.physics.setVelocity(0, 0);
      return;
    }

    const distance = Math.sqrt(this.distanceSquared(target));

    if (distance > SUPPORT_DISTANCE) {
      this.moveToTarget(target, 0);
      return;
    }

    if (distance < SUPPORT_TOO_CLOSE_DISTANCE) {
      const dx = this.owner.physics.x - target.physics.x;
      const dy = this.owner.physics.y - target.physics.y;
      this.setDirection(dx, dy);
      return;
    }

    this.owner.physics.setVelocity(0, 0);
  }

  private moveToTarget(target: T | null, stopDistance: number): void {
    if (!target || !target.isAlive()) {
      this.owner.physics.setVelocity(0, 0);
      return;
    }

    const dx = target.physics.x - this.owner.physics.x;
    const dy = target.physics.y - this.owner.physics.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= stopDistance) {
      this.owner.physics.setVelocity(0, 0);
      return;
    }

    this.setDirection(dx, dy);
  }

  private setDirection(x: number, y: number): void {
    const length = Math.sqrt(x * x + y * y);

    if (length <= 0.0001) {
      this.owner.physics.setVelocity(0, 0);
      return;
    }

    this.owner.physics.setVelocity(
      (x / length) * this.owner.config.stats.speed,
      (y / length) * this.owner.config.stats.speed,
    );
  }

  private distanceSquared(target: T): number {
    const dx = target.physics.x - this.owner.physics.x;
    const dy = target.physics.y - this.owner.physics.y;
    return dx * dx + dy * dy;
  }

  private getEstimatedDps(unit: T): number {
    const melee = unit.meleeAttack;
    const ranged = unit.rangedAttack;

    const meleeDps = melee ? melee.damage * melee.attackSpeed : 0;
    const rangedDps = ranged ? ranged.damage * ranged.attackSpeed : 0;

    return meleeDps + rangedDps;
  }

  private getAssassinTargetScore(unit: T): number {
    return unit.getHealthRatio() * 0.7 + unit.getMaxHealth() / 10000 * 0.3;
  }

  private getSupportScore(unit: T): number {
    return unit.getHealthRatio() + unit.getMaxHealth() / 100000;
  }

  private clearTargets(): void {
    this.currentEnemyTarget = null;
    this.movementTarget = null;
    this.retreating = false;
    this.movementDirectiveActive = false;
  }
}
