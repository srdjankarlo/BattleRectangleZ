import Phaser from "phaser";

import {
  Unit,
} from "./units/Unit";

import {
  Characters,
} from "./characters/Characters";

// --------------------------------------------------
// UI TYPES
// --------------------------------------------------

interface UnitStatusCard {
  container: Phaser.GameObjects.Container;
  panel: Phaser.GameObjects.Rectangle;
  colorIndicator: Phaser.GameObjects.Arc;
  name: Phaser.GameObjects.Text;
  stats: Phaser.GameObjects.Text;
}

// --------------------------------------------------
// GAME SCENE
// --------------------------------------------------

class BattleBallzScene extends Phaser.Scene {
  private units: Unit[] = [];

  private statusCards =
    new Map<Unit, UnitStatusCard>();

  // Pause state.
  private isPaused = false;

  private pauseStatusText!: Phaser.GameObjects.Text;
  private pauseButtonBackground!: Phaser.GameObjects.Rectangle;
  private pauseButtonText!: Phaser.GameObjects.Text;

  // Arena dimensions.
  private readonly arenaWidth = 500;
  private readonly arenaHeight = 500;

  constructor() {
    super("BattleBallzScene");
  }

  // --------------------------------------------------
  // CREATE
  // --------------------------------------------------

  create() {
    // ----------------------------------------------
    // Arena
    // ----------------------------------------------

    this.add.rectangle(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
      this.arenaWidth,
      this.arenaHeight,
      0x333333,
    );

    // Arena border.
    this.add
      .rectangle(
        this.arenaWidth / 2,
        this.arenaHeight / 2,
        this.arenaWidth,
        this.arenaHeight,
      )
      .setStrokeStyle(
        6,
        0x4d0feb,
      );

    // ----------------------------------------------
    // Battle Status title
    // ----------------------------------------------

    this.add.text(
      10,
      510,
      "BATTLE STATUS",
      {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      },
    );

    // ----------------------------------------------
    // Pause status
    // ----------------------------------------------

    this.pauseStatusText =
      this.add.text(
        10,
        535,
        "RUNNING — press P",
        {
          fontSize: "12px",
          color: "#aaaaaa",
        },
      );

    // ----------------------------------------------
    // Pause button
    // ----------------------------------------------

    this.pauseButtonBackground =
      this.add.rectangle(
        435,
        520,
        120,
        36,
        0x252525,
      );

    this.pauseButtonBackground
      .setStrokeStyle(
        2,
        0x777777,
      );

    this.pauseButtonBackground.setInteractive({
      useHandCursor: true,
    });

    this.pauseButtonText =
      this.add.text(
        435,
        520,
        "PAUSE [P]",
        {
          fontSize: "13px",
          color: "#ffffff",
          fontStyle: "bold",
        },
      );

    this.pauseButtonText.setOrigin(
      0.5,
      0.5,
    );

    this.pauseButtonBackground.on(
      "pointerdown",
      () => {
        this.togglePause();
      },
    );

    this.pauseButtonBackground.on(
      "pointerover",
      () => {
        this.pauseButtonBackground.setFillStyle(
          0x3a3a3a,
        );
      },
    );

    this.pauseButtonBackground.on(
      "pointerout",
      () => {
        this.pauseButtonBackground.setFillStyle(
          0x252525,
        );
      },
    );

    // ----------------------------------------------
    // Keyboard: P
    // ----------------------------------------------

    this.input.keyboard?.on(
      "keydown-P",
      () => {
        this.togglePause();
      },
    );

    // ----------------------------------------------
    // TEST UNITS
    // ----------------------------------------------

    const knight =
      new Unit(
        this,
        Characters.KNIGHT,
        100,
        250,
        this.arenaWidth,
        this.arenaHeight,
      );

    const goblin =
      new Unit(
        this,
        Characters.GOBLIN,
        400,
        250,
        this.arenaWidth,
        this.arenaHeight,
      );

    const wizard =
      new Unit(
        this,
        Characters.WIZARD,
        250,
        150,
        this.arenaWidth,
        this.arenaHeight,
      );

    this.units.push(
      knight,
      goblin,
      wizard,
    );

    // Create a UI card for each unit.
    for (
      let i = 0;
      i < this.units.length;
      i++
    ) {
      this.createStatusCard(
        this.units[i],
        i,
      );
    }
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(
    _time: number,
    delta: number,
  ) {
    const deltaSeconds =
      delta / 1000;

    // ----------------------------------------------
    // GAME SIMULATION
    // ----------------------------------------------

    if (!this.isPaused) {
      // Update movement/combat.
      for (const unit of this.units) {
        unit.update(
          deltaSeconds,
        );
      }

      // Check collisions.
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

      // Remove dead units.
      this.removeDeadUnits();
    }

    // ----------------------------------------------
    // UI
    // ----------------------------------------------

    for (const unit of this.units) {
      this.updateStatusCard(unit);
    }
  }

  // --------------------------------------------------
  // PAUSE
  // --------------------------------------------------

  private togglePause(): void {
    this.isPaused =
      !this.isPaused;

    if (this.isPaused) {
      this.pauseStatusText.setText(
        "PAUSED — press P to resume",
      );

      this.pauseButtonText.setText(
        "RESUME [P]",
      );
    } else {
      this.pauseStatusText.setText(
        "RUNNING — press P",
      );

      this.pauseButtonText.setText(
        "PAUSE [P]",
      );
    }
  }

  // --------------------------------------------------
  // STATUS CARD
  // --------------------------------------------------

  private createStatusCard(
    unit: Unit,
    index: number,
  ): void {
    const cardWidth = 155;
    const cardHeight = 155;

    const gap = 10;

    const x =
      10 +
      index *
        (cardWidth + gap);

    const y = 555;

    const container =
      this.add.container(
        x,
        y,
      );

    // Card background.
    const panel =
      this.add.rectangle(
        0,
        0,
        cardWidth,
        cardHeight,
        0x202020,
      );

    panel.setOrigin(
      0,
      0,
    );

    panel.setStrokeStyle(
      2,
      0x555555,
    );

    // Small color indicator.
    const colorIndicator =
      this.add.circle(
        12,
        14,
        5,
        unit.config.color,
      );

    // Unit name.
    const name =
      this.add.text(
        24,
        6,
        unit.name.toUpperCase(),
        {
          fontSize: "13px",
          color: "#ffffff",
          fontStyle: "bold",
        },
      );

    // Stats.
    const stats =
      this.add.text(
        10,
        28,
        "",
        {
          fontSize: "11px",
          color: "#dddddd",
          lineSpacing: 1,
        },
      );

    container.add([
      panel,
      colorIndicator,
      name,
      stats,
    ]);

    this.statusCards.set(
      unit,
      {
        container,
        panel,
        colorIndicator,
        name,
        stats,
      },
    );

    this.updateStatusCard(
      unit,
    );
  }

  // --------------------------------------------------
  // UPDATE STATUS CARD
  // --------------------------------------------------

  private updateStatusCard(
    unit: Unit,
  ): void {
    const card =
      this.statusCards.get(unit);

    if (!card) {
      return;
    }

    const stats =
      unit.config.stats;

    const hp =
      unit.getHealth();

    const maxHp =
      unit.getMaxHealth();

    const shield =
      unit.getShield();

    const maxShield =
      unit.getMaxShield();

    card.name.setText(
      unit.name.toUpperCase(),
    );

    card.stats.setText(
      [
        `HP       ${hp.toFixed(1)} / ${maxHp.toFixed(1)}`,
        `SHIELD   ${shield.toFixed(1)} / ${maxShield.toFixed(1)}`,
        `ARMOR    ${stats.armor}`,
        `MAGIC R  ${stats.magicResistance}`,
        `BODY DMG ${stats.bodyAttackDamage}`,
        `SPEED    ${stats.speed}`,
        `MASS     ${stats.mass}`,
        `MOVE     ${unit.config.movementType.toUpperCase()}`,
      ].join("\n"),
    );
  }

  // --------------------------------------------------
  // REMOVE DEAD UNITS
  // --------------------------------------------------

  private removeDeadUnits(): void {
    const deadUnits =
      this.units.filter(
        (unit) => !unit.isAlive(),
      );

    if (
      deadUnits.length === 0
    ) {
      return;
    }

    for (
      const unit of deadUnits
    ) {
      const card =
        this.statusCards.get(
          unit,
        );

      if (card) {
        card.container.destroy();

        this.statusCards.delete(
          unit,
        );
      }

      unit.destroy();
    }

    this.units =
      this.units.filter(
        (unit) =>
          unit.isAlive(),
      );
  }
}

// --------------------------------------------------
// PHASER CONFIGURATION
// --------------------------------------------------

const config:
  Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,

  width: 500,

  // 500px arena + status UI underneath.
  height: 750,

  backgroundColor: "#000000",

  scene: BattleBallzScene,
};

// --------------------------------------------------
// START GAME
// --------------------------------------------------

new Phaser.Game(config);