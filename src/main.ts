import Phaser from "phaser";

import {
  Unit,
} from "./units/Unit";

import {
  Characters,
} from "./characters/Characters";

import type {
  UnitConfig,
} from "./units/UnitConfig";

// --------------------------------------------------
// UI TYPES
// --------------------------------------------------

interface StatusColumn {
  key: string;
  label: string;
  width: number;
  shouldShow: (unit: Unit) => boolean;
  getValue: (unit: Unit) => string;
}

// --------------------------------------------------
// GAME SCENE
// --------------------------------------------------

class BattleBallzScene extends Phaser.Scene {
  private units: Unit[] = [];

  private statusRows =
    new Map<Unit, Phaser.GameObjects.Text>();

  private statusColumns: StatusColumn[] = [];

  private unitNameCounters = new Map<string, number>();

  // Pause state.
  private isPaused = false;

  private pauseStatusText!: Phaser.GameObjects.Text;
  private pauseButtonBackground!: Phaser.GameObjects.Rectangle;
  private pauseButtonText!: Phaser.GameObjects.Text;

  // Arena dimensions.
  private readonly arenaWidth = 300;
  private readonly arenaHeight = 300;

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

    // const knight1 = this.createUnit(Characters.KNIGHT, 100, 250, 1);
    // const knight2 = this.createUnit(Characters.KNIGHT, 100, 250, 1);
    const goblin1 = this.createUnit(Characters.GOBLIN, 100, 250, 1);
    const goblin2 = this.createUnit(Characters.GOBLIN, 100, 250, 2);
    // const goblin3 = this.createUnit(Characters.GOBLIN, 100, 250, 2);

    // const knight1 =
    //   new Unit(
    //     this,
    //     Characters.KNIGHT,
    //     100,
    //     250,
    //     this.arenaWidth,
    //     this.arenaHeight,
    //   );
    
    // const knight2 =
    //   new Unit(
    //     this,
    //     Characters.KNIGHT,
    //     100,
    //     250,
    //     this.arenaWidth,
    //     this.arenaHeight,
    //   );

    // const goblin1 =
    //   new Unit(
    //     this,
    //     Characters.GOBLIN,
    //     400,
    //     250,
    //     this.arenaWidth,
    //     this.arenaHeight,
    //   );
    
    // const goblin2 =
    //   new Unit(
    //     this,
    //     Characters.GOBLIN,
    //     400,
    //     250,
    //     this.arenaWidth,
    //     this.arenaHeight,
    //   );

    // const wizard =
    //   new Unit(
    //     this,
    //     Characters.WIZARD,
    //     250,
    //     150,
    //     this.arenaWidth,
    //     this.arenaHeight,
    //   );

    this.units.push(
      // knight1,
      // knight2,
      goblin1,
      goblin2,
      // goblin3,
      // wizard,
    );

    // Create a UI for each unit.
    this.createStatusTable();
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

    this.updateStatusRows();
  }

  private createUnit(
    config: UnitConfig,
    x: number,
    y: number,
    teamId: number,
  ): Unit {
    const baseName =
      config.name;

    const currentCount =
      this.unitNameCounters.get(
        baseName,
      ) ?? 0;

    const instanceNumber =
      currentCount + 1;

    this.unitNameCounters.set(
      baseName,
      instanceNumber,
    );

    return new Unit(
      this,
      config,
      x,
      y,
      this.arenaWidth,
      this.arenaHeight,
      instanceNumber,
      teamId,
    );
  }

  private getUnitDisplayName(
    unit: Unit,
  ): string {
    const sameTypeCount =
      this.units.filter(
        (otherUnit) =>
          otherUnit.name ===
          unit.name,
      ).length;

    if (sameTypeCount <= 1) {
      return unit.name;
    }

    return `${unit.name} ${unit.instanceNumber}`;
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
  // STATUS UI
  // --------------------------------------------------

  private createStatusTable(): void {
    const columns: StatusColumn[] = [
      {
        key: "unit",
        label: "UNIT",
        width: 14,
        shouldShow: () => true,
        getValue: (unit) =>
          this.getUnitDisplayName(
            unit,
          ).toUpperCase(),
      },

      {
        key: "hp",
        label: "HP",
        width: 14,
        shouldShow: () => true,
        getValue: (unit) =>
          `${unit.getHealth().toFixed(1)}/${unit.getMaxHealth().toFixed(1)}`,
      },

      {
        key: "shield",
        label: "SHLD",
        width: 14,
        shouldShow: (unit) =>
          unit.getMaxShield() > 0,
        getValue: (unit) =>
          unit.getMaxShield() > 0
            ? `${unit.getShield().toFixed(1)}/${unit.getMaxShield().toFixed(1)}`
            : "",
      },

      {
        key: "armor",
        label: "ARMR",
        width: 6,
        shouldShow: (unit) =>
          unit.config.stats.armor > 0,
        getValue: (unit) =>
          unit.config.stats.armor > 0
            ? unit.config.stats.armor.toString()
            : "",
      },

      {
        key: "mr",
        label: "MR",
        width: 5,
        shouldShow: (unit) =>
          unit.config.stats.magicResistance > 0,
        getValue: (unit) =>
          unit.config.stats.magicResistance > 0
            ? unit.config.stats.magicResistance.toString()
            : "",
      },

      {
        key: "bdmg",
        label: "BDMG",
        width: 7,
        shouldShow: (unit) =>
          unit.config.stats.bodyAttackDamage > 0,
        getValue: (unit) =>
          unit.config.stats.bodyAttackDamage > 0
            ? unit.config.stats.bodyAttackDamage.toString()
            : "",
      },

      {
        key: "ms",
        label: "MS",
        width: 6,
        shouldShow: (unit) =>
          unit.config.stats.speed > 0,
        getValue: (unit) =>
          unit.config.stats.speed > 0
            ? unit.config.stats.speed.toString()
            : "",
      },

      {
        key: "mass",
        label: "MASS",
        width: 6,
        shouldShow: (unit) =>
          unit.config.stats.mass > 0,
        getValue: (unit) =>
          unit.config.stats.mass > 0
            ? unit.config.stats.mass.toString()
            : "",
      },

      {
        key: "move",
        label: "MOVE",
        width: 10,
        shouldShow: () => true,
        getValue: (unit) =>
          unit.config.movementType.toUpperCase(),
      },
    ];

    /*
    * Show a column only if at least one unit actually
    * has that stat.
    */
    this.statusColumns =
      columns.filter(
        (column) =>
          column.shouldShow(
            this.units[0],
          ) ||
          this.units.some(
            (unit) =>
              column.shouldShow(unit),
          ),
      );

    // ----------------------------------------------
    // Table background
    // ----------------------------------------------

    const tableX = 8;
    const tableY = 555;

    const rowHeight = 20;

    const tableHeight =
      rowHeight *
      (this.units.length + 1);

    this.add
      .rectangle(
        tableX,
        tableY,
        484,
        tableHeight,
        0x202020,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(
        1,
        0x555555,
      );

    // ----------------------------------------------
    // Header
    // ----------------------------------------------

    const header =
      this.formatStatusLine(
        this.statusColumns,
        (column) =>
          column.label,
      );

    this.add.text(
      tableX + 8,
      tableY + 4,
      header,
      {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#ffffff",
        fontStyle: "bold",
      },
    );

    // ----------------------------------------------
    // Unit rows
    // ----------------------------------------------

    for (
      let i = 0;
      i < this.units.length;
      i++
    ) {
      const unit =
        this.units[i];

      const row =
        this.add.text(
          tableX + 8,
          tableY +
            rowHeight *
              (i + 1) +
            4,
          this.formatStatusLine(
            this.statusColumns,
            (column) =>
              column.getValue(unit),
          ),
          {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#dddddd",
          },
        );

      this.statusRows.set(
        unit,
        row,
      );
    }
  }

  private formatStatusLine(
    columns: StatusColumn[],
    getValue: (
      column: StatusColumn,
    ) => string,
  ): string {
    return columns
      .map(
        (column) => {
          const value =
            getValue(column);

          return value.padEnd(
            column.width,
            " ",
          );
        },
      )
      .join(" ");
  }

  private updateStatusRows(): void {
    for (
      const [unit, row]
      of this.statusRows
    ) {
      row.setText(
        this.formatStatusLine(
          this.statusColumns,
          (column) =>
            column.getValue(unit),
        ),
      );
    }
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
      const row =
        this.statusRows.get(unit);

      if (row) {
        row.destroy();

        this.statusRows.delete(unit);
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