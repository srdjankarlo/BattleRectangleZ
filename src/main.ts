import Phaser from "phaser";

/**
 * Main game scene.
 *
 * A Phaser Scene is basically one "screen" or section of our game.
 * For now, BattleBall'z has only one scene: the arena.
 */
class BattleBallzScene extends Phaser.Scene {
    constructor() {
        super("BattleBallzScene");
    }

    create() {
        // Draw a simple 500x500 arena.
        this.add.rectangle(
            250,
            250,
            500,
            500,
            0x222222
        );

        // Add the first BattleBall'z unit.
        this.add.circle(
            250,
            250,
            20,
            0x3498db
        );
    }
}

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,

    width: 500,
    height: 500,

    backgroundColor: "#111111",

    scene: BattleBallzScene,
};

new Phaser.Game(config);