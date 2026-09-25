// ==================================================
// BATTLE SCREEN LAYOUT
// ==================================================
//
// This file contains the values that control the logical
// Phaser battle screen. Change values here instead of
// searching through BattleScene/BattleUI for magic numbers.
// ==================================================

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 900;

// Arena occupies the top of the screen.
export const ARENA_VIEWPORT = {
  x: 0,
  y: 0,
  width: GAME_WIDTH,
  height: 500,
} as const;

// Battle UI starts immediately below the arena.
export const UI_VIEWPORT = {
  x: 0,
  y: ARENA_VIEWPORT.y + ARENA_VIEWPORT.height,
  width: GAME_WIDTH,
  height: GAME_HEIGHT - ARENA_VIEWPORT.height,
} as const;

export const BATTLE_BUTTONS = {
  y: 26,
  width: 145,
  height: 44,
  positions: {
    restart: 85,
    pause: 270,
    menu: 455,
  },
  colors: {
    fill: 0x2e2a40,
    stroke: 0x6f53ff,
  },
} as const;

export const STATS_TABLE = {
  // Stats panel begins below the button row.
  panelTop: 54,
  panelBottomPadding: 8,

  // Fixed three-line header.
  headerHeight: 55,

  // Text placement.
  textX: 8,
  textTopPadding: 4,

  // Character/stat columns.
  columnWidth: 17,

  // Text appearance.
  fontSize: 13,
  lineSpacing: 4,

  // Scroll behavior.
  wheelSpeed: 0.6,
  updateIntervalMs: 100,
} as const;

export const STATS_HEADER_ROWS = [
  ["TEAM/UNIT", "PASS", "ABIL", "ULT"],
  ["HP", "ARM", "MR", "SHLD"],
  ["BD", "AD", "AP", "MOVE"],
] as const;

export const STATS_TABLE_LINE_HEIGHT =
  STATS_TABLE.fontSize + STATS_TABLE.lineSpacing;

export const STATS_PANEL_HEIGHT =
  UI_VIEWPORT.height - STATS_TABLE.panelTop;

export const STATS_BODY_TOP =
  STATS_TABLE.panelTop + STATS_TABLE.headerHeight;

export const STATS_BODY_HEIGHT = Math.max(
  0,
  STATS_PANEL_HEIGHT -
    STATS_TABLE.headerHeight -
    STATS_TABLE.panelBottomPadding,
);
