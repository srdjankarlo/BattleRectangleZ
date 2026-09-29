import Phaser from "phaser";

import { Projectile } from "./Projectile";
import { Unit } from "../units/Unit";

const MAX_SIMULATION_DELTA_SECONDS = 1 / 30;

/**
 * Runs combat interactions for the active battle.
 *
 * Physics collision, AI decisions, melee attacks, ranged attacks, and
 * projectiles are kept here so Unit remains focused on its own state.
 */
export class BattleSimulation {
  public readonly projectileLayer: Phaser.GameObjects.Container;

  private readonly grid = new Map<number, number[]>();
  private readonly activeCellKeys: number[] = [];
  private readonly projectiles: Projectile[] = [];

  private interactionCellSize = 1;

  constructor(scene: Phaser.Scene) {
    this.projectileLayer = scene.add.container(0, 0);
    this.projectileLayer.setDepth(6);
  }

  initialize(units: readonly Unit[]): void {
    let maxUnitDimension = 1;

    for (const unit of units) {
      maxUnitDimension = Math.max(
        maxUnitDimension,
        unit.physics.width,
        unit.physics.height,
      );
    }

    // The grid is only for physical collision broad-phase. Ranged targeting
    // and AI use their own distance checks, so long attack ranges do not make
    // every physical query inspect huge areas.
    this.interactionCellSize = Math.max(maxUnitDimension * 2, 1);

    this.clearGrid();
    this.clearProjectiles();
  }

  step(units: readonly Unit[], deltaSeconds: number): void {
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

  private resolveUnitCollisions(units: readonly Unit[]): void {
    const unitCount = units.length;

    if (unitCount <= 32) {
      for (let i = 0; i < unitCount; i++) {
        for (let j = i + 1; j < unitCount; j++) {
          units[i].resolveCollision(units[j]);
        }
      }
      return;
    }

    this.buildGrid(units);
    this.resolveGridInteractions(units);
  }

  private resolveGridInteractions(units: readonly Unit[]): void {
    const cellSize = this.interactionCellSize;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const cellX = Math.floor(unit.physics.x / cellSize);
      const cellY = Math.floor(unit.physics.y / cellSize);

      for (let neighborX = cellX - 1; neighborX <= cellX + 1; neighborX++) {
        for (let neighborY = cellY - 1; neighborY <= cellY + 1; neighborY++) {
          const bucket = this.grid.get(this.getCellKey(neighborX, neighborY));

          if (!bucket) continue;

          for (const j of bucket) {
            if (j <= i) continue;
            units[i].resolveCollision(units[j]);
          }
        }
      }
    }
  }

  private resolveMeleeAttacks(units: readonly Unit[]): void {
    for (const unit of units) {
      // if (!unit.isAlive() || !unit.meleeAttack || !unit.meleeAttack.canAttack()) continue;
	  // if (!unit.isAlive() || !unit.meleeAttack.canAttack()) continue;
    if (!unit.isAlive()) continue;

      const target = unit.ai.getCombatTarget();
      if (!target || !target.isAlive()) continue;

      unit.performMeleeAttack(target);
    }
  }

  private resolveRangedAttacks(units: readonly Unit[]): void {
    for (const unit of units) {
      const attack = unit.rangedAttack;

      if (!unit.isAlive() || !attack || !attack.canAttack()) continue;

      const target = unit.ai.getCombatTarget();
      if (!target || !target.isAlive()) continue;

      const dx = target.physics.x - unit.physics.x;
      const dy = target.physics.y - unit.physics.y;
      const distanceSquared = dx * dx + dy * dy;
      const range = attack.range + target.physics.radius;

      if (distanceSquared > range * range) continue;

      this.projectiles.push(
        new Projectile(
          this.projectileLayer,
          unit,
          target,
          attack,
        ),
      );

      attack.startCooldown();
    }
  }

  private updateProjectiles(
    deltaSeconds: number,
    units: readonly Unit[],
  ): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].update(deltaSeconds, units)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private buildGrid(units: readonly Unit[]): void {
    for (const key of this.activeCellKeys) {
      const bucket = this.grid.get(key);
      if (bucket) bucket.length = 0;
    }

    this.activeCellKeys.length = 0;

    const cellSize = this.interactionCellSize;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const cellX = Math.floor(unit.physics.x / cellSize);
      const cellY = Math.floor(unit.physics.y / cellSize);
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
    // Signed 16-bit packing is enough for the current arena sizes.
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
      projectile.destroy();
    }

    this.projectiles.length = 0;
  }
}
