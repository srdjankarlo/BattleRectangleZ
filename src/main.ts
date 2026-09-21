import Phaser from "phaser";
import "./style.css";

import { GameMenu } from "./GameMenu";
import type { BattleSetup, UnitSelection } from "./GameSetup";
import { Unit } from "./units/Unit";
import { Characters } from "./characters/Characters";
import type { UnitConfig } from "./units/UnitConfig";
import type { MovementType } from "./units/Movement";

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
    width: 960,
    height: 960,
    backgroundColor: "#0b0b0b",
    parent: "game-container",
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

  private pauseStatusText!: Phaser.GameObjects.Text;
  private pauseButtonBackground!: Phaser.GameObjects.Rectangle;
  private pauseButtonText!: Phaser.GameObjects.Text;
  private restartButtonBackground!: Phaser.GameObjects.Rectangle;
  private restartButtonText!: Phaser.GameObjects.Text;

  // Battle status
  private statusText!: Phaser.GameObjects.Text;

  private statusScrollOffset = 0;
  private readonly uiViewportTop = 520;
  private readonly uiViewportHeight = 440;

  private readonly statusPanelTop = 110;
  private readonly statusPanelHeight = 310;

  private statusContentHeight = 0;
  private statusMask!: Phaser.Display.Masks.GeometryMask;

  // Touch drag for mobile
  private statusDragging = false;
  private statusLastPointerY = 0;

  constructor() {
    super("BattleBallzScene");
  }

  private scrollStatus(amount: number): void {
    const maximumScroll = Math.max(
      0,
      this.statusContentHeight - this.statusPanelHeight + 20,
    );

    this.statusScrollOffset = Phaser.Math.Clamp(
      this.statusScrollOffset + amount * 0.8,
      0,
      maximumScroll,
    );

    this.statusText.y = this.statusPanelTop + 12 - this.statusScrollOffset;
  }

  // ------------------------------------------------
  // CREATE
  // ------------------------------------------------

  create(): void {
    if (!activeBattleSetup) {
      returnToMenu();
      return;
    }

    // Clean up lingering secondary cameras from previous restarts
    for (const camera of [...this.cameras.cameras]) {
      if (camera !== this.cameras.main) {
        this.cameras.remove(camera, true);
      }
    }

    // Reset scene state
    this.units = [];
    this.unitCounters.clear();
    this.isPaused = false;
    this.statusScrollOffset = 0;
    this.statusContentHeight = 0;
    this.statusDragging = false;
    this.statusLastPointerY = 0;

    this.arenaWidth = activeBattleSetup.arenaWidth;
    this.arenaHeight = activeBattleSetup.arenaHeight;

    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    const uiObjects: Phaser.GameObjects.GameObject[] = [];

    // ----------------------------------------------
    // WORLD CAMERA (ARENA MATCHES FULL PHONE WIDTH)
    // ----------------------------------------------

    const worldCamera = this.cameras.main;
    const worldViewportWidth = 960;
    const worldViewportHeight = 520;

    worldCamera.setViewport(0, 0, worldViewportWidth, worldViewportHeight);

    // Zoom camera so arena width fills maximum available viewport width
    const padding = 16;
    const availableWidth = worldViewportWidth - padding;
    const availableHeight = worldViewportHeight - padding;

    const fitZoom = Math.min(
      availableWidth / this.arenaWidth,
      availableHeight / this.arenaHeight,
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
        worldObjects.push(unit.sprite, unit.healthCircle);
      }
    }

    // ----------------------------------------------
    // UI CAMERA (3X LARGER TOUCH CONTROLS & TEXT)
    // ----------------------------------------------

    const uiCamera = this.cameras.add(
      0,
      this.uiViewportTop,
      960,
      this.uiViewportHeight,
    );

    uiCamera.setScroll(0, 0);

    // UI Background
    const uiBackground = this.add.rectangle(
      0,
      0,
      960,
      this.uiViewportHeight,
      0x121118,
    );
    uiBackground.setOrigin(0, 0);
    uiObjects.push(uiBackground);

    // Status Panel Frame
    const statusPanelBackground = this.add.rectangle(
      0,
      this.statusPanelTop,
      960,
      this.statusPanelHeight,
      0x1a1924,
    );
    statusPanelBackground.setOrigin(0, 0).setStrokeStyle(2, 0x3d3954);
    uiObjects.push(statusPanelBackground);

    // 3X Header Text
    const title = this.add.text(18, 16, "BATTLE STATUS", {
      fontSize: "36px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    uiObjects.push(title);

    this.pauseStatusText = this.add.text(18, 62, "RUNNING — tap P / Pause", {
      fontSize: "24px",
      color: "#a0a0b8",
    });
    uiObjects.push(this.pauseStatusText);

    // 3X Status Log Text
    this.statusText = this.add.text(18, this.statusPanelTop + 12, "", {
      fontFamily: "monospace",
      fontSize: "28px",
      color: "#eeeeee",
      lineSpacing: 8,
    });
    uiObjects.push(this.statusText);

    // Status Mask
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(0, this.statusPanelTop, 960, this.statusPanelHeight);

    this.statusMask = maskShape.createGeometryMask();
    this.statusText.setMask(this.statusMask);

    // ----------------------------------------------
    // LARGE MOBILE TOUCH BUTTONS
    // ----------------------------------------------

    // RESTART BUTTON
    this.restartButtonBackground = this.add.rectangle(
      520,
      48,
      170,
      64,
      0x2e2a40,
    );
    this.restartButtonBackground.setOrigin(0.5, 0.5);
    this.restartButtonBackground.setStrokeStyle(2, 0x6f53ff);
    this.restartButtonBackground.setInteractive({ useHandCursor: true });
    uiObjects.push(this.restartButtonBackground);

    this.restartButtonText = this.add.text(520, 48, "RESTART", {
      fontSize: "26px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    this.restartButtonText.setOrigin(0.5, 0.5);
    uiObjects.push(this.restartButtonText);

    this.restartButtonBackground.on("pointerdown", () => {
      restartBattle();
    });

    // PAUSE BUTTON
    this.pauseButtonBackground = this.add.rectangle(
      710,
      48,
      170,
      64,
      0x2e2a40,
    );
    this.pauseButtonBackground.setOrigin(0.5, 0.5);
    this.pauseButtonBackground.setStrokeStyle(2, 0x6f53ff);
    this.pauseButtonBackground.setInteractive({ useHandCursor: true });
    uiObjects.push(this.pauseButtonBackground);

    this.pauseButtonText = this.add.text(710, 48, "PAUSE", {
      fontSize: "26px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    this.pauseButtonText.setOrigin(0.5, 0.5);
    uiObjects.push(this.pauseButtonText);

    this.pauseButtonBackground.on("pointerdown", () => {
      this.togglePause();
    });

    // MENU BUTTON
    const menuButtonBackground = this.add.rectangle(
      885,
      48,
      130,
      64,
      0x2e2a40,
    );
    menuButtonBackground.setOrigin(0.5, 0.5);
    menuButtonBackground.setStrokeStyle(2, 0x6f53ff);
    menuButtonBackground.setInteractive({ useHandCursor: true });
    uiObjects.push(menuButtonBackground);

    const menuButtonText = this.add.text(885, 48, "MENU", {
      fontSize: "26px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    menuButtonText.setOrigin(0.5, 0.5);
    uiObjects.push(menuButtonText);

    menuButtonBackground.on("pointerdown", () => {
      returnToMenu();
    });

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
    // INITIAL STATUS & TOUCH SCROLLING
    // ----------------------------------------------

    this.updateStatus();

    const statusPanelScreenTop = this.uiViewportTop + this.statusPanelTop;
    const statusPanelScreenBottom =
      statusPanelScreenTop + this.statusPanelHeight;

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
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

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.y >= statusPanelScreenTop &&
        pointer.y <= statusPanelScreenBottom
      ) {
        this.statusDragging = true;
        this.statusLastPointerY = pointer.y;
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.statusDragging) {
        return;
      }

      const movement = this.statusLastPointerY - pointer.y;
      this.statusLastPointerY = pointer.y;

      this.scrollStatus(movement);
    });

    this.input.on("pointerup", () => {
      this.statusDragging = false;
    });

    this.input.on("pointerupoutside", () => {
      this.statusDragging = false;
    });
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

    const position = this.getSpawnPosition(
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

    if (!this.isPaused) {
      for (const unit of this.units) {
        unit.update(deltaSeconds);
      }

      for (let i = 0; i < this.units.length; i++) {
        for (let j = i + 1; j < this.units.length; j++) {
          this.units[i].resolveCollision(this.units[j]);
        }
      }

      this.removeDeadUnits();
    }

    this.updateStatus();
  }

  // ------------------------------------------------
  // STATUS
  // ------------------------------------------------

  // ------------------------------------------------
  // STATUS
  // ------------------------------------------------

  private updateStatus(): void {
    // 1. Column Header (Single Row)
    const headers = [
      "TEAM".padEnd(5),
      "UNIT".padEnd(12),
      "HP".padEnd(14),
      "ARM".padEnd(5),
      "MR".padEnd(5),
      "SHLD".padEnd(14),
      "AD".padEnd(5),
      "MS".padEnd(5),
      "MASS".padEnd(5),
      "MOVE",
    ];

    const lines: string[] = [headers.join("")];

    // 2. Unit Rows (Single Row per Unit)
    for (const unit of this.units) {
      const sameNameCount = this.units.filter(
        (other) => other.name === unit.name,
      ).length;

      const displayName =
        sameNameCount > 1
          ? `${unit.name} #${unit.instanceNumber}`
          : unit.name;

      const stats = unit.config.stats;

      // HP & Shield formatted to 2 decimal places
      const hpStr = `${unit.getHealth().toFixed(2)}/${unit.getMaxHealth().toFixed(2)}`;
      const shldStr =
        stats.maxShield > 0
          ? `${unit.getShield().toFixed(2)}/${unit.getMaxShield().toFixed(2)}`
          : "0.00/0.00";

      const armStr = stats.armor > 0 ? stats.armor.toString() : "0";
      const mrStr = stats.magicResistance > 0 ? stats.magicResistance.toString() : "0";
      const adStr = stats.bodyAttackDamage.toString();
      const msStr = stats.speed.toString();
      const massStr = stats.mass.toString();
      const moveStr = unit.config.movementType.toUpperCase();

      const row = [
        unit.teamId.toString().padEnd(5),
        displayName.slice(0, 11).padEnd(12),
        hpStr.padEnd(14),
        armStr.padEnd(5),
        mrStr.padEnd(5),
        shldStr.padEnd(14),
        adStr.padEnd(5),
        msStr.padEnd(5),
        massStr.padEnd(5),
        moveStr,
      ];

      lines.push(row.join(""));
    }

    if (this.units.length === 0) {
      lines.push("", "NO UNITS REMAINING");
    }

    this.statusText.setText(lines.join("\n"));

    // Set font size so all 10 columns fit in a single line across the 960px screen
    this.statusText.setFontSize("18px");

    const lineHeight = 26;
    this.statusContentHeight = lines.length * lineHeight;

    this.statusScrollOffset = Phaser.Math.Clamp(
      this.statusScrollOffset,
      0,
      Math.max(0, this.statusContentHeight - this.statusPanelHeight + 20),
    );

    this.statusText.y =
      this.statusPanelTop + 12 - this.statusScrollOffset;
  }

  // ------------------------------------------------
  // DEAD UNITS
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
  }

  // ------------------------------------------------
  // PAUSE
  // ------------------------------------------------

  private togglePause(): void {
    this.isPaused = !this.isPaused;

    if (this.isPaused) {
      this.pauseStatusText.setText("PAUSED — tap Resume");
      this.pauseButtonText.setText("RESUME");
    } else {
      this.pauseStatusText.setText("RUNNING — tap Pause");
      this.pauseButtonText.setText("PAUSE");
    }
  }
}