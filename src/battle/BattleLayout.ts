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
  columnWidth: 14,

  // Text appearance.
  fontSize: 13,
  lineSpacing: 4,

  // Scroll behavior.
  wheelSpeed: 0.6,
  updateIntervalMs: 100,
} as const;

// Top panel = first two header rows (TEAM/UNIT/MASS and PASS/ABIL/ULT).
// These rows use their own widths so they can occupy the screen from the left
// edge without inheriting the 4-column layout used by the lower stats panel.
const STAT_CELL_WIDTH = STATS_TABLE.columnWidth;

// Widths of the top-panel columns: TEAM, UNIT, MASS.
export const STATS_TOP_ROW_COLUMN_WIDTHS = [
  STAT_CELL_WIDTH * 1.5,
  STAT_CELL_WIDTH * 1.5,
  STAT_CELL_WIDTH * 1.5,
] as const;

// Bottom panel = last two header rows (HP/ARM/MR/SHLD and BD/AD/AP/MOVE).
// All four bottom-panel columns deliberately use the same cell width.
export const STATS_BOTTOM_ROW_COLUMN_WIDTHS = [
  STAT_CELL_WIDTH,
  STAT_CELL_WIDTH,
  STAT_CELL_WIDTH,
  STAT_CELL_WIDTH,
] as const;

export const STATS_HEADER_ROWS = [
  ["TEAM", "UNIT", "MASS"],
  ["PASS", "ABIL", "ULT"],
  ["HP", "ARM", "MR", "SHLD"],
  ["BD/BAS", "AD", "AP", "MOVE"],
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
