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
  headerHeight: 86,

  // Text placement.
  textX: 8,
  textTopPadding: 4,

  // Default width of one bottom-panel stat cell.
  // Used as the fallback width when a row does not provide its own width.
  columnWidth: 16,

  cellHeight: 20,
  cellGap: 2,
  unitGap: 5,

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
// export const STATS_ROW_COLUMN_WIDTHS = [
//   [15, 15, 15, 15, 15],
//   [15, 15, 15, 15, 15],
//   [20, 20, 20, 20],
//   [25, 25, 25],
// ] as const;

// pixel widths instead of character counts
export const STATS_ROW_COLUMN_WIDTHS = [
  [40, 100, 40, 30, 60],
  [100, 45, 45, 50, 40],
  [67, 67, 67],
  [90, 90, 90],
] as const;

export const STATS_HEADER_ROWS = [
  ["TEAM", "UNIT", "MASS", "MS", "MOVE"],
  ["HP / REG", "ARM", "MR", "SHL", "LS"],
  ["AD", "AP", "AS"],
  ["PASS", "ABIL", "ULT"],
] as const;

export const STAT_COLORS = {
  DEFAULT: { background: 0x2a2833, text: "#eeeeee" },
  IDENTITY: { background: 0x30313a, text: "#ffffff" },

  HP: { background: 0x174d26, text: "#b7ff4a" },
  REG: { background: 0x0f4c4c, text: "#7fffe0" },
  MASS: { background: 0x5a3e24, text: "#9be564" },
  ARM: { background: 0x7b828b, text: "#2b2118" },
  MR: { background: 0x9ddcf5, text: "#0b0f14" },
  SHL: { background: 0xd9b300, text: "#141414" },
  LS: { background: 0x7a1111, text: "#ffb347" },

  AD: { background: 0xf0d4d4, text: "#b00020" },
  AP: { background: 0x123a5a, text: "#7ddcff" },
  // AS: { background: 0xd66b00, text: "#7a0000" },
  AS: { background: 0x4b2a73, text: "#e7c6ff" },
  MOVE: { background: 0x234a7a, text: "#cde7ff" },

  PASS: { background: 0x454550, text: "#f2f2f2" },
  ABIL: { background: 0x40275f, text: "#dcb5ff" },
  ULT: { background: 0x5f285f, text: "#ffb7ff" },
} as const;

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
