import "./style.css";

import { BattleGame } from "./battle/BattleGame";
import { GameMenu } from "./GameMenu";

// --------------------------------------------------
// DOM ELEMENTS
// --------------------------------------------------

const menuRoot = document.getElementById("menu-root");
const gameContainer = document.getElementById("game-container");

if (!menuRoot || !gameContainer) {
  throw new Error(
    "Required HTML elements were not found.",
  );
}

// --------------------------------------------------
// APPLICATION WIRING
// --------------------------------------------------
//
// main.ts should stay boring.
//
// It creates the menu and battle controller, then connects
// them. Gameplay belongs in battle/; unit logic belongs in units/.
// --------------------------------------------------

let menu: GameMenu;

const battleGame = new BattleGame(
  gameContainer,
  () => menu.show(),
);

menu = new GameMenu(
  menuRoot,
  (setup) => {
    menu.hide();
    battleGame.startBattle(setup);
  },
);
