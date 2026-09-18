import Phaser from "phaser";
import { MovementType, Unit } from "./units/Unit";

interface UnitStatusRow {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  background: Phaser.GameObjects.Rectangle;
  fill: Phaser.GameObjects.Rectangle;
}

/**
 * Main game scene.
 *
 * A Phaser Scene is basically one "screen" or section of our game.
 * For now, BattleBall'z has only one scene: the arena.
 */
class BattleBallzScene extends Phaser.Scene {
  private units: Unit[] = [];

  private statusRows =
    new Map<Unit, UnitStatusRow>();

  // Arena dimensions.
  private readonly arenaWidth = 500;
  private readonly arenaHeight = 500;

  constructor() {
    super("BattleBallzScene");
  }

  create() {
    console.log("BattleBallz scene created");

    // Draw a simple 500x500 arena background.
    this.add.rectangle(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
      this.arenaWidth,
      this.arenaHeight,
      0x333333
    );

    // Arena border.
    this.add.rectangle(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
      this.arenaWidth,
      this.arenaHeight,
    )
    .setStrokeStyle(20, 0x4d0feb);

    // Title
    // ----------------------------------------------
    this.add.text(
      this.arenaWidth / 2 - 80,
      510,
      "BATTLE STATUS",
      {
        fontSize: "18px",
        color: "#ffffff",
      },
    );

    // Units
    // ----------------------------------------------
    // const redUnit = new Unit(
    //   this,
    //   "RedBounce",
    //   100,
    //   250,
    //   20,
    //   300,
    //   100,
    //   10,
    //   MovementType.BOUNCE,
    //   0xff0000,
    //   this.arenaWidth,
    //   this.arenaHeight,
    // );

    const blueUnit = new Unit(
      this,
      "BlueWander",
      250,
      150,
      20,
      300,
      100,
      10,
      MovementType.WANDER,
      0x3498db,
      this.arenaWidth,
      this.arenaHeight,
    );

    const greenUnit = new Unit(
      this,
      "GreenJitter",
      400,
      350,
      20,
      300,
      100,
      10,
      MovementType.JITTER,
      0x00ff66,
      this.arenaWidth,
      this.arenaHeight,
    );

    this.units.push(
      // redUnit,
      blueUnit,
      greenUnit,
    );

    // Create a status row for each unit.
    for (const unit of this.units) {
      this.createStatusRow(unit);
    }
  }

  update(_time: number, delta: number) {
    // delta is the amount of time since the previous frame,
    // measured in milliseconds.
    // Convert it to seconds because our velocity is expressed
    // in pixels per second.
    const deltaSeconds = delta / 1000;

    // Update movement
    // ----------------------------------------------
    for (const unit of this.units) {
      unit.update(deltaSeconds);
    }

    // Check every pair of units for collision
    // ----------------------------------------------
    for (let i = 0; i < this.units.length; i++) {
      for (let j = i + 1; j < this.units.length; j++) {
        this.units[i].resolveCollision(
          this.units[j],
        );
      }
    }

    // Update status UI
    // ----------------------------------------------
    for (const unit of this.units) {
      this.updateStatusRow(unit);
    }

    // Remove dead units
    // ----------------------------------------------
    this.removeDeadUnits();
  }

  // STATUS PANEL
  // --------------------------------------------------
  private createStatusRow(unit: Unit): void {
    const rowIndex =
      this.statusRows.size;

    const y =
      540 + rowIndex * 30;

    const container =
      this.add.container(10, y);

    const label =
      this.add.text(
        0,
        0,
        "",
        {
          fontSize: "14px",
          color: "#ffffff",
        },
      );

    const background =
      this.add.rectangle(
        300,
        9,
        150,
        12,
        0x222222,
      );

    background.setOrigin(0, 0.5);

    const fill =
      this.add.rectangle(
        300,
        9,
        150,
        12,
        0x00ff66,
      );

    fill.setOrigin(0, 0.5);

    container.add([
      label,
      background,
      fill,
    ]);

    this.statusRows.set(
      unit,
      {
        container,
        label,
        background,
        fill,
      },
    );

    this.updateStatusRow(unit);
  }

  private updateStatusRow(unit: Unit): void {
    const row =
      this.statusRows.get(unit);

    if (!row) {
      return;
    }

    row.label.setText(
      `${unit.name}    HP: ${unit.getHealth()} / ${unit.getMaxHealth()}`,
    );

    row.fill.width =
      150 * unit.getHealthRatio();
  }

  // DEAD UNIT CLEANUP
  // --------------------------------------------------
  private removeDeadUnits(): void {
    const deadUnits =
      this.units.filter(
        (unit) => !unit.isAlive(),
      );

    if (deadUnits.length === 0) {
      return;
    }

    for (const unit of deadUnits) {
      const row =
        this.statusRows.get(unit);

      if (row) {
        row.container.destroy();
        this.statusRows.delete(unit);
      }

      unit.destroy();
    }

    this.units =
      this.units.filter(
        (unit) => unit.isAlive(),
      );
  }
}

// Phaser configuration
// --------------------------------------------------
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 500,
  // 500 arena + space underneath for status panel.
  height: 640,

  backgroundColor: "#000000",

  scene: BattleBallzScene,
};

new Phaser.Game(config);