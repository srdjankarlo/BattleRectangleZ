import { Unit } from "../units/Unit";

const MAX_SIMULATION_DELTA_SECONDS = 1 / 30;

/**
 * Runs the simulation step for the active battle.
 *
 * The scene owns the units. This class only owns the simulation rules:
 * unit updates + unit collision broad phase + collision resolution.
 */
export class BattleSimulation {
  private readonly grid = new Map<number, number[]>();
  private readonly activeCellKeys: number[] = [];

  private collisionCellSize = 1;

  /**
   * Call once after units are created. Unit dimensions are static during
   * a battle, so the broad-phase cell size does not need recalculating
   * every frame.
   */
  initialize(units: readonly Unit[]): void {
    let maxUnitDimension = 1;

    for (const unit of units) {
      maxUnitDimension = Math.max(
        maxUnitDimension,
        unit.physics.width,
        unit.physics.height,
      );
    }

    // Two colliding rectangles can have centers at most one max dimension
    // apart. Using 2x that value keeps colliding units in the same or an
    // immediately neighboring cell.
    this.collisionCellSize = maxUnitDimension * 2;

    this.clearGrid();
  }

  step(
    units: readonly Unit[],
    deltaSeconds: number,
  ): void {
    // Cap the simulation time step. A dropped frame should not make
    // units visibly jump forward when the phone catches up.
    const simulationDeltaSeconds = Math.min(
      deltaSeconds,
      MAX_SIMULATION_DELTA_SECONDS,
    );

    for (const unit of units) {
      unit.update(simulationDeltaSeconds);
    }

    this.resolveUnitCollisions(units);
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

    const cellSize = this.collisionCellSize;

    // Each unit checks its own cell and the eight neighboring cells.
    // Pair indices enforce i < j, so no Set/string allocation is needed
    // to deduplicate pairs.
    for (let i = 0; i < unitCount; i++) {
      const unit = units[i];
      const cellX = Math.floor(unit.physics.x / cellSize);
      const cellY = Math.floor(unit.physics.y / cellSize);

      for (let neighborX = cellX - 1; neighborX <= cellX + 1; neighborX++) {
        for (
          let neighborY = cellY - 1;
          neighborY <= cellY + 1;
          neighborY++
        ) {
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

    const cellSize = this.collisionCellSize;

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

      // An existing bucket may come from an older frame and be empty.
      // Register every bucket that is populated this frame so it is
      // cleared before the next frame.
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

  private getCellKey(
    cellX: number,
    cellY: number,
  ): number {
    // Coordinates are inside the arena and normally non-negative.
    // The multiplier leaves plenty of room for future arena sizes.
    return cellX * 65536 + cellY;
  }
}
