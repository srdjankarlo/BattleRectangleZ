import {
  MovementType,
} from "../units/Movement";

import type {
  UnitConfig,
} from "../units/UnitConfig";

export const Characters = {
  PEASANT: {
    name: "Peasant",

    radius: 18,
    speed: 150,

    maxHealth: 100,
    bodyAttackDamage: 8,

    movementType: MovementType.BOUNCE,

    color: 0xc2a878,
  },

  KNIGHT: {
    name: "Knight",

    radius: 22,
    speed: 120,

    maxHealth: 100,
    bodyAttackDamage: 15,

    movementType: MovementType.BOUNCE,

    color: 0x888888,

    mass: 2,
  },

  ARCHER: {
    name: "Archer",

    radius: 19,
    speed: 140,

    maxHealth: 80,
    bodyAttackDamage: 6,

    movementType: MovementType.WANDER,

    color: 0x4caf50,
  },

  WIZARD: {
    name: "Wizard",

    radius: 20,
    speed: 100,

    maxHealth: 80,
    bodyAttackDamage: 4,

    movementType: MovementType.JITTER,

    color: 0x8e44ad,
  },

  GIANT: {
    name: "Giant",

    radius: 35,
    speed: 70,

    maxHealth: 500,
    bodyAttackDamage: 30,

    movementType: MovementType.BOUNCE,

    color: 0x795548,

    mass: 5,
  },

  GOBLIN: {
    name: "Goblin",

    radius: 16,
    speed: 180,

    maxHealth: 50,
    bodyAttackDamage: 8,

    movementType: MovementType.JITTER,

    color: 0x2ecc71,
  },
} satisfies Record<string, UnitConfig>;

export type CharacterId =
  keyof typeof Characters;