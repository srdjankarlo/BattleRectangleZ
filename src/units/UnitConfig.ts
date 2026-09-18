import type { MovementType } from "./Movement";

/**
 * Configuration that describes a unit's basic properties.
 *
 * This contains DATA about the unit.
 *
 * It does not contain the unit's current position,
 * current HP, or current velocity.
 */
export interface UnitConfig {
  // Display name.
  name: string;

  // Size of the unit's circle.
  radius: number;

  // Movement speed in pixels per second.
  speed: number;

  // Maximum health.
  maxHealth: number;

  // Damage caused when the unit physically hits
  // another unit with its body.
  bodyAttackDamage: number;

  // How the unit moves.
  movementType: MovementType;

  // Color used by our prototype.
  //
  // Later this will probably be replaced by sprites,
  // animations, skins, etc.
  color: number;

  // How strongly the unit behaves in physical
  // collisions.
  //
  // Optional because most units will use 1 for now.
  mass?: number;
}