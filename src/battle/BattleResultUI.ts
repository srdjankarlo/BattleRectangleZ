import Phaser from "phaser";

import type { Unit } from "../units/Unit";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
} from "./BattleLayout";

export interface BattleResultCallbacks {
  getElapsedSeconds: () => number;
  onRestart: () => void;
  onMenu: () => void;
}

/**
 * Owns the end-of-battle overlay and result actions.
 * Keeping this separate prevents BattleUI from becoming another giant class.
 */
export class BattleResultUI {
  private readonly scene: Phaser.Scene;
  private readonly callbacks: BattleResultCallbacks;

  constructor(
    scene: Phaser.Scene,
    callbacks: BattleResultCallbacks,
  ) {
    this.scene = scene;
    this.callbacks = callbacks;
  }

  show(
    winningTeamId: number | null,
    units: readonly Unit[],
  ): void {
    const resultObjects: Phaser.GameObjects.GameObject[] = [];

    const resultCamera = this.scene.cameras.add(
      0,
      0,
      GAME_WIDTH,
      GAME_HEIGHT,
    );

    resultCamera.setScroll(0, 0);

    const overlay = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      GAME_WIDTH,
      GAME_HEIGHT,
      0x07070b,
      0.97,
    );

    overlay.setDepth(100);
    resultObjects.push(overlay);

    const title = this.scene.add.text(
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
      winningTeamId === null
        ? "DRAW"
        : `TEAM ${winningTeamId} WINS`;

    const result = this.scene.add.text(
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

    const duration = this.scene.add.text(
      GAME_WIDTH / 2,
      230,
      `DURATION\n${this.formatDuration(
        this.callbacks.getElapsedSeconds(),
      )}`,
      {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#eeeeee",
        align: "center",
      },
    );

    duration.setOrigin(0.5, 0).setDepth(101);
    resultObjects.push(duration);

    const nameCounts = new Map<string, number>();
    for (const unit of units) {
      nameCounts.set(
        unit.name,
        (nameCounts.get(unit.name) ?? 0) + 1,
      );
    }

    const survivors = units.map((unit) => {
      const duplicate =
        (nameCounts.get(unit.name) ?? 0) > 1;

      const displayName = duplicate
        ? `${unit.name} #${unit.instanceNumber}`
        : unit.name;

      return `TEAM ${unit.teamId}  ${displayName}`;
    });

    const survivorText =
      survivors.length > 0
        ? survivors.join("\n")
        : "NO SURVIVORS";

    const survivorsTitle = this.scene.add.text(
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

    const survivorsList = this.scene.add.text(
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

    this.createResultButton(
      resultObjects,
      590,
      "PLAY AGAIN",
      this.callbacks.onRestart,
    );

    this.createResultButton(
      resultObjects,
      665,
      "NEW BATTLE",
      this.callbacks.onMenu,
    );

    for (const camera of this.scene.cameras.cameras) {
      if (camera !== resultCamera) {
        camera.ignore(resultObjects);
      }
    }

    const nonResultObjects = this.scene.children.list.filter(
      (object) => !resultObjects.includes(object),
    );

    resultCamera.ignore(nonResultObjects);
  }

  private createResultButton(
    resultObjects: Phaser.GameObjects.GameObject[],
    y: number,
    label: string,
    callback: () => void,
  ): void {
    const background = this.scene.add.rectangle(
      GAME_WIDTH / 2,
      y,
      260,
      56,
      0x2e2a40,
    );

    background
      .setStrokeStyle(2, 0x6f53ff)
      .setInteractive({ useHandCursor: true })
      .setDepth(101)
      .on("pointerdown", callback);

    const text = this.scene.add.text(
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
}
