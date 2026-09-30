import Phaser from "phaser";

import { DamageType } from "../units/Damage";
import type { RangedAttack } from "../units/RangedAttack";
import type { Unit } from "../units/Unit";
import {
  ProjectileCore,
} from "./ProjectileCore";

const PHYSICAL_PROJECTILE_COLOR = 0xff9f1c;
const MAGIC_PROJECTILE_COLOR = 0xa78bfa;
const PROJECTILE_RADIUS = 4;
const PROJECTILE_STROKE_COLOR = 0x111111;
const PROJECTILE_STROKE_WIDTH = 1;

/**
 * Phaser rendering wrapper around the shared projectile simulation core.
 * Movement, collision, behavior, and damage are handled by ProjectileCore so
 * the live game and the headless balance simulator use identical rules.
 */
export class Projectile {
  private readonly sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
  private readonly core: ProjectileCore<Unit>;

  constructor(
    layer: Phaser.GameObjects.Container,
    attacker: Unit,
    target: Unit,
    attack: RangedAttack,
  ) {
    this.core = new ProjectileCore(attacker, target, attack);

    if (attack.projectileSprite) {
      const image = layer.scene.add.image(
        this.core.x,
        this.core.y,
        attack.projectileSprite,
      );
      image.setDisplaySize(18, 18).setDepth(7);
      this.sprite = image;
    } else {
      const projectileColor =
        attack.damageType === DamageType.MAGIC
          ? MAGIC_PROJECTILE_COLOR
          : PHYSICAL_PROJECTILE_COLOR;

      const circle = layer.scene.add.circle(
        this.core.x,
        this.core.y,
        PROJECTILE_RADIUS,
        projectileColor,
      );
      circle
        .setStrokeStyle(PROJECTILE_STROKE_WIDTH, PROJECTILE_STROKE_COLOR, 0.9)
        .setDepth(7);
      this.sprite = circle;
    }

    layer.add(this.sprite);
  }

  /** Advances the shared projectile state and then updates its visual. */
  update(deltaSeconds: number, units: readonly Unit[]): boolean {
    const alive = this.core.update(deltaSeconds, units);

    this.sprite.x = this.core.x;
    this.sprite.y = this.core.y;

    if (!alive) {
      this.destroy();
    }

    return alive;
  }

  destroy(): void {
    this.sprite.destroy();
  }
}
