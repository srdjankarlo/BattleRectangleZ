import { AIType } from "./AIType";
import type { Unit } from "./Unit";

const AI_UPDATE_INTERVAL = 0.15;
const SUPPORT_DISTANCE = 90;
const SUPPORT_TOO_CLOSE_DISTANCE = 55;
const SUPPORT_HEALTH_THRESHOLD = 0.85;
const ASSASSIN_RETREAT_THRESHOLD = 0.35;
const ASSASSIN_RETURN_THRESHOLD = 0.7;
const ASSASSIN_SUPPORT_DISTANCE = 80;
const MARKSMAN_MIN_RANGE_RATIO = 0.55;
const MARKSMAN_IDEAL_RANGE_RATIO = 0.72;
const MARKSMAN_MAX_RANGE_RATIO = 0.9;

/**
 * High-level target selection and movement behavior.
 *
 * AI is intentionally updated at a lower frequency than physics. The selected
 * direction remains active between AI decisions, which keeps CPU use lower on
 * phones while movement itself stays frame-by-frame.
 */
export class UnitAI {
  public readonly type: AIType;

  private readonly owner: Unit;
  private readonly enabled: boolean;
  private currentEnemyTarget: Unit | null = null;
  private movementTarget: Unit | null = null;
  private updateTimer = 0;
  private retreating = false;
  private movementDirectiveActive = false;
  private readonly strafeDirection: number;

  constructor(owner: Unit, type: AIType, enabled = true) {
    this.owner = owner;
    this.type = type;
	  this.enabled = enabled;
    this.strafeDirection = owner.teamId % 2 === 0 ? 1 : -1;
  }

  update(deltaSeconds: number, units: readonly Unit[]): void {
	if (!this.enabled) {
      this.currentEnemyTarget = null;
      this.movementTarget = null;
      this.retreating = false;
      this.movementDirectiveActive = false;
      
      // Periodically scan for the nearest enemy target so non-AI units can auto-attack
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

  getCombatTarget(): Unit | null {
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

  private chooseTargets(units: readonly Unit[]): void {
    if (!this.owner.isAlive()) {
      this.currentEnemyTarget = null;
      this.movementTarget = null;
      this.movementDirectiveActive = false;
      return;
    }

    if (this.type === AIType.ASSASSIN) {
      this.updateAssassinRetreatState(units);

      if (this.retreating) {
        this.currentEnemyTarget = null;
        this.movementTarget = this.findHealer(units);
        return;
      }
    }

    this.currentEnemyTarget = this.chooseEnemy(units);

    if (this.type === AIType.SUPPORT || this.type === AIType.TANK) {
      this.movementTarget = this.chooseAllyToSupport(units);

      if (this.movementTarget || this.type === AIType.SUPPORT) {
        this.currentEnemyTarget = null;
      }
      return;
    }

    this.movementTarget = this.currentEnemyTarget;
  }

  private chooseEnemy(units: readonly Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (candidate === this.owner || candidate.teamId === this.owner.teamId || !candidate.isAlive()) {
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

  private chooseAllyToSupport(units: readonly Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (candidate === this.owner || candidate.teamId !== this.owner.teamId || !candidate.isAlive()) {
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

  private findHealer(units: readonly Unit[]): Unit | null {
    let best: Unit | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (candidate === this.owner || candidate.teamId !== this.owner.teamId || !candidate.isAlive() || candidate.config.aiType !== AIType.SUPPORT && candidate.config.aiType !== AIType.TANK) {
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

  private updateAssassinRetreatState(units: readonly Unit[]): void {
    if (!this.retreating && this.owner.getHealthRatio() <= ASSASSIN_RETREAT_THRESHOLD) {
      this.retreating = this.findHealer(units) !== null;
      return;
    }

    if (this.retreating && this.owner.getHealthRatio() >= ASSASSIN_RETURN_THRESHOLD) {
      this.retreating = false;
    }
  }

  private applyMovementIntent(): void {
    this.movementDirectiveActive = true;

    if (!this.owner.isAlive()) {
      return;
    }

    if (this.type === AIType.SUPPORT) {
      this.moveSupport();
      return;
    }

    if (this.type === AIType.TANK) {
      if (this.movementTarget) {
        this.moveSupport();
      } else {
        this.moveToTarget(this.currentEnemyTarget, 0);
      }
      return;
    }

    if (this.retreating) {
      this.moveToTarget(this.movementTarget, ASSASSIN_SUPPORT_DISTANCE);
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

    // Strafe while holding a safe firing distance. This prevents ranged units
    // from simply freezing when the enemy reaches their preferred range.
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

  private moveToTarget(target: Unit | null, stopDistance: number): void {
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

  private distanceSquared(target: Unit): number {
    const dx = target.physics.x - this.owner.physics.x;
    const dy = target.physics.y - this.owner.physics.y;
    return dx * dx + dy * dy;
  }

  private getEstimatedDps(unit: Unit): number {
    const melee = unit.meleeAttack;
    const ranged = unit.rangedAttack;

    const meleeDps = melee ? melee.damage * melee.attackSpeed : 0;
    const rangedDps = ranged ? ranged.damage * ranged.attackSpeed : 0;

    return meleeDps + rangedDps;
  }

  private getAssassinTargetScore(unit: Unit): number {
    return unit.getHealthRatio() * 0.7 + unit.getMaxHealth() / 10000 * 0.3;
  }

  private getSupportScore(unit: Unit): number {
    return unit.getHealthRatio() + unit.getMaxHealth() / 100000;
  }
}
