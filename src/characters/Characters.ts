import {
  MovementType,
} from "../units/Movement";

import type {
  UnitConfig,
} from "../units/UnitConfig";

export const Characters = {
  PEASANT: {
    name: "Peasant",

    stats: {
      radius: 18,
      speed: 150,
      mass: 1,

      maxHealth: 100,
      bodyAttackDamage: 8,

      armor: 0,
      magicResistance: 0,

      maxShield: 0,
    },

    movementType: MovementType.BOUNCE,

    color: 0xc2a878,
  },

  KNIGHT: {
    name: "Knight",

    stats: {
      radius: 22,
      speed: 120,
      mass: 2,

      maxHealth: 100,
      bodyAttackDamage: 15,

      armor: 10,
      magicResistance: 5,

      maxShield: 0,
    },

    movementType: MovementType.BOUNCE,

    color: 0x888888,
  },

  ARCHER: {
    name: "Archer",

    stats: {
      radius: 19,
      speed: 140,
      mass: 1,

      maxHealth: 80,
      bodyAttackDamage: 6,

      armor: 3,
      magicResistance: 5,

      maxShield: 0,
    },

    movementType: MovementType.WANDER,

    color: 0x4caf50,
  },

  WIZARD: {
    name: "Wizard",

    stats: {
      radius: 20,
      speed: 100,
      mass: 1,

      maxHealth: 80,
      bodyAttackDamage: 4,

      armor: 2,
      magicResistance: 15,

      maxShield: 30,
    },

    movementType: MovementType.JITTER,

    color: 0x8e44ad,
  },

  GIANT: {
    name: "Giant",

    stats: {
      radius: 35,
      speed: 70,
      mass: 5,

      maxHealth: 500,
      bodyAttackDamage: 30,

      armor: 20,
      magicResistance: 10,

      maxShield: 0,
    },

    movementType: MovementType.BOUNCE,

    color: 0x795548,
  },

  GOBLIN: {
    name: "Goblin",

    stats: {
      radius: 16,
      speed: 180,
      mass: 1,

      maxHealth: 50,
      bodyAttackDamage: 8,

      armor: 2,
      magicResistance: 0,

      maxShield: 0,
    },

    movementType: MovementType.JITTER,

    color: 0x2ecc71,
  },
} satisfies Record<
  string,
  UnitConfig
>;

export type CharacterId =
  keyof typeof Characters;