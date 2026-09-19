export const DamageType = {
  PHYSICAL: "physical",
  MAGIC: "magic",
} as const;

export type DamageType =
  (typeof DamageType)[keyof typeof DamageType];