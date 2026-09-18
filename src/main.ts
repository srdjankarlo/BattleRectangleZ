import Phaser from "phaser";
import { MovementType, Unit } from "./units/Unit";

/**
 * Main game scene.
 *
 * A Phaser Scene is basically one "screen" or section of our game.
 * For now, BattleBall'z has only one scene: the arena.
 */
class BattleBallzScene extends Phaser.Scene {
  private player!: Unit;
  private enemy!: Unit;

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
        250,
        250,
        500,
        500
      )
      .setStrokeStyle(20, 0x4d0feb);

    // Create our first unit.
    this.player = new Unit(
      this,
      this.arenaWidth / 2,
      this.arenaHeight / 2,
      20,                     // radius
      450,                    // speed
      MovementType.BOUNCE,
      0x30A63B,               // color
      this.arenaWidth,
      this.arenaHeight,
    );

    console.log("Ball created:", this.player);

    // Enemy.
    this.enemy = new Unit(
      this,
      400,
      250,
      20,
      100,
      MovementType.BOUNCE,
      0xBA2A25,
      this.arenaWidth,
      this.arenaHeight,
    );
  }

  update(_time: number, delta: number) {
    // delta is the amount of time since the previous frame,
    // measured in milliseconds.
    // Convert it to seconds because our velocity is expressed
    // in pixels per second.
    const deltaSeconds = delta / 1000;

    this.player.update(deltaSeconds);
    this.enemy.update(deltaSeconds);

    // Check whether they collide.
    this.player.resolveCollision(this.enemy);
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