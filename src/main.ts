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
    width: 540,
    height: 900,
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

  // Battle status
  private statsLabelsText!: Phaser.GameObjects.Text;
  private statsValuesText!: Phaser.GameObjects.Text;
  private statsLabelsBackground!: Phaser.GameObjects.Rectangle;

  private statsDragging = false;
  private statsLastPointerX = 0;

  private statsScrollOffsetX = 0;
  private readonly uiViewportTop = 520;
  private readonly uiViewportHeight = 380;

  private battleElapsedSeconds = 0;
  private battleFinished = false;
  private initialTeamCount = 0;

  private uiUpdateTimer = 0;

  constructor() {
    super("BattleBallzScene");
  }

  private scrollStats(amount: number): void {
    const viewportWidth = 444;

    const maximumScroll = Math.max(
      0,
      this.statsValuesText.width - viewportWidth,
    );

    this.statsScrollOffsetX = Phaser.Math.Clamp(
      this.statsScrollOffsetX + amount,
      0,
      maximumScroll,
    );

    this.statsValuesText.x = 96 - this.statsScrollOffsetX;
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
    // Preload UI icons
    this.load.image("icon-hp", "assets/icons/HP.png");
    this.load.image("icon-arm", "assets/icons/ARM1.png");
    this.load.image("icon-ad", "assets/icons/AD.png");

    // Preload character unit icon images
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
    this.statsScrollOffsetX = 0;
    this.statsDragging = false;
    this.statsLastPointerX = 0;

    this.battleElapsedSeconds = 0;
    this.battleFinished = false;
    this.initialTeamCount = activeBattleSetup.teams.length;

    this.arenaWidth = activeBattleSetup.arenaWidth;
    this.arenaHeight = activeBattleSetup.arenaHeight;

    const worldObjects: Phaser.GameObjects.GameObject[] = [];
    const uiObjects: Phaser.GameObjects.GameObject[] = [];

    // ----------------------------------------------
    // WORLD CAMERA
    // ----------------------------------------------

    const worldCamera = this.cameras.main;
    const worldViewportWidth = 540;
    const worldViewportHeight = 520;

    worldCamera.setViewport(0, 0, worldViewportWidth, worldViewportHeight);

    // Zoom camera so arena width fills maximum available viewport width
    const padding = 12;
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
        
        // Push unit game objects into worldObjects so uiCamera ignores them
        worldObjects.push(unit.sprite, unit.healthBarBg, unit.healthBarFill);
      }
    }

    // ----------------------------------------------
    // UI CAMERA
    // ----------------------------------------------

    const uiCamera = this.cameras.add(
      0,
      this.uiViewportTop,
      540,
      this.uiViewportHeight,
    );

    uiCamera.setScroll(0, 0);

    // ----------------------------------------------
    // UI BACKGROUND
    // ----------------------------------------------

    const uiBackground = this.add.rectangle(
      0,
      0,
      540,
      this.uiViewportHeight,
      0x121118,
    );

    uiBackground.setOrigin(0, 0);
    uiObjects.push(uiBackground);

    // ----------------------------------------------
    // BUTTON ROW
    // ----------------------------------------------

    const buttonY = 44;
    const buttonWidth = 145;
    const buttonHeight = 44;

    const createButton = (
      x: number,
      label: string,
    ): {
      background: Phaser.GameObjects.Rectangle;
      text: Phaser.GameObjects.Text;
    } => {
      const background = this.add.rectangle(
        x,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x2e2a40,
      );

      background
        .setOrigin(0.5, 0.5)
        .setStrokeStyle(2, 0x6f53ff)
        .setInteractive({ useHandCursor: true });

      const text = this.add.text(x, buttonY, label, {
        fontSize: "20px",
        fontStyle: "bold",
        color: "#ffffff",
      });

      text.setOrigin(0.5, 0.5);

      uiObjects.push(background, text);

      return { background, text };
    };

    // RESTART
    const restartButton = createButton(85, "RESTART");
    this.restartButtonBackground = restartButton.background;
    this.restartButtonBackground.on("pointerdown", () => {
      restartBattle();
    });

    // PAUSE
    const pauseButton = createButton(270, "PAUSE");
    this.pauseButtonBackground = pauseButton.background;
    this.pauseButtonText = pauseButton.text;
    this.pauseButtonBackground.on("pointerdown", () => {
      this.togglePause();
    });

    // MENU
    const menuButton = createButton(455, "MENU");
    menuButton.background.on("pointerdown", () => {
      returnToMenu();
    });

    // ----------------------------------------------
    // RUNNING / PAUSED STATUS
    // ----------------------------------------------

    this.pauseStatusText = this.add.text(270, 70, "RUNNING", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#a0a0b8",
    });

    this.pauseStatusText.setOrigin(0.5, 0);
    uiObjects.push(this.pauseStatusText);

    // ----------------------------------------------
    // STATS PANEL
    // ----------------------------------------------

    const statsPanelTop = 105;
    const statsPanelHeight = 265;

    const statsPanelBackground = this.add.rectangle(
      0,
      statsPanelTop,
      540,
      statsPanelHeight,
      0x1a1924,
    );

    statsPanelBackground.setOrigin(0, 0).setStrokeStyle(2, 0x3d3954);

    uiObjects.push(statsPanelBackground);

    // ----------------------------------------------
    // FIXED STAT LABELS
    // ----------------------------------------------

    this.statsLabelsText = this.add.text(
      10,
      statsPanelTop + 12,
      [
        "TEAM",
        "UNIT",
        "HP",
        "ARM",
        "MR",
        "SHLD",
        "AD",
        "MS",
        "MASS",
        "MOVE",
      ].join("\n"),
      {
        fontFamily: "monospace",
        fontSize: "18px",
        color: "#ffffff",
        lineSpacing: 6,
      },
    );

    uiObjects.push(this.statsLabelsText);
    this.statsLabelsText.setDepth(10);

    // ----------------------------------------------
    // SCROLLABLE UNIT COLUMNS
    // ----------------------------------------------

    this.statsValuesText = this.add.text(96, statsPanelTop + 12, "", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#eeeeee",
      lineSpacing: 6,
    });

    uiObjects.push(this.statsValuesText);

    const statsMaskShape = new Phaser.GameObjects.Graphics(this);
    statsMaskShape.fillStyle(0xffffff, 1);
    statsMaskShape.fillRect(96, statsPanelTop, 444, statsPanelHeight);

    const statsMask = statsMaskShape.createGeometryMask();
    this.statsValuesText.setMask(statsMask);

    this.statsLabelsBackground = this.add.rectangle(
      0,
      statsPanelTop,
      96,
      statsPanelHeight,
      0x1a1924,
    );

    this.statsLabelsBackground.setOrigin(0, 0).setDepth(20);

    uiObjects.push(this.statsLabelsBackground);

    this.statsLabelsText.setDepth(21);
    this.statsLabelsBackground.setDepth(20);

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

    this.input.on(
      "wheel",
      (
        pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number,
      ) => {
        if (!pointer.event.shiftKey) {
          return;
        }

        if (
          pointer.y < this.uiViewportTop + statsPanelTop ||
          pointer.y > this.uiViewportTop + statsPanelTop + statsPanelHeight
        ) {
          return;
        }

        this.scrollStats(deltaY);
      },
    );

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (
        pointer.y >= this.uiViewportTop + statsPanelTop &&
        pointer.y <= this.uiViewportTop + statsPanelTop + statsPanelHeight
      ) {
        this.statsDragging = true;
        this.statsLastPointerX = pointer.x;
      }
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.statsDragging) {
        return;
      }

      const movement = this.statsLastPointerX - pointer.x;
      this.statsLastPointerX = pointer.x;
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

      for (const unit of this.units) {
        unit.update(deltaSeconds);
      }

      for (let i = 0; i < this.units.length; i++) {
        for (let j = i + 1; j < this.units.length; j++) {
          this.units[i].resolveCollision(this.units[j]);
        }
      }

      this.removeDeadUnits();

      // Throttle UI update to 10 FPS (100ms interval)
      this.uiUpdateTimer += delta;
      if (this.uiUpdateTimer >= 100) {
        this.updateStatus();
        this.uiUpdateTimer = 0;
      }
    }
  }

  // ------------------------------------------------
  // STATUS
  // ------------------------------------------------

  private updateStatus(): void {
    const rows: string[][] = Array.from({ length: 10 }, () => []);

    for (const unit of this.units) {
      const sameNameCount = this.units.filter((u) => u.name === unit.name).length;
      const displayName =
        sameNameCount > 1 ? `${unit.name} #${unit.instanceNumber}` : unit.name;
      const stats = unit.config.stats;

      rows[0].push(unit.teamId.toString());
      rows[1].push(displayName);
      rows[2].push(`${unit.getHealth().toFixed(1)}/${unit.getMaxHealth().toFixed(1)}`);
      rows[3].push(stats.armor.toString());
      rows[4].push(stats.magicResistance.toString());
      rows[5].push(
        stats.maxShield > 0
          ? `${unit.getShield().toFixed(1)}/${unit.getMaxShield().toFixed(1)}`
          : "0.0/0.0",
      );
      rows[6].push(stats.bodyAttackDamage.toString());
      rows[7].push(stats.speed.toString());
      rows[8].push(stats.mass.toString());
      rows[9].push(unit.config.movementType.toUpperCase());
    }

    const COLUMN_WIDTH = 18;

    const formattedLines = rows.map((rowValues) => {
      return rowValues
        .map((val) => val.slice(0, COLUMN_WIDTH).padEnd(COLUMN_WIDTH, " "))
        .join("");
    });

    this.statsValuesText.setText(formattedLines.join("\n"));
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

    const resultCamera = this.cameras.add(0, 0, 540, 900);
    resultCamera.setScroll(0, 0);

    const overlay = this.add.rectangle(270, 450, 540, 900, 0x07070b, 0.97);
    overlay.setDepth(100);
    resultObjects.push(overlay);

    const title = this.add.text(270, 100, "BATTLE OVER", {
      fontSize: "34px",
      fontStyle: "bold",
      color: "#ffffff",
    });
    title.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(title);

    const resultText =
      winningTeamId === null ? "DRAW" : `TEAM ${winningTeamId} WINS`;

    const result = this.add.text(270, 165, resultText, {
      fontSize: "30px",
      fontStyle: "bold",
      color: "#a98cff",
    });
    result.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(result);

    const duration = this.add.text(
      270,
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

    const survivorsTitle = this.add.text(270, 310, "SURVIVORS", {
      fontSize: "18px",
      fontStyle: "bold",
      color: "#8e8aa3",
    });
    survivorsTitle.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(survivorsTitle);

    const survivorsList = this.add.text(270, 345, survivorText, {
      fontFamily: "monospace",
      fontSize: "19px",
      color: "#ffffff",
      align: "center",
      lineSpacing: 8,
    });
    survivorsList.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(survivorsList);

    const createResultButton = (
      y: number,
      label: string,
    ): Phaser.GameObjects.Rectangle => {
      const background = this.add.rectangle(270, y, 260, 56, 0x2e2a40);
      background
        .setStrokeStyle(2, 0x6f53ff)
        .setInteractive({ useHandCursor: true })
        .setDepth(101);

      const text = this.add.text(270, y, label, {
        fontSize: "21px",
        fontStyle: "bold",
        color: "#ffffff",
      });
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

    if (this.isPaused) {
      this.pauseStatusText.setText("PAUSED — tap Resume");
      this.pauseButtonText.setText("RESUME");
    } else {
      this.pauseStatusText.setText("RUNNING — tap Pause");
      this.pauseButtonText.setText("PAUSE");
    }
  }
}