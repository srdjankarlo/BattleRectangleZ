/**
 * High-level combat behavior used by the unit AI.
 *
 * The AI type controls target selection and movement intent. Attack systems
 * remain separate, so adding a new attack does not require rewriting the AI.
 */
export const AIType = {
  TANK: "tank",
  FIGHTER: "fighter",
  ASSASSIN: "assassin",
  MARKSMAN: "marksman",
  SUPPORT: "support",
  MEDIC: "medic",
} as const;

export type AIType = (typeof AIType)[keyof typeof AIType];
