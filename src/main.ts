import Phaser from "phaser";
import { MovementType, Unit } from "./units/Unit";

/**
 * Main game scene.
 *
 * A Phaser Scene is basically one "screen" or section of our game.
 * For now, BattleBall'z has only one scene: the arena.
 */
class BattleBallzScene extends Phaser.Scene {
  private units: Unit[] = [];

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
      .setStrokeStyle(6, 0x4d0feb);

    // ----------------------------------------------
    // Movement type labels
    // ----------------------------------------------

    this.add.text(
      10,
      10,
      "RED = BOUNCE",
      {
        fontSize: "16px",
      },
    );

    this.add.text(
      10,
      30,
      "BLUE = WANDER",
      {
        fontSize: "16px",
      },
    );

    this.add.text(
      10,
      50,
      "GREEN = JITTER",
      {
        fontSize: "16px",
      },
    );

    // ----------------------------------------------
    // Units
    // ----------------------------------------------

    const redUnit = new Unit(
      this,
      100,
      250,
      20,
      100,
      MovementType.BOUNCE,
      0xff0000,
      this.arenaWidth,
      this.arenaHeight,
    );

    const blueUnit = new Unit(
      this,
      250,
      150,
      20,
      100,
      MovementType.WANDER,
      0x3498db,
      this.arenaWidth,
      this.arenaHeight,
    );

    const greenUnit = new Unit(
      this,
      400,
      350,
      20,
      100,
      MovementType.JITTER,
      0x00ff66,
      this.arenaWidth,
      this.arenaHeight,
    );

    this.units.push(
      redUnit,
      blueUnit,
      greenUnit,
    );
  }

  update(_time: number, delta: number) {
    // delta is the amount of time since the previous frame,
    // measured in milliseconds.
    // Convert it to seconds because our velocity is expressed
    // in pixels per second.
    const deltaSeconds = delta / 1000;

    // ----------------------------------------------
    // Update movement
    // ----------------------------------------------

    for (const unit of this.units) {
      unit.update(deltaSeconds);
    }

    // ----------------------------------------------
    // Check every pair of units for collision
    // ----------------------------------------------

    for (
      let i = 0;
      i < this.units.length;
      i++
    ) {
      for (
        let j = i + 1;
        j < this.units.length;
        j++
      ) {
        this.units[i].resolveCollision(
          this.units[j],
        );
      }
    }
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 500,
  height: 500,

  backgroundColor: "#000000",

  scene: BattleBallzScene,
};

new Phaser.Game(config);