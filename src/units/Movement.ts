import { Physics } from "./Physics";

export const MovementType = {
  BOUNCE: "bounce",
  WANDER: "wander",
  JITTER: "jitter",
} as const;

export type MovementType =
  (typeof MovementType)[keyof typeof MovementType];

export class Movement {
  private readonly speed: number;

  public readonly movementType: MovementType;

  private direction: number;

  constructor(
    speed: number,
    movementType: MovementType,
  ) {
    if (speed < 0) {
      throw new Error(
        "Movement speed cannot be negative.",
      );
    }

    this.speed = speed;
    this.movementType = movementType;

    // Choose a random starting direction.
    // Math.PI * 2 represents a full circle (2*PI = 360 degrees).
    //              270°
    //               ↑
    //               |
    // 180°  ←────── ● ──────→  0°
    //               |
    //               ↓
    //              90°
    // 0°       → right → 0
    // 90°      → down → PI/2
    // 180°     → left → PI
    // 270°     → up → 3*PI/2
    this.direction =
      Math.random() * Math.PI * 2;
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
        this.updateBounce(
          physics,
        );
        break;

      case MovementType.WANDER:
        this.updateWander(
          deltaSeconds,
          physics,
        );
        break;

      case MovementType.JITTER:
        this.updateJitter(
          physics,
        );
        break;
    }
  }

  // --------------------------------------------------
  // BOUNCE
  // --------------------------------------------------

  private updateBounce(
    _physics: Physics,
  ): void {
    /*
     * BOUNCE doesn't change its direction by itself.
     *
     * Physics changes the velocity when the unit
     * collides with a wall.
     */
  }

  // --------------------------------------------------
  // WANDER
  // --------------------------------------------------

  private updateWander(
    deltaSeconds: number,
    physics: Physics,
  ): void {
    /*
     * Gradually change direction.
     */
    const maximumTurnPerSecond =
      this.degreesToRadians(360);

    const randomTurn =
      (Math.random() * 2 - 1) *
      maximumTurnPerSecond *
      deltaSeconds;

    this.direction =
      this.getDirectionFromPhysics(
        physics,
      );

    this.direction += randomTurn;

    this.updateVelocity(physics);
  }

  // --------------------------------------------------
  // JITTER
  // --------------------------------------------------

  private updateJitter(
    physics: Physics,
  ): void {
    /*
     * Change direction every frame.
     */
    const maximumJitter =
      this.degreesToRadians(25);

    const randomJitter =
      (Math.random() * 2 - 1) *
      maximumJitter;

    this.direction =
      this.getDirectionFromPhysics(
        physics,
      );

    this.direction += randomJitter;

    this.updateVelocity(physics);
  }

  // --------------------------------------------------
  // VELOCITY
  // --------------------------------------------------

  private updateVelocity(
    physics: Physics,
  ): void {
    const velocityX =
      Math.cos(this.direction) *
      this.speed;

    const velocityY =
      Math.sin(this.direction) *
      this.speed;

    physics.setVelocity(
      velocityX,
      velocityY,
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

  private degreesToRadians(
    degrees: number,
  ): number {
    return (
      degrees *
      Math.PI /
      180
    );
  }
}