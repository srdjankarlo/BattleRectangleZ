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
  STATS_TOP_ROW_COLUMN_WIDTHS,
  STATS_BOTTOM_ROW_COLUMN_WIDTHS
} from "./BattleLayout";

export interface BattleUICallbacks {
  getUnits: () => readonly Unit[];
  getElapsedSeconds: () => number;
  isPaused: () => boolean;
  onPauseToggle: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

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
  private statsHeaderText!: Phaser.GameObjects.Text;
  private statsValuesText!: Phaser.GameObjects.Text;

  private statsMaskShape!: Phaser.GameObjects.Graphics;

  private statsDragging = false;
  private statsLastPointerY = 0;
  private statsScrollOffsetY = 0;
  private statsContentHeight = 0;

  private lastDisplayedBattleSecond = -1;
  private updateTimerMs = 0;
  private lastStatsText = "";

  private uiObjects: Phaser.GameObjects.GameObject[] = [];

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

    const formatCell = (
      value: string,
      width: number = STATS_TABLE.columnWidth,
    ): string =>
      value
        .slice(0, width)
        .padEnd(width, " ");

    // Split header rows
    const topHeaderRows = STATS_HEADER_ROWS.slice(0, 2);
    const bottomHeaderRows = STATS_HEADER_ROWS.slice(2);

    // Format top two rows using STATS_TOP_ROW_COLUMN_WIDTHS
    const topLines = topHeaderRows.map((row) =>
      row
        .map((label, colIndex) =>
          formatCell(
            label,
            STATS_TOP_ROW_COLUMN_WIDTHS[colIndex] ?? STATS_TABLE.columnWidth,
          ),
        )
        .join(""),
    );

    // Format last two rows using standard STATS_TABLE.columnWidth
    const bottomLines = bottomHeaderRows.map((row) =>
      row.map((label, colIndex) => formatCell(
        label,
        STATS_BOTTOM_ROW_COLUMN_WIDTHS[colIndex] ?? STATS_TABLE.columnWidth)).join(""),
    );

    // Combine all lines
    const headerText = [...topLines, ...bottomLines].join("\n");

    this.statsHeaderText = this.scene.add.text(
      STATS_TABLE.textX,
      STATS_TABLE.panelTop,
      headerText,
      {
        fontFamily: "monospace",
        fontSize: `${STATS_TABLE.fontSize}px`,
        fontStyle: "bold",
        color: "#ffffff",
        lineSpacing: STATS_TABLE.lineSpacing,
      },
    );

    this.statsHeaderText.setDepth(20);
    this.uiObjects.push(this.statsHeaderText);

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

    this.statsValuesText = this.scene.add.text(
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
    this.uiObjects.push(this.statsValuesText);

    // Phaser version compatibility: create the mask with add.graphics()
    // instead of relying on make.graphics({ add: false }).
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
    this.statsValuesText.setMask(statsMask);

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

    // Make sure the scene removes the input listeners on restart.
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

    const formatCell = (
      value: string,
      width: number = STATS_TABLE.columnWidth,
    ): string =>
        value
        .slice(0, width)
        .padEnd(width, " ");

    const lines: string[] = [];

    for (const unit of units) {
      const duplicate =
        (nameCounts.get(unit.name) ?? 0) > 1;

      const unitName = duplicate
        ? `${unit.name} ${unit.instanceNumber}`
        : unit.name;

      // const teamUnit = `${unit.teamId}/${unitName}`;
      const stats = unit.config.stats;

      const hp =
        `${unit.getHealth().toFixed(2)}/${unit.getMaxHealth().toFixed(0)}`;

      const shield =
        `${unit.getShield().toFixed(1)}/${unit.getMaxShield().toFixed(0)}`;

      const movementName =
        unit.config.movementType.charAt(0).toUpperCase() +
        unit.config.movementType.slice(1);

      const baseMovement =
        `${stats.speed}`;

      const currentSpeed = Math.hypot(
        unit.physics.getVelocityX(),
        unit.physics.getVelocityY(),
      );

      const currentMovement =
        `${currentSpeed.toFixed(0)}`;

      // Keep the three data rows aligned with the fixed three-row header.
      // MOVE uses the same column to show the configured/base movement on
      // the top row and the current physics speed on the bottom row.
      lines.push(
        formatCell(`${unit.teamId}`, STATS_TOP_ROW_COLUMN_WIDTHS[0]) +
        formatCell(`${unitName}`, STATS_TOP_ROW_COLUMN_WIDTHS[1]) +
        formatCell(`${stats.mass}`, STATS_TOP_ROW_COLUMN_WIDTHS[2]),
          
        formatCell("ToDo", STATS_TOP_ROW_COLUMN_WIDTHS[0]) +
          formatCell("ToDo", STATS_TOP_ROW_COLUMN_WIDTHS[1]) +
          formatCell("ToDo", STATS_TOP_ROW_COLUMN_WIDTHS[2]),

        formatCell(hp) +
          formatCell(stats.armor.toString()) +
          formatCell(stats.magicResistance.toString()) +
          formatCell(shield),

        formatCell(`${stats.bodyDamage.toString()}/${stats.bodyAttackSpeed.toFixed(2).toString()}`) +
          formatCell("ToDo") +
          formatCell("ToDo") +
          formatCell(`${currentMovement}/${baseMovement} ${movementName}`),

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

    // Use Phaser's actual rendered text height instead of estimating the
    // content height from fontSize + lineSpacing. Font metrics can differ
    // between browsers/devices, and an underestimate leaves the final unit
    // partially clipped when the list reaches maximum scroll.
    this.statsContentHeight =
      Math.ceil(this.statsValuesText.height) +
      STATS_TABLE.textTopPadding +
      STATS_TABLE.panelBottomPadding;

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
