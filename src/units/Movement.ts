import { Physics } from "./Physics";

export const MovementType = {
  BOUNCE: "bounce",
  WANDER: "wander",
  JITTER: "jitter",
} as const;

export type MovementType =
  (typeof MovementType)[keyof typeof MovementType];

// Precomputed constants avoid repeating degree/radian conversion
// work for every moving unit on every frame.
const MAX_WANDER_TURN_PER_SECOND =
  Math.PI * 2;

const MAX_JITTER =
  (25 * Math.PI) / 180;

export class Movement {
  private readonly speed: number;

  public readonly movementType: MovementType;

  private direction: number;
  private readonly random: () => number;

  constructor(
    speed: number,
    movementType: MovementType,
    random: () => number = Math.random,
  ) {
    if (speed < 0) {
      throw new Error(
        "Movement speed cannot be negative.",
      );
    }

    this.speed = speed;
    this.movementType = movementType;
    this.random = random;

    // Choose a random starting direction.
    this.direction =
      this.random() * Math.PI * 2;
  }

  initialize(physics: Physics): void {
    this.updateVelocity(physics);
  }

  update(
    deltaSeconds: number,
    physics: Physics,
  ): void {
    switch (this.movementType) {
      case MovementType.BOUNCE:
        this.updateBounce();
        break;

      case MovementType.WANDER:
        this.updateWander(
          deltaSeconds,
          physics,
        );
        break;

      case MovementType.JITTER:
        this.updateJitter(physics);
        break;
    }
  }

  // --------------------------------------------------
  // BOUNCE
  // --------------------------------------------------

  private updateBounce(): void {
    /*
     * BOUNCE does not change direction by itself.
     * Physics changes the velocity when the unit hits a wall.
     */
  }

  // --------------------------------------------------
  // WANDER
  // --------------------------------------------------

  private updateWander(
    deltaSeconds: number,
    physics: Physics,
  ): void {
    const randomTurn =
      (this.random() * 2 - 1) *
      MAX_WANDER_TURN_PER_SECOND *
      deltaSeconds;

    this.direction =
      this.getDirectionFromPhysics(physics) +
      randomTurn;

    this.updateVelocity(physics);
  }

  // --------------------------------------------------
  // JITTER
  // --------------------------------------------------

  private updateJitter(
    physics: Physics,
  ): void {
    const randomJitter =
      (this.random() * 2 - 1) *
      MAX_JITTER;

    this.direction =
      this.getDirectionFromPhysics(physics) +
      randomJitter;

    this.updateVelocity(physics);
  }

  // --------------------------------------------------
  // VELOCITY
  // --------------------------------------------------

  private updateVelocity(
    physics: Physics,
  ): void {
    physics.setVelocity(
      Math.cos(this.direction) * this.speed,
      Math.sin(this.direction) * this.speed,
    );
  }

  private getDirectionFromPhysics(
    physics: Physics,
  ): number {
    return Math.atan2(
      physics.getVelocityY(),
      physics.getVelocityX(),
    );
  }
}
