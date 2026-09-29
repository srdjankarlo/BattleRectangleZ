import Phaser from "phaser";

import { Projectile } from "./Projectile";
import { Unit } from "../units/Unit";

const MAX_SIMULATION_DELTA_SECONDS = 1 / 30;

/**
 * Runs the simulation step for the active battle.
 *
 * The scene owns the units. This class owns simulation interactions, including
 * body collisions, ranged target selection, and active projectiles.
 */
export class BattleSimulation {
  public readonly projectileLayer: Phaser.GameObjects.Container;

  private readonly grid = new Map<number, number[]>();
  private readonly activeCellKeys: number[] = [];
  private readonly projectiles: Projectile[] = [];

  private interactionCellSize = 1;

  constructor(scene: Phaser.Scene) {
    // A dedicated layer lets BattleScene register one world object with the UI
    // camera. Projectiles added later will therefore never appear in the stats UI.
    this.projectileLayer = scene.add.container(0, 0);
    this.projectileLayer.setDepth(6);
  }

  /**
   * Call once after units are created. Unit dimensions and attack ranges are
   * static during a battle, so the broad-phase cell size does not need
   * recalculating every frame.
   */
  initialize(units: readonly Unit[]): void {
    let maxUnitDimension = 1;
    let maxBodyAttackRange = 0;

    for (const unit of units) {
      maxUnitDimension = Math.max(
        maxUnitDimension,
        unit.physics.width,
        unit.physics.height,
      );

      maxBodyAttackRange = Math.max(
        maxBodyAttackRange,
        unit.combat.bodyAttackRange,
      );

    }

    // Keep this grid sized for physical interactions. Do not enlarge it for
    // ranged attacks, because a very long ranged attack would make every
    // physical-collision query inspect unnecessarily large buckets.
    this.interactionCellSize = Math.max(
      (maxUnitDimension + maxBodyAttackRange) * 2,
      1,
    );

    this.clearGrid();
    this.clearProjectiles();
  }

  step(
    units: readonly Unit[],
    deltaSeconds: number,
  ): void {
    // Cap the simulation time step. A dropped frame should not make units
    // visibly jump forward when the phone catches up.
    const simulationDeltaSeconds = Math.min(
      deltaSeconds,
      MAX_SIMULATION_DELTA_SECONDS,
    );

    for (const unit of units) {
      unit.update(simulationDeltaSeconds);
    }

    this.resolveUnitCollisions(units);
    this.resolveRangedAttacks(units);
    this.updateProjectiles(simulationDeltaSeconds);
  }

  private resolveUnitCollisions(
    units: readonly Unit[],
  ): void {
    const unitCount = units.length;

    // For small fights the direct pair loop avoids grid bookkeeping.
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

  private resolveGridInteractions(
    units: readonly Unit[],
  ): void {
    const cellSize = this.interactionCellSize;

    // Each unit checks its own cell and the eight neighboring cells.
    // Pair indices enforce i < j, so no Set/string allocation is needed
    // to deduplicate pairs.
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      const cellX = Math.floor(unit.physics.x / cellSize);
      const cellY = Math.floor(unit.physics.y / cellSize);

      for (let neighborX = cellX - 1; neighborX <= cellX + 1; neighborX++) {
        for (let neighborY = cellY - 1; neighborY <= cellY + 1; neighborY++) {
          const bucket = this.grid.get(
            this.getCellKey(neighborX, neighborY),
          );

          if (!bucket) {
            continue;
          }

          for (const j of bucket) {
            if (j <= i) {
              continue;
            }

            units[i].resolveCollision(units[j]);
          }
        }
      }
    }
  }

  private resolveRangedAttacks(
    units: readonly Unit[],
  ): void {
    for (const unit of units) {
      const attack = unit.rangedAttack;

      if (
        !unit.isAlive() ||
        !attack ||
        !attack.canAttack()
      ) {
        continue;
      }

      const target = units.length > 32
        ? this.findRangedTargetInGrid(unit, units)
        : this.findRangedTargetDirect(unit, units);

      if (!target) {
        continue;
      }

      this.projectiles.push(
        new Projectile(
          this.projectileLayer,
          unit,
          target,
          attack.damage,
          attack.projectileSpeed,
          attack.damageType,
        ),
      );

      attack.startCooldown();
    }
  }

  private findRangedTargetDirect(
    attacker: Unit,
    units: readonly Unit[],
  ): Unit | null {
    const attack = attacker.rangedAttack;

    if (!attack) {
      return null;
    }

    const maxDistanceSquared = attack.range * attack.range;
    let closestTarget: Unit | null = null;
    let closestDistanceSquared = maxDistanceSquared;

    for (const candidate of units) {
      if (
        candidate === attacker ||
        candidate.teamId === attacker.teamId ||
        !candidate.isAlive()
      ) {
        continue;
      }

      const distanceSquared = this.getDistanceSquared(
        attacker,
        candidate,
      );

      if (distanceSquared <= closestDistanceSquared) {
        closestDistanceSquared = distanceSquared;
        closestTarget = candidate;
      }
    }

    return closestTarget;
  }

  private findRangedTargetInGrid(
    attacker: Unit,
    units: readonly Unit[],
  ): Unit | null {
    const attack = attacker.rangedAttack;

    if (!attack) {
      return null;
    }

    const cellSize = this.interactionCellSize;
    const cellX = Math.floor(attacker.physics.x / cellSize);
    const cellY = Math.floor(attacker.physics.y / cellSize);
    const cellSearchRadius = Math.ceil(attack.range / cellSize);
    const maxDistanceSquared = attack.range * attack.range;

    let closestTarget: Unit | null = null;
    let closestDistanceSquared = maxDistanceSquared;

    for (let neighborX = cellX - cellSearchRadius; neighborX <= cellX + cellSearchRadius; neighborX++) {
      for (let neighborY = cellY - cellSearchRadius; neighborY <= cellY + cellSearchRadius; neighborY++) {
        const bucket = this.grid.get(
          this.getCellKey(neighborX, neighborY),
        );

        if (!bucket) {
          continue;
        }

        for (const index of bucket) {
          const candidate = units[index];

          if (
            !candidate ||
            candidate === attacker ||
            candidate.teamId === attacker.teamId ||
            !candidate.isAlive()
          ) {
            continue;
          }

          const distanceSquared = this.getDistanceSquared(
            attacker,
            candidate,
          );

          if (distanceSquared <= closestDistanceSquared) {
            closestDistanceSquared = distanceSquared;
            closestTarget = candidate;
          }
        }
      }
    }

    return closestTarget;
  }


  private updateProjectiles(deltaSeconds: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (!this.projectiles[i].update(deltaSeconds)) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  private buildGrid(units: readonly Unit[]): void {
    // Reuse bucket arrays between frames instead of allocating a new
    // Map<string, number[]> every frame.
    for (const key of this.activeCellKeys) {
      const bucket = this.grid.get(key);
      if (bucket) {
        bucket.length = 0;
      }
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
      }

      if (bucket.length === 0) {
        this.activeCellKeys.push(key);
      }

      bucket.push(i);
    }

  }

  private clearGrid(): void {
    for (const bucket of this.grid.values()) {
      bucket.length = 0;
    }

    this.activeCellKeys.length = 0;
  }

  private clearProjectiles(): void {
    for (const projectile of this.projectiles) {
      projectile.destroy();
    }

    this.projectiles.length = 0;
  }

  private getDistanceSquared(
    a: Unit,
    b: Unit,
  ): number {
    const dx = b.physics.x - a.physics.x;
    const dy = b.physics.y - a.physics.y;
    return dx * dx + dy * dy;
  }

  private getCellKey(
    cellX: number,
    cellY: number,
  ): number {
    // Coordinates are inside the arena and normally non-negative.
    // The multiplier leaves plenty of room for future arena sizes.
    return cellX * 65536 + cellY;
  }
}
