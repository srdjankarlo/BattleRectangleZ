import Phaser from "phaser";

import type { BattleSetup } from "../GameSetup";
import {
  getActiveBattleSetup,
} from "./BattleSession";
import {
  ARENA_VIEWPORT,
  UI_VIEWPORT,
} from "./BattleLayout";
import {
  createBattleUnits,
} from "./BattleUnitFactory";
import {
  BattleSimulation,
} from "./BattleSimulation";
import {
  BattleUI,
} from "./BattleUI";
import {
  BattleResultUI,
} from "./BattleResultUI";
import {
  Characters,
} from "../characters/Characters";
import {
  Unit,
} from "../units/Unit";

import {
  BATTLE_SCENE_KEY,
  BATTLE_RETURN_TO_MENU_EVENT,
} from "./BattleConstants";

export class BattleScene extends Phaser.Scene {
  private units: Unit[] = [];
  private simulation = new BattleSimulation();
  private battleUI!: BattleUI;
  private battleResultUI!: BattleResultUI;

  private arenaWidth = 500;
  private arenaHeight = 500;

  private isPaused = false;
  private battleElapsedSeconds = 0;
  private battleFinished = false;
  private initialTeamCount = 0;

  constructor() {
    super(BATTLE_SCENE_KEY);
  }

  preload(): void {
    // Character icons are keyed by their full asset path in Characters.ts.
    for (const charKey of Object.keys(Characters)) {
      const charConfig =
        Characters[charKey as keyof typeof Characters];

      if (charConfig.icon) {
        this.load.image(
          charConfig.icon,
          charConfig.icon,
        );
      }
    }
  }

  create(): void {
    const setup = getActiveBattleSetup();

    if (!setup) {
      this.requestReturnToMenu();
      return;
    }

    this.cleanupSecondaryCameras();
    this.resetState(setup);

    const worldObjects: Phaser.GameObjects.GameObject[] = [];

    this.createWorldCamera();
    this.createArena(worldObjects);

    this.units = createBattleUnits(
      this,
      setup,
    );

    for (const unit of this.units) {
      worldObjects.push(
        unit.sprite,
        unit.healthBarBg,
        unit.healthBarFill,
      );
    }

    this.simulation.initialize(this.units);

    const uiCamera = this.cameras.add(
      UI_VIEWPORT.x,
      UI_VIEWPORT.y,
      UI_VIEWPORT.width,
      UI_VIEWPORT.height,
    );

    uiCamera.setScroll(0, 0);

    const worldCamera = this.cameras.main;

    this.battleUI = new BattleUI(
      this,
      {
        getUnits: () => this.units,
        getElapsedSeconds: () =>
          this.battleElapsedSeconds,
        isPaused: () => this.isPaused,
        onPauseToggle: () => this.togglePause(),
        onRestart: () => this.restartBattle(),
        onMenu: () => this.requestReturnToMenu(),
      },
    );

    this.battleUI.create(
      worldCamera,
      uiCamera,
      worldObjects,
    );

    this.battleResultUI = new BattleResultUI(
      this,
      {
        getElapsedSeconds: () =>
          this.battleElapsedSeconds,
        onRestart: () => this.restartBattle(),
        onMenu: () => this.requestReturnToMenu(),
      },
    );
  }

  update(
    _time: number,
    delta: number,
  ): void {
    if (
      !this.isPaused &&
      !this.battleFinished
    ) {
      this.battleElapsedSeconds +=
        delta / 1000;

      this.simulation.step(
        this.units,
        delta / 1000,
      );

      this.removeDeadUnits();
    }

    this.battleUI?.update(delta);
  }

  private createWorldCamera(): void {
    const worldCamera = this.cameras.main;

    worldCamera.setViewport(
      ARENA_VIEWPORT.x,
      ARENA_VIEWPORT.y,
      ARENA_VIEWPORT.width,
      ARENA_VIEWPORT.height,
    );

    const fitZoom = Math.min(
      ARENA_VIEWPORT.width /
        this.arenaWidth,
      ARENA_VIEWPORT.height /
        this.arenaHeight,
    );

    worldCamera.setZoom(fitZoom);
    worldCamera.centerOn(
      this.arenaWidth / 2,
      this.arenaHeight / 2,
    );
  }

  private createArena(
    worldObjects: Phaser.GameObjects.GameObject[],
  ): void {
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

    worldObjects.push(
      arenaBg,
      arenaBorder,
    );
  }

  private resetState(
    setup: BattleSetup,
  ): void {
    this.units = [];
    this.isPaused = false;
    this.battleElapsedSeconds = 0;
    this.battleFinished = false;
    this.initialTeamCount =
      setup.teams.length;

    this.arenaWidth =
      setup.arenaWidth;
    this.arenaHeight =
      setup.arenaHeight;
  }

  private cleanupSecondaryCameras(): void {
    for (const camera of [...this.cameras.cameras]) {
      if (camera !== this.cameras.main) {
        this.cameras.remove(camera, true);
      }
    }
  }

  private removeDeadUnits(): void {
    let removedAny = false;

    const survivors: Unit[] = [];

    for (const unit of this.units) {
      if (unit.isAlive()) {
        survivors.push(unit);
      } else {
        unit.destroy();
        removedAny = true;
      }
    }

    if (!removedAny) {
      return;
    }

    this.units = survivors;
    this.checkBattleEnd();
  }

  private checkBattleEnd(): void {
    if (this.initialTeamCount < 2) {
      return;
    }

    const aliveTeams = new Set<number>();

    for (const unit of this.units) {
      aliveTeams.add(unit.teamId);
    }

    if (aliveTeams.size === 0) {
      this.finishBattle(null);
      return;
    }

    if (aliveTeams.size === 1) {
      this.finishBattle(
        [...aliveTeams][0],
      );
    }
  }

  private finishBattle(
    winningTeamId: number | null,
  ): void {
    if (this.battleFinished) {
      return;
    }

    this.battleFinished = true;
    this.isPaused = true;

    this.battleResultUI.show(
      winningTeamId,
      this.units,
    );
  }

  private restartBattle(): void {
    this.scene.restart();
  }

  private togglePause(): void {
    if (this.battleFinished) {
      return;
    }

    this.isPaused = !this.isPaused;
    this.battleUI.updatePauseButton();
  }

  private requestReturnToMenu(): void {
    this.game.events.emit(
      BATTLE_RETURN_TO_MENU_EVENT,
    );
  }
}
