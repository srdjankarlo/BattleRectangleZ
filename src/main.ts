import Phaser from "phaser";
import "./style.css";

import { GameMenu } from "./GameMenu";
import type { BattleSetup, UnitSelection } from "./GameSetup";
import { Unit } from "./units/Unit";
import { Characters } from "./characters/Characters";
import type { UnitConfig } from "./units/UnitConfig";
import type { MovementType } from "./units/Movement";

// ==================================================
// SCREEN / VIEWPORT LAYOUT
// ==================================================
//
// Change these values when you want to move/rescale
// the main parts of the battle screen.
//
// The important rule is: everything below is calculated
// from these constants. You should NOT need to hunt through
// the file for another hard-coded viewport position.
// ==================================================

const GAME_WIDTH = 540;
const GAME_HEIGHT = 900;

// The arena always occupies the top of the screen.
const ARENA_VIEWPORT = {
  x: 0,
  y: 0,
  width: GAME_WIDTH,
  height: 500,
} as const;

// UI starts immediately underneath the arena.
const UI_VIEWPORT = {
  x: 0,
  y: ARENA_VIEWPORT.y + ARENA_VIEWPORT.height,
  width: GAME_WIDTH,
  height: GAME_HEIGHT - ARENA_VIEWPORT.height,
} as const;

// ==================================================
// BATTLE BUTTON LAYOUT
// ==================================================

const BATTLE_BUTTONS = {
  y: 26,
  width: 145,
  height: 44,
  positions: {
    restart: 85,
    pause: 270,
    menu: 455,
  },
} as const;

// ==================================================
// STATS TABLE LAYOUT
// ==================================================
//
// The table is made of:
//
//   fixed header (3 lines)
//   -----------------------
//   scrollable unit area
//
// Every unit occupies 3 data lines + 1 blank line.
//
// Increase TABLE_COLUMN_WIDTH if a future stat/name does
// not fit. Current values comfortably fit in 16 characters.
// ==================================================

const STATS_TABLE = {
  panelTop: 54,
  panelBottomPadding: 8,

  // Height of the fixed 3-line header area.
  headerHeight: 55,

  // Text position inside the scrollable area.
  textX: 8,
  textTopPadding: 4,

  // Four equal horizontal columns:
  // TEAM/UNIT | PASS | ABIL | ULT
  // HP        | ARM  | MR   | SHLD
  // BD        | AD   | AP   | MOVE
  columnWidth: 20,

  fontSize: 13,
  lineSpacing: 4,
} as const;

const STATS_TABLE_LINE_HEIGHT =
  STATS_TABLE.fontSize + STATS_TABLE.lineSpacing;

const STATS_PANEL_HEIGHT =
  UI_VIEWPORT.height - STATS_TABLE.panelTop;

const STATS_BODY_TOP =
  STATS_TABLE.panelTop + STATS_TABLE.headerHeight;

const STATS_BODY_HEIGHT = Math.max(
  0,
  STATS_PANEL_HEIGHT -
    STATS_TABLE.headerHeight -
    STATS_TABLE.panelBottomPadding,
);

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const menuRootElement = document.getElementById("menu-root");
const gameContainerElement = document.getElementById("game-container");

if (!menuRootElement || !gameContainerElement) {
  throw new Error("Required HTML elements were not found.");
}

const menuRoot: HTMLElement = menuRootElement;
const gameContainer: HTMLElement = gameContainerElement;

// --------------------------------------------------
// GLOBAL GAME STATE
// --------------------------------------------------

let activeBattleSetup: BattleSetup | null = null;
let game: Phaser.Game | null = null;

// --------------------------------------------------
// CREATE MENU
// --------------------------------------------------

const menu = new GameMenu(menuRoot, startBattle);

// --------------------------------------------------
// START BATTLE
// --------------------------------------------------

function startBattle(setup: BattleSetup): void {
  activeBattleSetup = setup;

  menu.hide();
  gameContainer.classList.remove("hidden");

  if (!game) {
    game = new Phaser.Game(createPhaserConfig());
    return;
  }

  game.scale.refresh();

  const scene = game.scene.getScene("BattleBallzScene");
  scene.scene.restart();
}

function restartBattle(): void {
  if (!game) {
    return;
  }

  const scene = game.scene.getScene("BattleBallzScene");
  scene.scene.restart();
}

// --------------------------------------------------
// RETURN TO MENU
// --------------------------------------------------

function returnToMenu(): void {
  if (game) {
    if (game.scene.isActive("BattleBallzScene")) {
      game.scene.stop("BattleBallzScene");
    }
  }

  activeBattleSetup = null;
  gameContainer.classList.add("hidden");
  menu.show();
}

// --------------------------------------------------
// PHASER CONFIG
// --------------------------------------------------

function createPhaserConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: "#0b0b0b",
    parent: "game-container",
    powerPreference: "high-performance",
    autoMobileTextures: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: 1,
    },
    scene: BattleBallzScene,
  };
}

// --------------------------------------------------
// GAME SCENE
// --------------------------------------------------

class BattleBallzScene extends Phaser.Scene {
  private units: Unit[] = [];
  private unitCounters = new Map<string, number>();

  private arenaWidth = 500;
  private arenaHeight = 500;

  // Pause
  private isPaused = false;

  private pauseButtonBackground!: Phaser.GameObjects.Rectangle;
  private pauseButtonText!: Phaser.GameObjects.Text;
  private restartButtonBackground!: Phaser.GameObjects.Rectangle;

  // Battle status
  private statsHeaderText!: Phaser.GameObjects.Text;
  private statsValuesText!: Phaser.GameObjects.Text;

  private statsDragging = false;
  private statsLastPointerY = 0;

  private statsScrollOffsetY = 0;
  private statsContentHeight = 0;

  private battleElapsedSeconds = 0;
  private battleFinished = false;
  private initialTeamCount = 0;

  private lastDisplayedBattleSecond = -1;

  private uiUpdateTimer = 0;
  private lastStatsText = "";

  constructor() {
    super("BattleBallzScene");
  }

  // ------------------------------------------------
  // STATS SCROLLING
  // ------------------------------------------------
  //
  // These calculations use the SAME constants as the
  // table drawing code. If you move the header or resize
  // the UI viewport, scrolling follows automatically.
  // ------------------------------------------------

  private getStatsMaximumScroll(): number {
    return Math.max(
      0,
      this.statsContentHeight - STATS_BODY_HEIGHT,
    );
  }

  private updateStatsTextPosition(): void {
    this.statsValuesText.y =
      STATS_BODY_TOP +
      STATS_TABLE.textTopPadding -
      this.statsScrollOffsetY;
  }

  private scrollStats(amount: number): void {
    this.statsScrollOffsetY = Phaser.Math.Clamp(
      this.statsScrollOffsetY + amount,
      0,
      this.getStatsMaximumScroll(),
    );

    this.updateStatsTextPosition();
  }

  private formatDuration(totalSeconds: number): string {
    const total = Math.floor(totalSeconds);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  preload(): void {
    // Preload character unit icon images.
    for (const charKey of Object.keys(Characters)) {
      const charConfig = Characters[charKey as keyof typeof Characters];
      if (charConfig.icon) {
        this.load.image(charConfig.icon, charConfig.icon);
      }
    }
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
    const baseConfig = Characters[selection.characterId];

    let config: UnitConfig = baseConfig;

    if (selection.movementOverride !== "default") {
      config = {
        ...baseConfig,
        movementType: selection.movementOverride as MovementType,
      };
    }

    const baseName = config.name;
    const currentCount = this.unitCounters.get(baseName) ?? 0;
    const instanceNumber = currentCount + 1;

    this.unitCounters.set(baseName, instanceNumber);

    const unitSize = Math.max(config.stats.width, config.stats.height) / 2;

    const position = this.getSpawnPosition(
      teamIndex,
      teamCount,
      unitIndex,
      unitsInTeam,
      unitSize,
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
  // CREATE
  // ------------------------------------------------

  create(): void {
    if (!activeBattleSetup) {
      returnToMenu();
      return;
    }

    // Clean up lingering secondary cameras from previous restarts.
    for (const camera of [...this.cameras.cameras]) {
      if (camera !== this.cameras.main) {
        this.cameras.remove(camera, true);
      }
    }

    // Reset scene state.
    this.units = [];
    this.unitCounters.clear();
    this.isPaused = false;
    this.statsScrollOffsetY = 0;
    this.statsDragging = false;
    this.statsLastPointerY = 0;

    this.battleElapsedSeconds = 0;
    this.battleFinished = false;
    this.initialTeamCount = activeBattleSetup.teams.length;
    this.lastDisplayedBattleSecond = -1;
    this.uiUpdateTimer = 0;
    this.lastStatsText = "";

    this.arenaWidth = activeBattleSetup.arenaWidth;
    this.arenaHeight = activeBattleSetup.arenaHeight;

    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    const uiObjects: Phaser.GameObjects.GameObject[] = [];

    // ----------------------------------------------
    // WORLD CAMERA / ARENA VIEWPORT
    // ----------------------------------------------
    // Edit ARENA_VIEWPORT at the top of the file.
    // ----------------------------------------------

    const worldCamera = this.cameras.main;

    worldCamera.setViewport(
      ARENA_VIEWPORT.x,
      ARENA_VIEWPORT.y,
      ARENA_VIEWPORT.width,
      ARENA_VIEWPORT.height,
    );

    const fitZoom = Math.min(
      ARENA_VIEWPORT.width / this.arenaWidth,
      ARENA_VIEWPORT.height / this.arenaHeight,
    );

    worldCamera.setZoom(fitZoom);
    worldCamera.centerOn(this.arenaWidth / 2, this.arenaHeight / 2);

    // ----------------------------------------------
    // ARENA
    // ----------------------------------------------

    const arenaBg = this.add
      .rectangle(
        this.arenaWidth / 2,
        this.arenaHeight / 2,
        this.arenaWidth,
        this.arenaHeight,
        0x282828,
      )
      .setDepth(0);

    const arenaBorder = this.add
      .rectangle(
        this.arenaWidth / 2,
        this.arenaHeight / 2,
        this.arenaWidth,
        this.arenaHeight,
      )
      .setStrokeStyle(8, 0x6f53ff)
      .setDepth(1);

    worldObjects.push(arenaBg, arenaBorder);

    // ----------------------------------------------
    // CREATE UNITS FROM MENU
    // ----------------------------------------------

    for (
      let teamIndex = 0;
      teamIndex < activeBattleSetup.teams.length;
      teamIndex++
    ) {
      const team = activeBattleSetup.teams[teamIndex];

      for (let unitIndex = 0; unitIndex < team.units.length; unitIndex++) {
        const selection = team.units[unitIndex];

        const unit = this.createUnitFromSelection(
          selection,
          team.id,
          teamIndex,
          activeBattleSetup.teams.length,
          unitIndex,
          team.units.length,
        );

        this.units.push(unit);

        worldObjects.push(unit.sprite, unit.healthBarBg, unit.healthBarFill);
      }
    }

    // ----------------------------------------------
    // UI CAMERA / UI VIEWPORT
    // ----------------------------------------------
    // Edit UI_VIEWPORT at the top of the file.
    // ----------------------------------------------

    const uiCamera = this.cameras.add(
      UI_VIEWPORT.x,
      UI_VIEWPORT.y,
      UI_VIEWPORT.width,
      UI_VIEWPORT.height,
    );

    uiCamera.setScroll(0, 0);

    // ----------------------------------------------
    // UI BACKGROUND
    // ----------------------------------------------

    const uiBackground = this.add.rectangle(
      0,
      0,
      UI_VIEWPORT.width,
      UI_VIEWPORT.height,
      0x121118,
    );

    uiBackground.setOrigin(0, 0);
    uiObjects.push(uiBackground);

    // ----------------------------------------------
    // BUTTON ROW
    // ----------------------------------------------
    // Edit BATTLE_BUTTONS at the top of the file.
    // ----------------------------------------------

    // Button Row Cover (Blocks any text scrolling above panelTop)
    const buttonRowBgCover = this.add.rectangle(
      0,
      0,
      UI_VIEWPORT.width,
      STATS_TABLE.panelTop,
      0x121118,
    );
    buttonRowBgCover.setOrigin(0, 0).setDepth(28);
    uiObjects.push(buttonRowBgCover);

    const createButton = (
      x: number,
      label: string,
    ): {
      background: Phaser.GameObjects.Rectangle;
      text: Phaser.GameObjects.Text;
    } => {
      const background = this.add.rectangle(
        x,
        BATTLE_BUTTONS.y,
        BATTLE_BUTTONS.width,
        BATTLE_BUTTONS.height,
        0x2e2a40,
      );

      background
        .setOrigin(0.5, 0.5)
        .setStrokeStyle(2, 0x6f53ff)
        .setInteractive({ useHandCursor: true })
        .setDepth(30); // Ensures buttons render OVER stats text

      const text = this.add.text(
        x,
        BATTLE_BUTTONS.y,
        label,
        {
          fontSize: label === "00:00 PAUSE" ? "18px" : "20px",
          fontStyle: "bold",
          color: "#ffffff",
        },
      );

      text.setOrigin(0.5, 0.5).setDepth(31);

      uiObjects.push(background, text);

      return { background, text };
    };

    // RESTART
    const restartButton = createButton(
      BATTLE_BUTTONS.positions.restart,
      "RESTART",
    );

    this.restartButtonBackground = restartButton.background;
    this.restartButtonBackground.on("pointerdown", () => {
      restartBattle();
    });

    // PAUSE / RESUME + TIMER
    const pauseButton = createButton(
      BATTLE_BUTTONS.positions.pause,
      "00:00 PAUSE",
    );

    this.pauseButtonBackground = pauseButton.background;
    this.pauseButtonText = pauseButton.text;

    this.pauseButtonBackground.on("pointerdown", () => {
      this.togglePause();
    });

    // MENU
    const menuButton = createButton(
      BATTLE_BUTTONS.positions.menu,
      "MENU",
    );

    menuButton.background.on("pointerdown", () => {
      returnToMenu();
    });

    // ----------------------------------------------
    // STATS PANEL
    // ----------------------------------------------

    const statsPanelBackground = this.add.rectangle(
      0,
      STATS_TABLE.panelTop,
      UI_VIEWPORT.width,
      STATS_PANEL_HEIGHT,
      0x1a1924,
    );

    statsPanelBackground
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x3d3954)
      .setDepth(0);

    uiObjects.push(statsPanelBackground);

    // ----------------------------------------------
    // FIXED TABLE HEADER
    // ----------------------------------------------

    // Header background fill to prevent any text bleed-through
    const headerBackground = this.add.rectangle(
      0,
      STATS_TABLE.panelTop,
      UI_VIEWPORT.width,
      STATS_TABLE.headerHeight,
      0x1a1924,
    );
    headerBackground.setOrigin(0, 0).setDepth(19);
    uiObjects.push(headerBackground);

    const formatCell = (value: string): string =>
      value
        .slice(0, STATS_TABLE.columnWidth)
        .padEnd(STATS_TABLE.columnWidth, " ");

    const headerRows = [
      ["TEAM/UNIT", "PASS", "ABIL", "ULT"],
      ["HP", "ARM", "MR", "SHLD"],
      ["BD", "AD", "AP", "MOVE"],
    ];

    this.statsHeaderText = this.add.text(
      STATS_TABLE.textX,
      STATS_TABLE.panelTop,
      headerRows
        .map((row) => row.map(formatCell).join(""))
        .join("\n"),
      {
        fontFamily: "monospace",
        fontSize: `${STATS_TABLE.fontSize}px`,
        fontStyle: "bold",
        color: "#ffffff",
        lineSpacing: STATS_TABLE.lineSpacing,
      },
    );

    this.statsHeaderText.setDepth(20);
    uiObjects.push(this.statsHeaderText);

    // Header/body separator.
    const headerSeparator = this.add.rectangle(
      0,
      STATS_BODY_TOP,
      UI_VIEWPORT.width,
      1,
      0x4a465f,
    );

    headerSeparator.setOrigin(0, 0).setDepth(20);
    uiObjects.push(headerSeparator);

    // ----------------------------------------------
    // SCROLLABLE UNIT TABLE
    // ----------------------------------------------

    this.statsValuesText = this.add.text(
      STATS_TABLE.textX,
      STATS_BODY_TOP + STATS_TABLE.textTopPadding,
      "",
      {
        fontFamily: "monospace",
        fontSize: `${STATS_TABLE.fontSize}px`,
        color: "#eeeeee",
        lineSpacing: STATS_TABLE.lineSpacing,
      },
    );

    this.statsValuesText.setDepth(10);
    uiObjects.push(this.statsValuesText);

    // Only the body is scrollable. The header remains fixed.
    const statsMaskShape = this.add.graphics();

    statsMaskShape.fillStyle(0xffffff, 1);
    statsMaskShape.fillRect(
      0,
      STATS_BODY_TOP,
      UI_VIEWPORT.width,
      STATS_BODY_HEIGHT,
    );
    statsMaskShape.setVisible(false);
    // uiObjects.push(statsMaskShape);

    const statsMask = statsMaskShape.createGeometryMask();
    this.statsValuesText.setMask(statsMask);

    // ----------------------------------------------
    // KEYBOARD
    // ----------------------------------------------

    this.input.keyboard?.on("keydown-P", () => {
      this.togglePause();
    });

    // ----------------------------------------------
    // CAMERA ISOLATION
    // ----------------------------------------------

    uiCamera.ignore(worldObjects);
    worldCamera.ignore(uiObjects);

    // ----------------------------------------------
    // INITIAL STATUS / SCROLLING
    // ----------------------------------------------

    this.updateStatus();

    const isInsideStatsBody = (pointer: Phaser.Input.Pointer): boolean => {
      const bodyTopOnScreen = UI_VIEWPORT.y + STATS_BODY_TOP;
      const bodyBottomOnScreen = bodyTopOnScreen + STATS_BODY_HEIGHT;

      return (
        pointer.y >= bodyTopOnScreen &&
        pointer.y <= bodyBottomOnScreen
      );
    };

    // Mouse wheel scrolling.
    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (!isInsideStatsBody(pointer)) {
          return;
        }

        this.scrollStats(deltaY * 0.6);
      },
    );

    // Touch / mouse drag scrolling.
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!isInsideStatsBody(pointer)) {
        return;
      }

      this.statsDragging = true;
      this.statsLastPointerY = pointer.y;
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.statsDragging) {
        return;
      }

      const movement = this.statsLastPointerY - pointer.y;
      this.statsLastPointerY = pointer.y;
      this.scrollStats(movement);
    });

    this.input.on("pointerup", () => {
      this.statsDragging = false;
    });

    this.input.on("pointerupoutside", () => {
      this.statsDragging = false;
    });
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
  ): { x: number; y: number } {
    let centerX: number;
    let centerY: number;

    if (teamCount === 2) {
      centerX = teamIndex === 0 ? this.arenaWidth * 0.22 : this.arenaWidth * 0.78;
      centerY = this.arenaHeight / 2;
    } else {
      const angle = -Math.PI / 2 + (teamIndex / teamCount) * Math.PI * 2;
      const distance = Math.min(this.arenaWidth, this.arenaHeight) * 0.3;

      centerX = this.arenaWidth / 2 + Math.cos(angle) * distance;
      centerY = this.arenaHeight / 2 + Math.sin(angle) * distance;
    }

    const spread = Math.min(
      70,
      Math.min(this.arenaWidth, this.arenaHeight) * 0.18,
    );

    const unitAngle =
      unitsInTeam === 1 ? 0 : (unitIndex / unitsInTeam) * Math.PI * 2;

    let x = centerX + Math.cos(unitAngle) * spread;
    let y = centerY + Math.sin(unitAngle) * spread;

    x = Phaser.Math.Clamp(x, unitRadius + 5, this.arenaWidth - unitRadius - 5);
    y = Phaser.Math.Clamp(y, unitRadius + 5, this.arenaHeight - unitRadius - 5);

    return { x, y };
  }

  // ------------------------------------------------
  // UPDATE
  // ------------------------------------------------

  update(_time: number, delta: number): void {
    const deltaSeconds = delta / 1000;

    if (!this.isPaused && !this.battleFinished) {
      this.battleElapsedSeconds += deltaSeconds;

      // Keep physics from making a visible speed jump after a dropped frame.
      const simulationDeltaSeconds = Math.min(deltaSeconds, 1 / 30);

      for (const unit of this.units) {
        unit.update(simulationDeltaSeconds);
      }

      this.resolveUnitCollisions();

      this.removeDeadUnits();

      const wholeSecond = Math.floor(this.battleElapsedSeconds);
      if (wholeSecond !== this.lastDisplayedBattleSecond) {
        this.lastDisplayedBattleSecond = wholeSecond;
        this.pauseButtonText.setText(
          `${this.formatDuration(this.battleElapsedSeconds)} PAUSE`,
        );
      }

      // Throttle UI update to 10 FPS (100ms interval).
      this.uiUpdateTimer += delta;
      if (this.uiUpdateTimer >= 100) {
        this.updateStatus();
        this.uiUpdateTimer = 0;
      }
    }
  }

  // ------------------------------------------------
  // UNIT COLLISIONS
  // ------------------------------------------------

  private resolveUnitCollisions(): void {
    const unitCount = this.units.length;

    // For small battles, the straightforward pair loop is faster.
    if (unitCount <= 32) {
      for (let i = 0; i < unitCount; i++) {
        for (let j = i + 1; j < unitCount; j++) {
          this.units[i].resolveCollision(this.units[j]);
        }
      }
      return;
    }

    // For larger battles, use a uniform spatial grid so distant units
    // are never compared with each other.
    let cellSize = 1;

    for (const unit of this.units) {
      cellSize = Math.max(
        cellSize,
        unit.physics.width,
        unit.physics.height,
      );
    }

    const grid = new Map<string, number[]>();

    const addToCell = (
      cellX: number,
      cellY: number,
      unitIndex: number,
    ): void => {
      const key = `${cellX},${cellY}`;
      const cell = grid.get(key);

      if (cell) {
        cell.push(unitIndex);
      } else {
        grid.set(key, [unitIndex]);
      }
    };

    for (let i = 0; i < unitCount; i++) {
      const physics = this.units[i].physics;
      const halfWidth = physics.width / 2;
      const halfHeight = physics.height / 2;

      const minCellX = Math.floor((physics.x - halfWidth) / cellSize);
      const maxCellX = Math.floor((physics.x + halfWidth) / cellSize);
      const minCellY = Math.floor((physics.y - halfHeight) / cellSize);
      const maxCellY = Math.floor((physics.y + halfHeight) / cellSize);

      for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
        for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
          addToCell(cellX, cellY, i);
        }
      }
    }

    const checkedPairs = new Set<string>();

    for (const cell of grid.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i];
          const b = cell[j];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;

          if (checkedPairs.has(key)) {
            continue;
          }

          checkedPairs.add(key);
          this.units[a].resolveCollision(this.units[b]);
        }
      }
    }
  }

  // ------------------------------------------------
  // STATUS
  // ------------------------------------------------

  private updateStatus(): void {
    const nameCounts = new Map<string, number>();

    for (const unit of this.units) {
      nameCounts.set(
        unit.name,
        (nameCounts.get(unit.name) ?? 0) + 1,
      );
    }

    const formatCell = (value: string): string =>
      value
        .slice(0, STATS_TABLE.columnWidth)
        .padEnd(STATS_TABLE.columnWidth, " ");

    const lines: string[] = [];

    for (const unit of this.units) {
      const duplicate = (nameCounts.get(unit.name) ?? 0) > 1;

      const unitName = duplicate
        ? `${unit.name} ${unit.instanceNumber}`
        : unit.name;

      const teamUnit = `${unit.teamId}/${unitName}`;
      const stats = unit.config.stats;

      const hp = `${unit.getHealth().toFixed(2)}/${unit.getMaxHealth().toFixed(0)}`;
      const shield = `${unit.getShield().toFixed(1)}/${unit.getMaxShield().toFixed(0)}`;

      const movementName =
        unit.config.movementType.charAt(0).toUpperCase() +
        unit.config.movementType.slice(1);

      const move = `${stats.speed} ${movementName}`;

      // Three compact rows per unit, matching the fixed table header.
      lines.push(
        formatCell(teamUnit) +
          formatCell("ToDo") +
          formatCell("ToDo") +
          formatCell("ToDo"),

        formatCell(hp) +
          formatCell(stats.armor.toString()) +
          formatCell(stats.magicResistance.toString()) +
          formatCell(shield),

        formatCell(stats.bodyDamage.toString()) +
          formatCell("ToDo") +
          formatCell("ToDo") +
          formatCell(move),

        // Blank line separates one unit from the next.
        "",
      );
    }

    if (lines.length === 0) {
      lines.push("NO UNITS REMAINING");
    }

    const formattedText = lines.join("\n");

    if (formattedText !== this.lastStatsText) {
      this.lastStatsText = formattedText;
      this.statsValuesText.setText(formattedText);
    }

    // Height is based on exactly the same line-height used by the text.
    this.statsContentHeight =
      lines.length * STATS_TABLE_LINE_HEIGHT;

    // Keep the current scroll position valid if units die or are removed.
    this.statsScrollOffsetY = Phaser.Math.Clamp(
      this.statsScrollOffsetY,
      0,
      this.getStatsMaximumScroll(),
    );

    this.updateStatsTextPosition();
  }

  // ------------------------------------------------
  // DEAD UNITS & WIN CONDITION
  // ------------------------------------------------

  private checkBattleEnd(): void {
    if (this.initialTeamCount < 2) {
      return;
    }

    const aliveTeams = new Set(this.units.map((unit) => unit.teamId));

    if (aliveTeams.size === 0) {
      this.showBattleResult(null);
      return;
    }

    if (aliveTeams.size === 1) {
      const winningTeamId = [...aliveTeams][0];
      this.showBattleResult(winningTeamId);
    }
  }

  private showBattleResult(winningTeamId: number | null): void {
    if (this.battleFinished) {
      return;
    }

    this.battleFinished = true;
    this.isPaused = true;

    const resultObjects: Phaser.GameObjects.GameObject[] = [];

    const resultCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    resultCamera.setScroll(0, 0);

    const overlay = this.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x07070b,
      0.97,
    );

    overlay.setDepth(100);
    resultObjects.push(overlay);

    const title = this.add.text(
      GAME_WIDTH / 2,
      100,
      "BATTLE OVER",
      {
        fontSize: "34px",
        fontStyle: "bold",
        color: "#ffffff",
      },
    );

    title.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(title);

    const resultText =
      winningTeamId === null ? "DRAW" : `TEAM ${winningTeamId} WINS`;

    const result = this.add.text(
      GAME_WIDTH / 2,
      165,
      resultText,
      {
        fontSize: "30px",
        fontStyle: "bold",
        color: "#a98cff",
      },
    );

    result.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(result);

    const duration = this.add.text(
      GAME_WIDTH / 2,
      230,
      `DURATION\n${this.formatDuration(this.battleElapsedSeconds)}`,
      {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#eeeeee",
        align: "center",
      },
    );

    duration.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(duration);

    const survivors = this.units.map((unit) => {
      const sameNameCount = this.units.filter(
        (other) => other.name === unit.name,
      ).length;

      const displayName =
        sameNameCount > 1
          ? `${unit.name} #${unit.instanceNumber}`
          : unit.name;

      return `TEAM ${unit.teamId}  ${displayName}`;
    });

    const survivorText =
      survivors.length > 0 ? survivors.join("\n") : "NO SURVIVORS";

    const survivorsTitle = this.add.text(
      GAME_WIDTH / 2,
      310,
      "SURVIVORS",
      {
        fontSize: "18px",
        fontStyle: "bold",
        color: "#8e8aa3",
      },
    );

    survivorsTitle.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(survivorsTitle);

    const survivorsList = this.add.text(
      GAME_WIDTH / 2,
      345,
      survivorText,
      {
        fontFamily: "monospace",
        fontSize: "19px",
        color: "#ffffff",
        align: "center",
        lineSpacing: 8,
      },
    );

    survivorsList.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(survivorsList);

    const createResultButton = (
      y: number,
      label: string,
    ): Phaser.GameObjects.Rectangle => {
      const background = this.add.rectangle(
        GAME_WIDTH / 2,
        y,
        260,
        56,
        0x2e2a40,
      );

      background
        .setStrokeStyle(2, 0x6f53ff)
        .setInteractive({ useHandCursor: true })
        .setDepth(101);

      const text = this.add.text(
        GAME_WIDTH / 2,
        y,
        label,
        {
          fontSize: "21px",
          fontStyle: "bold",
          color: "#ffffff",
        },
      );

      text.setOrigin(0.5).setDepth(102);

      resultObjects.push(background, text);

      return background;
    };

    const playAgainButton = createResultButton(590, "PLAY AGAIN");
    playAgainButton.on("pointerdown", () => {
      restartBattle();
    });

    const newBattleButton = createResultButton(665, "NEW BATTLE");
    newBattleButton.on("pointerdown", () => {
      returnToMenu();
    });

    for (const camera of this.cameras.cameras) {
      if (camera !== resultCamera) {
        camera.ignore(resultObjects);
      }
    }

    const nonResultObjects = this.children.list.filter(
      (object) => !resultObjects.includes(object),
    );

    resultCamera.ignore(nonResultObjects);
  }

  // ------------------------------------------------
  // REMOVE DEAD UNITS
  // ------------------------------------------------

  private removeDeadUnits(): void {
    const deadUnits = this.units.filter((unit) => !unit.isAlive());

    if (deadUnits.length === 0) {
      return;
    }

    for (const unit of deadUnits) {
      unit.destroy();
    }

    this.units = this.units.filter((unit) => unit.isAlive());

    this.checkBattleEnd();
  }

  // ------------------------------------------------
  // PAUSE
  // ------------------------------------------------

  private togglePause(): void {
    this.isPaused = !this.isPaused;

    const timer = this.formatDuration(this.battleElapsedSeconds);

    if (this.isPaused) {
      this.pauseButtonText.setText(`${timer} RESUME`);
    } else {
      this.pauseButtonText.setText(`${timer} PAUSE`);
    }
  }
}
