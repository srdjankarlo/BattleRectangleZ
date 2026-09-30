import Phaser from "phaser";

import { Unit } from "../units/Unit";
import { BattleSimulationCore } from "./BattleSimulationCore";
import { Projectile } from "./Projectile";

/**
 * Phaser-facing wrapper around the shared battle simulation core. The core
 * contains all gameplay steps; this class only provides the projectile layer.
 */
export class BattleSimulation {
  public readonly projectileLayer: Phaser.GameObjects.Container;

  private readonly core: BattleSimulationCore<Unit, Projectile>;

  constructor(scene: Phaser.Scene) {
    this.projectileLayer = scene.add.container(0, 0);
    this.projectileLayer.setDepth(6);

    this.core = new BattleSimulationCore<Unit, Projectile>(
      (attacker, target, attack) =>
        new Projectile(
          this.projectileLayer,
          attacker,
          target,
          attack,
        ),
    );
  }

  initialize(units: readonly Unit[]): void {
    this.core.initialize(units);
  }

  step(units: readonly Unit[], deltaSeconds: number): void {
    this.core.step(units, deltaSeconds);
  }
}
