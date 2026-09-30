import type { MeleeAttack } from "../units/MeleeAttack";
import type { CombatUnit } from "../units/CombatRules";
import { isWithinRangedRange } from "../units/CombatRules";
import type { RangedAttack } from "../units/RangedAttack";
import type { Physics } from "../units/Physics";

const MAX_SIMULATION_DELTA_SECONDS = 1 / 30;

/** Minimal runtime interface shared by Phaser and headless units. */
export interface SimulationUnit<T extends SimulationUnit<T>> extends CombatUnit {
  readonly physics: Physics;
  readonly meleeAttack: MeleeAttack | null;
  readonly rangedAttack: RangedAttack | null;
  readonly ai: {
    getCombatTarget(): T | null;
  };

  isAlive(): boolean;
  update(deltaSeconds: number, units: readonly T[]): void;
  performMeleeAttack(target: T): boolean;
}

/** Shared projectile interface used by live rendering and headless testing. */
export interface SimulationProjectile<T extends SimulationUnit<T>> {
  update(deltaSeconds: number, units: readonly T[]): boolean;
  destroy?(): void;
}

/**
 * Shared frame-by-frame battle rules. Phaser's BattleSimulation and the
 * balance simulator both use this exact class; the only injected dependency
 * is how a projectile gets rendered/created.
 */
export class BattleSimulationCore<
  T extends SimulationUnit<T>,
  P extends SimulationProjectile<T>,
> {
  private readonly createProjectile: (
    attacker: T,
    target: T,
    attack: RangedAttack,
  ) => P;

  private readonly projectiles: P[] = [];
  private readonly grid = new Map<number, number[]>();
  private readonly activeCellKeys: number[] = [];
  private interactionCellSize = 1;

  constructor(
    createProjectile: (
      attacker: T,
      target: T,
      attack: RangedAttack,
    ) => P,
  ) {
    this.createProjectile = createProjectile;
  }

  initialize(units: readonly T[]): void {
    let maxUnitDimension = 1;

    for (const unit of units) {
      maxUnitDimension = Math.max(
        maxUnitDimension,
        unit.physics.width,
        unit.physics.height,
      );
    }

    // Physical collision uses this grid. Attack range does not enlarge it.
    this.interactionCellSize = Math.max(maxUnitDimension * 2, 1);
    this.clearGrid();
    this.clearProjectiles();
  }

  step(units: readonly T[], deltaSeconds: number): void {
    const simulationDeltaSeconds = Math.min(
      deltaSeconds,
      MAX_SIMULATION_DELTA_SECONDS,
    );

    for (const unit of units) {
      unit.update(simulationDeltaSeconds, units);
    }

    this.resolveUnitCollisions(units);
    this.resolveMeleeAttacks(units);
    this.resolveRangedAttacks(units);
    this.updateProjectiles(simulationDeltaSeconds, units);
  }

  private resolveUnitCollisions(units: readonly T[]): void {
    const unitCount = units.length;

    if (unitCount <= 32) {
      for (let i = 0; i < unitCount; i++) {
        for (let j = i + 1; j < unitCount; j++) {
          if (!units[i].isAlive() || !units[j].isAlive()) continue;
          units[i].physics.resolveCollision(units[j].physics);
        }
      }
      return;
    }

    this.buildGrid(units);
    this.resolveGridInteractions(units);
  }

  private resolveGridInteractions(units: readonly T[]): void {
    const cellSize = this.interactionCellSize;

    for (let i = 0; i < units.length; i++) {
      if (!units[i].isAlive()) continue;

      const cellX = Math.floor(units[i].physics.x / cellSize);
      const cellY = Math.floor(units[i].physics.y / cellSize);

      for (let neighborX = cellX - 1; neighborX <= cellX + 1; neighborX++) {
        for (let neighborY = cellY - 1; neighborY <= cellY + 1; neighborY++) {
          const bucket = this.grid.get(
            this.getCellKey(neighborX, neighborY),
          );

          if (!bucket) continue;

          for (const j of bucket) {
            if (j <= i || !units[j].isAlive()) continue;
            units[i].physics.resolveCollision(units[j].physics);
          }
        }
      }
    }
  }

  private resolveMeleeAttacks(units: readonly T[]): void {
    for (const unit of units) {
      if (!unit.isAlive() || !unit.meleeAttack?.canAttack()) continue;

      const target = unit.ai.getCombatTarget();
      if (!target || !target.isAlive()) continue;

      unit.performMeleeAttack(target);
    }
  }

  private resolveRangedAttacks(units: readonly T[]): void {
    for (const unit of units) {
      const attack = unit.rangedAttack;

      if (!unit.isAlive() || !attack || !attack.canAttack()) continue;

      const target = unit.ai.getCombatTarget();
      if (!target || !target.isAlive()) continue;
      if (!isWithinRangedRange(unit, target)) continue;

      this.projectiles.push(
        this.createProjectile(unit, target, attack),
      );
      attack.startCooldown();
    }
  }

  private updateProjectiles(
    deltaSeconds: number,
    units: readonly T[],
  ): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].update(deltaSeconds, units)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private buildGrid(units: readonly T[]): void {
    for (const key of this.activeCellKeys) {
      const bucket = this.grid.get(key);
      if (bucket) bucket.length = 0;
    }

    this.activeCellKeys.length = 0;

    const cellSize = this.interactionCellSize;

    for (let i = 0; i < units.length; i++) {
      if (!units[i].isAlive()) continue;

      const cellX = Math.floor(units[i].physics.x / cellSize);
      const cellY = Math.floor(units[i].physics.y / cellSize);
      const key = this.getCellKey(cellX, cellY);

      let bucket = this.grid.get(key);

      if (!bucket) {
        bucket = [];
        this.grid.set(key, bucket);
        this.activeCellKeys.push(key);
      }

      bucket.push(i);
    }
  }

  private getCellKey(x: number, y: number): number {
    return ((x & 0xffff) << 16) | (y & 0xffff);
  }

  private clearGrid(): void {
    for (const key of this.activeCellKeys) {
      const bucket = this.grid.get(key);
      if (bucket) bucket.length = 0;
    }

    this.activeCellKeys.length = 0;
  }

  private clearProjectiles(): void {
    for (const projectile of this.projectiles) {
      projectile.destroy?.();
    }

    this.projectiles.length = 0;
  }
}
