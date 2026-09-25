import Phaser from "phaser";

import type { BattleSetup } from "../GameSetup";
import {
  setActiveBattleSetup,
} from "./BattleSession";
import {
  BattleScene,
} from "./BattleScene";
import {
  BATTLE_RETURN_TO_MENU_EVENT,
  BATTLE_SCENE_KEY,
} from "./BattleConstants";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
} from "./BattleLayout";

/**
 * Owns the lifetime of the Phaser game instance.
 * main.ts only needs to wire the menu and this controller together.
 */
export class BattleGame {
  private game: Phaser.Game | null = null;

  private readonly container: HTMLElement;
  private readonly onReturnToMenu: () => void;

  constructor(
    container: HTMLElement,
    onReturnToMenu: () => void,
  ) {
    this.container = container;
    this.onReturnToMenu = onReturnToMenu;
  }

  startBattle(setup: BattleSetup): void {
    setActiveBattleSetup(setup);

    this.container.classList.remove("hidden");

    if (!this.game) {
      this.game = new Phaser.Game(
        this.createPhaserConfig(),
      );

      this.game.events.on(
        BATTLE_RETURN_TO_MENU_EVENT,
        this.handleReturnToMenu,
      );

      return;
    }

    this.game.scale.refresh();

    const scene = this.game.scene.getScene(
      BATTLE_SCENE_KEY,
    );

    scene.scene.restart();
  }

  private readonly handleReturnToMenu = (): void => {
    this.returnToMenu();
  };

  private returnToMenu(): void {
    if (this.game?.scene.isActive(BATTLE_SCENE_KEY)) {
      this.game.scene.stop(BATTLE_SCENE_KEY);
    }

    setActiveBattleSetup(null);
    this.container.classList.add("hidden");
    this.onReturnToMenu();
  }

  private createPhaserConfig(): Phaser.Types.Core.GameConfig {
    return {
      type: Phaser.AUTO,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      backgroundColor: "#0b0b0b",
      parent: this.container,
      powerPreference: "high-performance",
      autoMobileTextures: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        zoom: 1,
      },
      scene: BattleScene,
    };
  }
}
