import Phaser from "phaser";

/**
 * Main game scene.
 *
 * A Phaser Scene is basically one "screen" or section of our game.
 * For now, BattleBall'z has only one scene: the arena.
 */
class BattleBallzScene extends Phaser.Scene {
  private ball!: Phaser.GameObjects.Arc;

  // Ball movement.
  private velocityX = 150;
  private velocityY = 100;

  // Arena dimensions.
  private readonly arenaWidth = 500;
  private readonly arenaHeight = 500;

  // Ball radius.
  private readonly ballRadius = 20;

  constructor() {
    super("BattleBallzScene");
  }

  create() {
    console.log("BattleBallz scene created");

    // Draw a simple 500x500 arena.
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

    // Add the first BattleBall'z unit.
    this.ball = this.add.circle(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
      this.ballRadius,
      0xff0000
    );

    console.log("Ball created:", this.ball);
  }

  update(_time: number, delta: number) {
    // delta is the amount of time since the previous frame,
    // measured in milliseconds.
    //
    // Convert it to seconds because our velocity is expressed
    // in pixels per second.
    const deltaSeconds = delta / 1000;

    // Move the ball.
    this.ball.x += this.velocityX * deltaSeconds;
    this.ball.y += this.velocityY * deltaSeconds;

    // Left/right wall.
    if (this.ball.x - this.ballRadius <= 0) {
      this.ball.x = this.ballRadius;
      this.velocityX *= -1;
    }

    if (this.ball.x + this.ballRadius >= this.arenaWidth) {
      this.ball.x = this.arenaWidth - this.ballRadius;
      this.velocityX *= -1;
    }

    // Top/bottom wall.
    if (this.ball.y - this.ballRadius <= 0) {
      this.ball.y = this.ballRadius;
      this.velocityY *= -1;
    }

    if (this.ball.y + this.ballRadius >= this.arenaHeight) {
      this.ball.y = this.arenaHeight - this.ballRadius;
      this.velocityY *= -1;
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