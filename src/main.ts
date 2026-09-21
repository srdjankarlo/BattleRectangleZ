import Phaser from "phaser";

import {
  GameMenu,
} from "./GameMenu";

import type {
  BattleSetup,
  UnitSelection,
} from "./GameSetup";

import {
  Unit,
} from "./units/Unit";

import {
  Characters,
} from "./characters/Characters";

import type {
  UnitConfig,
} from "./units/UnitConfig";

import type {
  MovementType,
} from "./units/Movement";

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const menuRootElement =
  document.getElementById(
    "menu-root",
  );

const gameContainerElement =
  document.getElementById(
    "game-container",
  );

if (
  !menuRootElement ||
  !gameContainerElement
) {
  throw new Error(
    "Required HTML elements were not found.",
  );
}

const menuRoot: HTMLElement =
  menuRootElement;

const gameContainer: HTMLElement =
  gameContainerElement;

// --------------------------------------------------
// GLOBAL GAME STATE
// --------------------------------------------------

let activeBattleSetup:
  BattleSetup | null = null;

let game:
  Phaser.Game | null = null;

// --------------------------------------------------
// CREATE MENU
// --------------------------------------------------

const menu =
  new GameMenu(
    menuRoot,
    startBattle,
  );

// --------------------------------------------------
// START BATTLE
// --------------------------------------------------

function startBattle(
  setup: BattleSetup,
): void {
  activeBattleSetup =
    setup;

  menu.hide();

  gameContainer.classList.remove(
    "hidden",
  );

  // Create a fresh Phaser game.
  game =
    new Phaser.Game(
      createPhaserConfig(),
    );
}

// --------------------------------------------------
// RETURN TO MENU
// --------------------------------------------------

function returnToMenu(): void {
  if (game) {
    game.destroy(
      true,
    );

    game = null;
  }

  activeBattleSetup =
    null;

  gameContainer.classList.add(
    "hidden",
  );

  menu.show();
}

// --------------------------------------------------
// PHASER CONFIG
// --------------------------------------------------

function createPhaserConfig():
  Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,

    width: 960,
    height: 900,

    backgroundColor:
      "#0b0b0b",

    parent:
      "game-container",

    /*
     * FIT makes the complete Phaser canvas
     * fit inside its parent while preserving
     * the aspect ratio.
     */
    scale: {
      mode:
        Phaser.Scale.FIT,

      autoCenter:
        Phaser.Scale.CENTER_BOTH,
    },

    scene:
      BattleBallzScene,
  };
}

// --------------------------------------------------
// GAME SCENE
// --------------------------------------------------

class BattleBallzScene
  extends Phaser.Scene {

  private units:
    Unit[] = [];

  private unitCounters =
    new Map<
      string,
      number
    >();

  private arenaWidth = 500;
  private arenaHeight = 500;

  // Pause.
  private isPaused = false;

  private pauseStatusText!:
    Phaser.GameObjects.Text;

  private pauseButtonBackground!:
    Phaser.GameObjects.Rectangle;

  private pauseButtonText!:
    Phaser.GameObjects.Text;

  // Battle status.
  private statusText!:
    Phaser.GameObjects.Text;
  
  // Status UI coordinates are LOCAL to the UI camera.
  // The UI camera itself is placed at screen Y = 590.
  private statusScrollOffset = 0;

  private readonly uiViewportTop = 590;
  private readonly uiViewportHeight = 310;

  private readonly statusPanelTop = 53;
  private readonly statusPanelHeight = 250;

  private statusContentHeight = 0;

  private statusMask!: Phaser.Display.Masks.GeometryMask;

  // scroll for phone
  private statusDragging = false;
  private statusLastPointerY = 0;

  constructor() {
    super(
      "BattleBallzScene",
    );
  }

  private scrollStatus(
    amount: number,
  ): void {
    const maximumScroll =
      Math.max(
        0,
        this.statusContentHeight -
          this.statusPanelHeight +
          10,
      );

    this.statusScrollOffset =
      Phaser.Math.Clamp(
        this.statusScrollOffset +
          amount * 0.5,
        0,
        maximumScroll,
      );

    this.statusText.y =
      this.statusPanelTop +
      8 -
      this.statusScrollOffset;
  }

  // ------------------------------------------------
  // CREATE
  // ------------------------------------------------

  create(): void {
    if (!activeBattleSetup) {
      returnToMenu();
      return;
    }

    this.arenaWidth =
      activeBattleSetup.arenaWidth;

    this.arenaHeight =
      activeBattleSetup.arenaHeight;

    // ----------------------------------------------
    // WORLD CAMERA
    // ----------------------------------------------

    const worldCamera =
      this.cameras.main;

    const worldViewportWidth =
      960;

    const worldViewportHeight =
      590;

    worldCamera.setViewport(
      0,
      0,
      worldViewportWidth,
      worldViewportHeight,
    );

    /*
     * We reserve a little padding around the arena.
     */
    const availableWidth =
      worldViewportWidth -
      30;

    const availableHeight =
      worldViewportHeight -
      30;

    /*
     * Camera zoom controls how much of the
     * world is visible.
     *
     * Large arena:
     * smaller zoom → more world visible.
     *
     * Tiny arena:
     * larger zoom → arena doesn't look tiny.
     */
    const fitZoom =
      Math.min(
        availableWidth /
          this.arenaWidth,

        availableHeight /
          this.arenaHeight,
      );

    const zoom =
      Math.min(
        2.5,
        fitZoom,
      );

    worldCamera.setZoom(
      zoom,
    );

    worldCamera.centerOn(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
    );

    // ----------------------------------------------
    // ARENA
    // ----------------------------------------------

    this.add.rectangle(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
      this.arenaWidth,
      this.arenaHeight,
      0x333333,
    );

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
    // CREATE UNITS FROM MENU
    // ----------------------------------------------

    for (
      let teamIndex = 0;
      teamIndex <
        activeBattleSetup.teams.length;
      teamIndex++
    ) {
      const team =
        activeBattleSetup
          .teams[
            teamIndex
          ];

      for (
        let unitIndex = 0;
        unitIndex <
          team.units.length;
        unitIndex++
      ) {
        const selection =
          team.units[
            unitIndex
          ];

        const unit =
          this.createUnitFromSelection(
            selection,
            team.id,
            teamIndex,
            activeBattleSetup
              .teams.length,
            unitIndex,
            team.units.length,
          );

        this.units.push(
          unit,
        );
      }
    }

    /*
     * Save everything currently in the display
     * list as WORLD objects.
     *
     * The UI created below will then be ignored
     * by the world camera.
     */
    const worldObjects =
      [...this.children.list];

    // ----------------------------------------------
    // UI CAMERA
    // ----------------------------------------------

    const uiCamera =
      this.cameras.add(
        0,
        this.uiViewportTop,
        960,
        this.uiViewportHeight,
      );

    uiCamera.setScroll(
      0,
      0,
    );

    // ----------------------------------------------
    // UI
    // ----------------------------------------------

    const uiBackground =
      this.add.rectangle(
        0,
        0,
        960,
        this.uiViewportHeight,
        0x151515,
      );

    uiBackground.setOrigin(
      0,
      0,
    );

    // Status panel background must be created BEFORE
    // the text so it stays behind the table.
    const statusPanelBackground =
      this.add.rectangle(
        0,
        this.statusPanelTop,
        960,
        this.statusPanelHeight,
        0x151515,
      );

    statusPanelBackground
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x444444);

    const title =
      this.add.text(
        12,
        8,
        "BATTLE STATUS",
        {
          fontSize: "16px",
          fontStyle: "bold",
          color: "#ffffff",
        },
      );

    this.pauseStatusText =
      this.add.text(
        12,
        31,
        "RUNNING — press P",
        {
          fontSize: "11px",
          color: "#aaaaaa",
        },
      );

    this.statusText =
      this.add.text(
        12,
        this.statusPanelTop + 8,
        "",
        {
          fontFamily:
            "monospace",

          fontSize:
            "10px",

          color:
            "#dddddd",

          lineSpacing:
            2,
        },
      );

    const maskShape =
      this.make.graphics({
        x: 0,
        y: 0,
      });

    maskShape.fillStyle(
      0xffffff,
      1,
    );

    maskShape.fillRect(
      0,
      this.statusPanelTop,
      960,
      this.statusPanelHeight,
    );

    this.statusMask =
      maskShape.createGeometryMask();

    this.statusText.setMask(
      this.statusMask,
    );

    // ----------------------------------------------
    // PAUSE BUTTON
    // ----------------------------------------------

    this.pauseButtonBackground =
      this.add.rectangle(
        777,
        20,
        105,
        30,
        0x252525,
      );

    this.pauseButtonBackground.setOrigin(
      0.5,
      0.5,
    );

    this.pauseButtonBackground.setStrokeStyle(
      1,
      0x666666,
    );

    this.pauseButtonBackground.setInteractive({
      useHandCursor: true,
    });

    this.pauseButtonText =
      this.add.text(
        777,
        20,
        "PAUSE [P]",
        {
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
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
    // BACK TO MENU BUTTON
    // ----------------------------------------------

    const menuButtonBackground =
      this.add.rectangle(
        895,
        20,
        90,
        30,
        0x252525,
      );

    menuButtonBackground.setOrigin(
      0.5,
      0.5,
    );

    menuButtonBackground.setStrokeStyle(
      1,
      0x666666,
    );

    menuButtonBackground.setInteractive({
      useHandCursor: true,
    });

    const menuButtonText =
      this.add.text(
        895,
        20,
        "MENU",
        {
          fontSize: "11px",
          fontStyle: "bold",
          color: "#ffffff",
        },
      );

    menuButtonText.setOrigin(
      0.5,
      0.5,
    );

    menuButtonBackground.on(
      "pointerdown",
      () => {
        returnToMenu();
      },
    );

    // ----------------------------------------------
    // KEYBOARD
    // ----------------------------------------------

    this.input.keyboard?.on(
      "keydown-P",
      () => {
        this.togglePause();
      },
    );

    // ----------------------------------------------
    // CAMERA FILTERING
    // ----------------------------------------------

    /*
     * UI camera:
     * render UI, ignore the battle world.
     */
    uiCamera.ignore(
      worldObjects,
    );

    /*
     * World camera:
     * render the battle world, ignore UI.
     */
    worldCamera.ignore([
      uiBackground,
      statusPanelBackground,
      title,
      this.pauseStatusText,
      this.statusText,
      statusPanelBackground,
      this.pauseButtonBackground,
      this.pauseButtonText,
      menuButtonBackground,
      menuButtonText,
    ]);

    // ----------------------------------------------
    // INITIAL STATUS
    // ----------------------------------------------

    this.updateStatus();

    // ----------------------------------------------
    // STATUS SCROLLING
    // ----------------------------------------------

    const statusPanelScreenTop =
      this.uiViewportTop +
      this.statusPanelTop;

    const statusPanelScreenBottom =
      statusPanelScreenTop +
      this.statusPanelHeight;

    // Mouse wheel / trackpad.
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
        _deltaZ: number,
      ) => {
        if (
          pointer.y < statusPanelScreenTop ||
          pointer.y > statusPanelScreenBottom
        ) {
          return;
        }

        this.scrollStatus(deltaY);
      },
    );

    // Touch / mouse dragging for mobile and desktop.
    this.input.on(
      "pointerdown",
      (pointer: Phaser.Input.Pointer) => {
        if (
          pointer.y >= statusPanelScreenTop &&
          pointer.y <= statusPanelScreenBottom
        ) {
          this.statusDragging = true;
          this.statusLastPointerY = pointer.y;
        }
      },
    );

    this.input.on(
      "pointermove",
      (pointer: Phaser.Input.Pointer) => {
        if (!this.statusDragging) {
          return;
        }

        const movement =
          this.statusLastPointerY -
          pointer.y;

        this.statusLastPointerY =
          pointer.y;

        this.scrollStatus(movement);
      },
    );

    this.input.on(
      "pointerup",
      () => {
        this.statusDragging = false;
      },
    );

    this.input.on(
      "pointerupoutside",
      () => {
        this.statusDragging = false;
      },
    );
  }

  // ------------------------------------------------
  // CREATE UNIT
  // ------------------------------------------------

  private createUnitFromSelection(
    selection: UnitSelection,
    teamId: number,
    teamIndex: number,
    teamCount: number,
    unitIndex: number,
    unitsInTeam: number,
  ): Unit {
    const baseConfig =
      Characters[
        selection.characterId
      ];

    // ----------------------------------------------
    // Movement override
    // ----------------------------------------------

    let config:
      UnitConfig =
        baseConfig;

    if (
      selection.movementOverride !==
      "default"
    ) {
      config = {
        ...baseConfig,
        movementType:
          selection.movementOverride as MovementType,
      };
    }

    // ----------------------------------------------
    // Instance numbering
    // ----------------------------------------------

    const baseName =
      config.name;

    const currentCount =
      this.unitCounters.get(
        baseName,
      ) ?? 0;

    const instanceNumber =
      currentCount + 1;

    this.unitCounters.set(
      baseName,
      instanceNumber,
    );

    // ----------------------------------------------
    // Spawn position
    // ----------------------------------------------

    const position =
      this.getSpawnPosition(
        teamIndex,
        teamCount,
        unitIndex,
        unitsInTeam,
        config.stats.radius,
      );

    return new Unit(
      this,
      config,
      position.x,
      position.y,
      this.arenaWidth,
      this.arenaHeight,
      teamId,
      instanceNumber,
    );
  }

  // ------------------------------------------------
  // SPAWN POSITION
  // ------------------------------------------------

  private getSpawnPosition(
    teamIndex: number,
    teamCount: number,
    unitIndex: number,
    unitsInTeam: number,
    unitRadius: number,
  ): {
    x: number;
    y: number;
  } {
    let centerX: number;
    let centerY: number;

    // ----------------------------------------------
    // Two teams:
    //
    // Team 1 = left
    // Team 2 = right
    // ----------------------------------------------

    if (
      teamCount === 2
    ) {
      centerX =
        teamIndex === 0
          ? this.arenaWidth *
            0.20
          : this.arenaWidth *
            0.80;

      centerY =
        this.arenaHeight /
        2;
    } else {
      // --------------------------------------------
      // Three or more teams:
      // distribute them around the arena center.
      // --------------------------------------------

      const angle =
        -Math.PI / 2 +
        (
          teamIndex /
          teamCount
        ) *
          Math.PI *
          2;

      const distance =
        Math.min(
          this.arenaWidth,
          this.arenaHeight,
        ) *
        0.30;

      centerX =
        this.arenaWidth /
          2 +
        Math.cos(angle) *
          distance;

      centerY =
        this.arenaHeight /
          2 +
        Math.sin(angle) *
          distance;
    }

    // ----------------------------------------------
    // Spread units belonging to one team.
    // ----------------------------------------------

    const spread =
      Math.min(
        60,
        Math.min(
          this.arenaWidth,
          this.arenaHeight,
        ) * 0.15,
      );

    const unitAngle =
      unitsInTeam === 1
        ? 0
        : (
            unitIndex /
            unitsInTeam
          ) *
          Math.PI *
          2;

    let x =
      centerX +
      Math.cos(unitAngle) *
        spread;

    let y =
      centerY +
      Math.sin(unitAngle) *
        spread;

    // Keep the unit inside the arena.
    x =
      Phaser.Math.Clamp(
        x,
        unitRadius,
        this.arenaWidth -
          unitRadius,
      );

    y =
      Phaser.Math.Clamp(
        y,
        unitRadius,
        this.arenaHeight -
          unitRadius,
      );

    return {
      x,
      y,
    };
  }

  // ------------------------------------------------
  // UPDATE
  // ------------------------------------------------

  update(
    _time: number,
    delta: number,
  ): void {
    const deltaSeconds =
      delta / 1000;

    // ----------------------------------------------
    // SIMULATION
    // ----------------------------------------------

    if (!this.isPaused) {
      for (
        const unit of this.units
      ) {
        unit.update(
          deltaSeconds,
        );
      }

      // --------------------------------------------
      // UNIT COLLISIONS
      // --------------------------------------------

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
          this.units[
            i
          ].resolveCollision(
            this.units[
              j
            ],
          );
        }
      }

      // --------------------------------------------
      // REMOVE DEAD UNITS
      // --------------------------------------------

      this.removeDeadUnits();
    }

    this.updateStatus();
  }

  // ------------------------------------------------
  // STATUS
  // ------------------------------------------------

  private updateStatus(): void {
    const hasShield =
      this.units.some(
        (unit) =>
          unit.getMaxShield() >
          0,
      );

    const headerParts = [
      "UNIT",
      "TEAM",
      "HP",
    ];

    if (hasShield) {
      headerParts.push(
        "SHLD",
      );
    }

    headerParts.push(
      "ARMR",
      "MR",
      "BDMG",
      "MS",
      "MASS",
      "MOVE",
    );

    const lines: string[] = [
      headerParts
        .map(
          (value) =>
            value.padEnd(
              11,
              " ",
            ),
        )
        .join(" "),
    ];

    for (
      const unit of this.units
    ) {
      const sameNameCount =
        this.units.filter(
          (other) =>
            other.name ===
            unit.name,
        ).length;

      const displayName =
        sameNameCount > 1
          ? `${unit.name} ${unit.instanceNumber}`
          : unit.name;

      const stats =
        unit.config.stats;

      const parts = [
        displayName,
        unit.teamId.toString(),
        `${unit.getHealth().toFixed(2)}/${unit.getMaxHealth().toFixed(0)}`,
      ];

      if (hasShield) {
        parts.push(
          stats.maxShield > 0
            ? `${unit.getShield().toFixed(1)}/${unit.getMaxShield().toFixed(0)}`
            : "-",
        );
      }

      parts.push(
        stats.armor > 0
          ? stats.armor.toString()
          : "-",

        stats.magicResistance > 0
          ? stats.magicResistance.toString()
          : "-",

        stats.bodyAttackDamage.toString(),

        stats.speed.toString(),

        stats.mass.toString(),

        unit.config.movementType.toUpperCase(),
      );

      lines.push(
        parts
          .map(
            (value) =>
              value.padEnd(
                11,
                " ",
              ),
          )
          .join(" "),
      );
    }

    if (
      this.units.length === 0
    ) {
      lines.push(
        "",
        "NO UNITS REMAINING",
      );
    }

    this.statusText.setText(
      lines.join("\n"),
    );

    const lineHeight = 14;

    this.statusContentHeight =
      lines.length *
      lineHeight;

    this.statusScrollOffset =
      Phaser.Math.Clamp(
        this.statusScrollOffset,
        0,
        Math.max(
          0,
          this.statusContentHeight -
            this.statusPanelHeight +
            10,
        ),
      );

    this.statusText.y =
      this.statusPanelTop +
      8 -
      this.statusScrollOffset;
  }

  // ------------------------------------------------
  // DEAD UNITS
  // ------------------------------------------------

  private removeDeadUnits(): void {
    const deadUnits =
      this.units.filter(
        (unit) =>
          !unit.isAlive(),
      );

    if (
      deadUnits.length === 0
    ) {
      return;
    }

    for (
      const unit of deadUnits
    ) {
      unit.destroy();
    }

    this.units =
      this.units.filter(
        (unit) =>
          unit.isAlive(),
      );
  }

  // ------------------------------------------------
  // PAUSE
  // ------------------------------------------------

  private togglePause(): void {
    this.isPaused =
      !this.isPaused;

    if (
      this.isPaused
    ) {
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
}