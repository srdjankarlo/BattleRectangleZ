import Phaser from "phaser";

import type { Unit } from "../units/Unit";
import {
  BATTLE_BUTTONS,
  STATS_BODY_HEIGHT,
  STATS_BODY_TOP,
  STATS_HEADER_ROWS,
  STATS_PANEL_HEIGHT,
  STATS_TABLE,
  UI_VIEWPORT,
  STATS_ROW_COLUMN_WIDTHS,
  STAT_COLORS,
} from "./BattleLayout";

export interface BattleUICallbacks {
  getUnits: () => readonly Unit[];
  getElapsedSeconds: () => number;
  isPaused: () => boolean;
  onPauseToggle: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

interface StatCell {
  background: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const STAT_COLOR_KEYS: Record<string, keyof typeof STAT_COLORS> = {
  TEAM: "IDENTITY",
  UNIT: "IDENTITY",
  MASS: "MASS",
  MS: "MOVE",
  MOVE: "MOVE",

  "HP / REG": "HP",
  ARM: "ARM",
  MR: "MR",
  SHL: "SHL",
  LS: "LS",

  BD: "BD",
  BAS: "BAS",
  AD: "AD",
  AP: "AP",

  PASS: "PASS",
  ABIL: "ABIL",
  ULT: "ULT",
};

/**
 * Owns the battle screen UI.
 *
 * This is intentionally separate from BattleScene so adding more UI later
 * does not keep making the simulation class larger.
 */
export class BattleUI {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: BattleUICallbacks;

  private pauseButtonText!: Phaser.GameObjects.Text;
  private statsHeaderContainer!: Phaser.GameObjects.Container;
  private statsValuesContainer!: Phaser.GameObjects.Container;
  private statsMaskShape!: Phaser.GameObjects.Graphics;

  private statsDragging = false;
  private statsLastPointerY = 0;
  private statsScrollOffsetY = 0;
  private statsContentHeight = 0;

  private lastDisplayedBattleSecond = -1;
  private updateTimerMs = 0;

  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  
  // Object pooling for the dynamic stat cells
  private statCells: StatCell[] = [];
  private noUnitsText?: Phaser.GameObjects.Text;

  private readonly wheelHandler = (
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (!this.isInsideStatsBody(pointer)) {
      return;
    }

    this.scrollStats(deltaY * STATS_TABLE.wheelSpeed);
  };

  private readonly pointerDownHandler = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (!this.isInsideStatsBody(pointer)) {
      return;
    }

    this.statsDragging = true;
    this.statsLastPointerY = pointer.y;
  };

  private readonly pointerMoveHandler = (
    pointer: Phaser.Input.Pointer,
  ): void => {
    if (!this.statsDragging) {
      return;
    }

    const movement = this.statsLastPointerY - pointer.y;
    this.statsLastPointerY = pointer.y;
    this.scrollStats(movement);
  };

  private readonly pointerUpHandler = (): void => {
    this.statsDragging = false;
  };

  private readonly keyDownHandler = (): void => {
    this.callbacks.onPauseToggle();
  };

  constructor(
    scene: Phaser.Scene,
    callbacks: BattleUICallbacks,
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  private getStatColors(label: string): {
    background: number;
    text: string;
  } {
    return STAT_COLORS[STAT_COLOR_KEYS[label] ?? "DEFAULT"];
  }

  private createStatCell(
    x: number,
    y: number,
    width: number,
    value: string,
    backgroundColor: number,
    textColor: string,
    depth: number,
  ): StatCell {
    const background = this.scene.add.rectangle(
      x,
      y,
      width,
      STATS_TABLE.cellHeight,
      backgroundColor,
    );

    background
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x121118, 0.7)
      .setDepth(depth);

    const text = this.scene.add.text(
      x + 5,
      y + STATS_TABLE.cellHeight / 2,
      value,
      {
        fontFamily: "monospace",
        fontSize: `${STATS_TABLE.fontSize}px`,
        fontStyle: "bold",
        color: textColor,
      },
    );

    text
      .setOrigin(0, 0.5)
      .setDepth(depth + 1);

    return { background, text };
  }

  create(
    worldCamera: Phaser.Cameras.Scene2D.Camera,
    uiCamera: Phaser.Cameras.Scene2D.Camera,
    worldObjects: Phaser.GameObjects.GameObject[],
  ): void {
    // ----------------------------------------------
    // UI BACKGROUND
    // ----------------------------------------------

    const uiBackground = this.scene.add.rectangle(
      0,
      0,
      UI_VIEWPORT.width,
      UI_VIEWPORT.height,
      0x121118,
    );

    uiBackground.setOrigin(0, 0);
    this.uiObjects.push(uiBackground);

    // ----------------------------------------------
    // BUTTON ROW COVER
    // ----------------------------------------------

    const buttonRowBgCover = this.scene.add.rectangle(
      0,
      0,
      UI_VIEWPORT.width,
      STATS_TABLE.panelTop,
      0x121118,
    );

    buttonRowBgCover.setOrigin(0, 0).setDepth(28);
    this.uiObjects.push(buttonRowBgCover);

    // ----------------------------------------------
    // BUTTONS
    // ----------------------------------------------

    const restartButton = this.createButton(
      BATTLE_BUTTONS.positions.restart,
      "RESTART",
      false,
    );
    restartButton.background.on("pointerdown", this.callbacks.onRestart);

    const pauseButton = this.createButton(
      BATTLE_BUTTONS.positions.pause,
      "00:00 PAUSE",
      true,
    );
    this.pauseButtonText = pauseButton.text;
    pauseButton.background.on("pointerdown", () => {
      this.callbacks.onPauseToggle();
      this.updatePauseButton();
    });

    const menuButton = this.createButton(
      BATTLE_BUTTONS.positions.menu,
      "MENU",
      false,
    );
    menuButton.background.on("pointerdown", this.callbacks.onMenu);

    // ----------------------------------------------
    // STATS PANEL
    // ----------------------------------------------

    const statsPanelBackground = this.scene.add.rectangle(
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

    this.uiObjects.push(statsPanelBackground);

    // ----------------------------------------------
    // FIXED TABLE HEADER
    // ----------------------------------------------

    const headerBackground = this.scene.add.rectangle(
      0,
      STATS_TABLE.panelTop,
      UI_VIEWPORT.width,
      STATS_TABLE.headerHeight,
      0x1a1924,
    );

    headerBackground.setOrigin(0, 0).setDepth(19);
    this.uiObjects.push(headerBackground);

    this.statsHeaderContainer = this.scene.add.container(
      STATS_TABLE.textX,
      STATS_TABLE.panelTop,
    );

    this.statsHeaderContainer.setDepth(20);
    this.uiObjects.push(this.statsHeaderContainer);

    let headerY = 0;

    for (let rowIndex = 0; rowIndex < STATS_HEADER_ROWS.length; rowIndex++) {
      const row = STATS_HEADER_ROWS[rowIndex];
      const widths = STATS_ROW_COLUMN_WIDTHS[rowIndex];

      let x = 0;

      for (let colIndex = 0; colIndex < row.length; colIndex++) {
        const label = row[colIndex];
        const width = widths[colIndex];

        const colors = this.getStatColors(label);

        const cell = this.createStatCell(
          x,
          headerY,
          width,
          label,
          colors.background,
          colors.text,
          20,
        );

        this.statsHeaderContainer.add([cell.background, cell.text]);

        x += width + STATS_TABLE.cellGap;
      }

      headerY += STATS_TABLE.cellHeight + STATS_TABLE.cellGap;
    }

    const headerSeparator = this.scene.add.rectangle(
      0,
      STATS_BODY_TOP,
      UI_VIEWPORT.width,
      1,
      0x4a465f,
    );

    headerSeparator.setOrigin(0, 0).setDepth(20);
    this.uiObjects.push(headerSeparator);

    // ----------------------------------------------
    // SCROLLABLE TABLE BODY
    // ----------------------------------------------

    this.statsValuesContainer = this.scene.add.container(
      STATS_TABLE.textX,
      STATS_BODY_TOP + STATS_TABLE.textTopPadding,
    );

    this.statsValuesContainer.setDepth(10);
    this.uiObjects.push(this.statsValuesContainer);

    this.statsMaskShape = this.scene.add.graphics();
    this.statsMaskShape.fillStyle(0xffffff, 1);
    this.statsMaskShape.fillRect(
      0,
      STATS_BODY_TOP,
      UI_VIEWPORT.width,
      STATS_BODY_HEIGHT,
    );
    this.statsMaskShape.setVisible(false);

    const statsMask = this.statsMaskShape.createGeometryMask();
    this.statsValuesContainer.setMask(statsMask);

    // ----------------------------------------------
    // INPUT
    // ----------------------------------------------

    this.scene.input.keyboard?.on("keydown-P", this.keyDownHandler);
    this.scene.input.on("wheel", this.wheelHandler);
    this.scene.input.on("pointerdown", this.pointerDownHandler);
    this.scene.input.on("pointermove", this.pointerMoveHandler);
    this.scene.input.on("pointerup", this.pointerUpHandler);
    this.scene.input.on("pointerupoutside", this.pointerUpHandler);

    // ----------------------------------------------
    // CAMERA FILTERING
    // ----------------------------------------------

    uiCamera.ignore(worldObjects);
    worldCamera.ignore(this.uiObjects);
    worldCamera.ignore([this.statsMaskShape]);

    this.updatePauseButton();
    this.updateStats();

    this.scene.events.once(
      Phaser.Scenes.Events.SHUTDOWN,
      this.destroy,
      this,
    );
  }

  update(deltaMs: number): void {
    const wholeSecond = Math.floor(
      this.callbacks.getElapsedSeconds(),
    );

    if (wholeSecond !== this.lastDisplayedBattleSecond) {
      this.lastDisplayedBattleSecond = wholeSecond;
      this.updatePauseButton();
    }

    this.updateTimerMs += deltaMs;

    if (this.updateTimerMs >= STATS_TABLE.updateIntervalMs) {
      this.updateTimerMs = 0;
      this.updateStats();
    }
  }

  updatePauseButton(): void {
    if (!this.pauseButtonText) {
      return;
    }

    const timer = this.formatDuration(
      this.callbacks.getElapsedSeconds(),
    );

    const action = this.callbacks.isPaused()
      ? "RESUME"
      : "PAUSE";

    this.pauseButtonText.setText(
      `${timer} ${action}`,
    );
  }

  private createButton(
    x: number,
    label: string,
    isPauseButton: boolean,
  ): {
    background: Phaser.GameObjects.Rectangle;
    text: Phaser.GameObjects.Text;
  } {
    const background = this.scene.add.rectangle(
      x,
      BATTLE_BUTTONS.y,
      BATTLE_BUTTONS.width,
      BATTLE_BUTTONS.height,
      BATTLE_BUTTONS.colors.fill,
    );

    background
      .setOrigin(0.5, 0.5)
      .setStrokeStyle(2, BATTLE_BUTTONS.colors.stroke)
      .setInteractive({ useHandCursor: true })
      .setDepth(30);

    const text = this.scene.add.text(
      x,
      BATTLE_BUTTONS.y,
      label,
      {
        fontSize: isPauseButton ? "18px" : "20px",
        fontStyle: "bold",
        color: "#ffffff",
      },
    );

    text.setOrigin(0.5, 0.5).setDepth(31);

    this.uiObjects.push(background, text);

    return { background, text };
  }

  private updateStats(): void {
    const units = this.callbacks.getUnits();
    const nameCounts = new Map<string, number>();

    for (const unit of units) {
      nameCounts.set(
        unit.name,
        (nameCounts.get(unit.name) ?? 0) + 1,
      );
    }

    let cellIndex = 0;
    let currentY = 0;

    for (const unit of units) {
      const duplicate = (nameCounts.get(unit.name) ?? 0) > 1;
      const unitName = duplicate
        ? `${unit.name} ${unit.instanceNumber}`
        : unit.name;

      const stats = unit.config.stats;
      const hp = `${unit.getHealth().toFixed(1)}/${unit.getMaxHealth().toFixed(0)} +${(stats.healthRegeneration ?? 0).toString()}`;
      const armor = stats.armor?.toString() ?? "-";
      const magicResistance = stats.magicResistance?.toString() ?? "-";
      const shield = unit.getMaxShield() > 0
          ? `${unit.getShield().toFixed(1)}/${unit.getMaxShield().toFixed(0)}`
          : "-";
      const lifeSteal = stats.lifeSteal !== undefined && stats.lifeSteal > 0
          ? `${stats.lifeSteal}%`
          : "-";

      const currentSpeed = Math.hypot(
        unit.physics.getVelocityX(),
        unit.physics.getVelocityY(),
      );
      const movementType =
        unit.config.movementType.charAt(0).toUpperCase() +
        unit.config.movementType.slice(1);

      // Pre-calculate the values matching our headers
      const rowValues = [
        [`${unit.teamId}`, unitName, `${stats.mass}`, `${currentSpeed.toFixed(0)}`, movementType],
        [hp, armor, magicResistance, shield, lifeSteal],
        [stats.bodyDamage.toString(), stats.bodyAttackSpeed.toString(), "-", "-"],
        ["-", "-", "-"],
      ];

      for (let rowIndex = 0; rowIndex < STATS_HEADER_ROWS.length; rowIndex++) {
        const widths = STATS_ROW_COLUMN_WIDTHS[rowIndex];
        const labels = STATS_HEADER_ROWS[rowIndex];
        const values = rowValues[rowIndex];
        let currentX = 0;

        for (let colIndex = 0; colIndex < widths.length; colIndex++) {
          const width = widths[colIndex];
          const label = labels[colIndex];
          const value = values[colIndex] ?? "-";
          const colors = this.getStatColors(label);

          if (cellIndex < this.statCells.length) {
            // Reuse existing cell
            const cell = this.statCells[cellIndex];
            cell.background.setPosition(currentX, currentY);
            cell.background.setFillStyle(colors.background);
            cell.background.setSize(width, STATS_TABLE.cellHeight);
            
            cell.text.setPosition(currentX + 5, currentY + STATS_TABLE.cellHeight / 2);
            cell.text.setText(value);
            cell.text.setColor(colors.text);
            
            cell.background.setVisible(true);
            cell.text.setVisible(true);
          } else {
            // Instantiate new cell
            const cell = this.createStatCell(
              currentX,
              currentY,
              width,
              value,
              colors.background,
              colors.text,
              10
            );
            this.statsValuesContainer.add([cell.background, cell.text]);
            this.statCells.push(cell);
          }

          currentX += width + STATS_TABLE.cellGap;
          cellIndex++;
        }
        currentY += STATS_TABLE.cellHeight + STATS_TABLE.cellGap;
      }
      currentY += STATS_TABLE.unitGap ?? 5;
    }

    // Hide any unused objects inside the object pool
    for (let i = cellIndex; i < this.statCells.length; i++) {
      this.statCells[i].background.setVisible(false);
      this.statCells[i].text.setVisible(false);
    }

    // Handle No Units state
    if (units.length === 0) {
      if (!this.noUnitsText) {
        this.noUnitsText = this.scene.add.text(0, 0, "NO UNITS REMAINING", {
          fontFamily: "monospace",
          fontSize: `${STATS_TABLE.fontSize}px`,
          fontStyle: "bold",
          color: "#ffffff",
        }).setDepth(10);
        this.statsValuesContainer.add(this.noUnitsText);
      }
      this.noUnitsText.setVisible(true);
      this.statsContentHeight = this.noUnitsText.height + STATS_TABLE.panelBottomPadding;
    } else {
      if (this.noUnitsText) {
        this.noUnitsText.setVisible(false);
      }
      this.statsContentHeight = currentY + STATS_TABLE.panelBottomPadding;
    }

    this.statsScrollOffsetY = Phaser.Math.Clamp(
      this.statsScrollOffsetY,
      0,
      this.getStatsMaximumScroll(),
    );

    this.updateStatsTextPosition();
  }

  private getStatsMaximumScroll(): number {
    return Math.max(
      0,
      this.statsContentHeight - STATS_BODY_HEIGHT,
    );
  }

  private updateStatsTextPosition(): void {
    // Scroll the container instead of text lines
    this.statsValuesContainer.y =
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

  private isInsideStatsBody(
    pointer: Phaser.Input.Pointer,
  ): boolean {
    const bodyTopOnScreen =
      UI_VIEWPORT.y + STATS_BODY_TOP;

    const bodyBottomOnScreen =
      bodyTopOnScreen + STATS_BODY_HEIGHT;

    return (
      pointer.y >= bodyTopOnScreen &&
      pointer.y <= bodyBottomOnScreen
    );
  }

  private formatDuration(totalSeconds: number): string {
    const total = Math.floor(totalSeconds);
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;

    return `${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  destroy(): void {
    this.scene.input.keyboard?.off("keydown-P", this.keyDownHandler);
    this.scene.input.off("wheel", this.wheelHandler);
    this.scene.input.off("pointerdown", this.pointerDownHandler);
    this.scene.input.off("pointermove", this.pointerMoveHandler);
    this.scene.input.off("pointerup", this.pointerUpHandler);
    this.scene.input.off("pointerupoutside", this.pointerUpHandler);

    if (this.statsMaskShape) {
      this.statsMaskShape.destroy();
    }
  }
}