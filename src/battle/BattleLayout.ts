// ==================================================
// BATTLE SCREEN LAYOUT
// ==================================================
//
// This file contains the values that control the logical
// Phaser battle screen. Change values here instead of
// searching through BattleScene/BattleUI for magic numbers.
// ==================================================

export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 1000;

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
  // Overall stats-panel placement and height.
  // panelTop: where the stats panel starts below the battle buttons.
  // panelBottomPadding: empty space kept below the scrollable stats list.
  panelTop: 54,
  panelBottomPadding: 8,

  // Total height of the fixed header area above the scrollable unit list.
  // The header contains 4 rows: 2 top-panel rows + 2 bottom-panel rows.
  headerHeight: 85,

  // Text placement.
  textX: 8,
  textTopPadding: 4,

  // Default width of one bottom-panel stat cell.
  // Used by HP/ARM/MR/SHLD and BD/AD/AP/MOVE.
  columnWidth: 16,

  // Text appearance.
  fontSize: 13,
  lineSpacing: 4,

  // Scroll behavior.
  wheelSpeed: 0.6,
  updateIntervalMs: 100,
} as const;

// Each header row has its own cell widths.
// Rows 1 and 2 are compact so all information fits on a phone.
// Row 3 gets more room for combat stats.
// Row 4 is widest because PASS / ABIL / ULT are ability names/descriptions.
export const STATS_ROW_COLUMN_WIDTHS = [
  [15, 15, 15, 15, 15],
  [15, 15, 15, 15, 15],
  [20, 20, 20, 20],
  [25, 25, 25],
] as const;

export const STATS_HEADER_ROWS = [
  ["TEAM", "UNIT", "MASS", "MS", "MOVE"],
  ["HP / REG", "ARM", "MR", "SHL", "LS"],
  ["BD", "BAS", "AD", "AP"],
  ["PASS", "ABIL", "ULT"],
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
