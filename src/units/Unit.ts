import Phaser from "phaser";

export const MovementType = {
  BOUNCE: "bounce",
  WANDER: "wander",
  JITTER: "jitter",
} as const;

export type MovementType =
  (typeof MovementType)[keyof typeof MovementType];

export class Unit {
  // The Phaser object that actually appears on the screen.
  public readonly sprite: Phaser.GameObjects.Arc;
  
  // Unit properties
  public readonly radius: number; // How large the unit is.
  public readonly movementType: MovementType; // How this unit moves.

  // Movement
  private speed: number; // How fast the unit moves, in pixels per second.

  // Current movement direction in radians.
  private direction: number;

  // Current velocity in pixels per second.
  private velocityX: number;
  private velocityY: number;

  // Arena boundaries.
  private readonly arenaWidth: number;
  private readonly arenaHeight: number;

  // Used for collision calculations.
  // For now every unit has the same mass.
  // Later this can be changed for different character types.
  private readonly mass = 1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    radius: number,
    speed: number,
    movementType: MovementType,
    color: number,
    arenaWidth: number,
    arenaHeight: number,
  ) {
    this.radius = radius;
    this.speed = speed;
    this.movementType = movementType;

    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;

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
    this.direction = Math.random() * Math.PI * 2;

    // Convert direction + speed into X/Y velocity.
    this.velocityX = Math.cos(this.direction) * this.speed;
    this.velocityY = Math.sin(this.direction) * this.speed;

    // Create the visible circle.
    this.sprite = scene.add.circle(
      x,
      y,
      radius,
      color,
    );
  }

  update(deltaSeconds: number): void {
    switch (this.movementType) {
      case MovementType.BOUNCE:
        this.updateBounce(deltaSeconds);
        break;

      case MovementType.WANDER:
        this.updateWander(deltaSeconds);
        break;

      case MovementType.JITTER:
        this.updateJitter(deltaSeconds);
        break;
    }

    this.handleWallCollision();
  }

  // --------------------------------------------------
  // BOUNCE
  // --------------------------------------------------

  private updateBounce(deltaSeconds: number): void {
    // Move the unit.
    // Bounce does not change its direction by itself.
    // It keeps traveling in the current direction.
    this.sprite.x += this.velocityX * deltaSeconds;
    this.sprite.y += this.velocityY * deltaSeconds;
  }

  // --------------------------------------------------
  // WANDER
  // --------------------------------------------------

  private updateWander(deltaSeconds: number): void {
    /*
     * Gradually change direction.
     *
     * Unlike JITTER, this happens smoothly.
     *
     * 45 degrees per second is only a starting value.
     * We can balance this later per character.
     */
    const maximumTurnPerSecond =
      Phaser.Math.DegToRad(45);

    const randomTurn =
      Phaser.Math.FloatBetween(-1, 1) *
      maximumTurnPerSecond *
      deltaSeconds;

    this.direction += randomTurn;

    this.updateVelocityFromDirection();

    this.sprite.x +=
      this.velocityX * deltaSeconds;

    this.sprite.y +=
      this.velocityY * deltaSeconds;
  }

  // --------------------------------------------------
  // JITTER
  // --------------------------------------------------

  private updateJitter(deltaSeconds: number): void {
    /*
     * JITTER deliberately changes direction every frame.
     *
     * The change is random, but limited so the unit
     * doesn't instantly teleport in a completely
     * unrelated direction.
     */
    const maximumJitter =
      Phaser.Math.DegToRad(25);

    const randomJitter =
      Phaser.Math.FloatBetween(
        -maximumJitter,
        maximumJitter,
      );

    this.direction += randomJitter;

    this.updateVelocityFromDirection();

    this.sprite.x +=
      this.velocityX * deltaSeconds;

    this.sprite.y +=
      this.velocityY * deltaSeconds;
  }

  // --------------------------------------------------
  // VELOCITY
  // --------------------------------------------------

  private updateVelocityFromDirection(): void {
    this.velocityX =
      Math.cos(this.direction) * this.speed;

    this.velocityY =
      Math.sin(this.direction) * this.speed;
  }

  private updateDirectionFromVelocity(): void {
    this.direction =
      Math.atan2(
        this.velocityY,
        this.velocityX,
      );
  }

  // --------------------------------------------------
  // WALL COLLISION
  // --------------------------------------------------

  private handleWallCollision(): void {
    // LEFT WALL
    if (this.sprite.x - this.radius <= 0) {
      this.sprite.x = this.radius;

      // Reverse horizontal velocity.
      this.velocityX *= -1;

      this.updateDirectionFromVelocity();
    }

    // RIGHT WALL
    if (this.sprite.x + this.radius >= this.arenaWidth) {
      this.sprite.x = this.arenaWidth - this.radius;

      // Reverse horizontal direction.
      this.velocityX *= -1;

      this.updateDirectionFromVelocity();
    }

    // TOP WALL
    if (this.sprite.y - this.radius <= 0) {
      this.sprite.y = this.radius;

      // Reverse vertical velocity.
      this.velocityY *= -1;

      this.updateDirectionFromVelocity();
    }

    // BOTTOM WALL
    if (this.sprite.y + this.radius >= this.arenaHeight) {
      this.sprite.y = this.arenaHeight - this.radius;

      // Reverse vertical direction.
      this.velocityY *= -1;

      this.updateDirectionFromVelocity();
    }
  }

  // --------------------------------------------------
  // UNIT COLLISION
  // --------------------------------------------------

  resolveCollision(other: Unit): void {
    const dx = other.sprite.x - this.sprite.x;
    const dy = other.sprite.y - this.sprite.y;

    const distanceSquared = dx * dx + dy * dy;

    const minimumDistance =
      this.radius + other.radius;

    // They aren't touching.
    if (distanceSquared >= minimumDistance * minimumDistance) {
      return;
    }

    // Distance between the centers.
    let distance =
      Math.sqrt(distanceSquared);
    
    let normalX: number;
    let normalY: number;

    // Prevent division by zero if the units are exactly
    // on top of each other.
    /*
     * If both circles somehow occupy exactly the
     * same position, choose a random collision direction.
     */
    if (distance === 0) {
      const randomAngle =
        Math.random() * Math.PI * 2;

      normalX = Math.cos(randomAngle);
      normalY = Math.sin(randomAngle);

      distance = 0.0001;
    } else {
      normalX = dx / distance;
      normalY = dy / distance;
    }

    /*
     * --------------------------------------------------
     * 1. Separate the units
     * --------------------------------------------------
     *
     * If the circles overlap, move them apart so they
     * no longer occupy the same space.
     */

    const overlap =
      minimumDistance - distance;

    this.sprite.x -= normalX * overlap / 2;
    this.sprite.y -= normalY * overlap / 2;

    other.sprite.x += normalX * overlap / 2;
    other.sprite.y += normalY * overlap / 2;

    /*
     * --------------------------------------------------
     * 2. Check whether they are actually moving
     *    toward each other.
     * --------------------------------------------------
     */

    const relativeVelocityX =
      other.velocityX - this.velocityX;

    const relativeVelocityY =
      other.velocityY - this.velocityY;

    const velocityAlongNormal =
      relativeVelocityX * normalX +
      relativeVelocityY * normalY;

    // Positive means they are moving apart already.
    if (velocityAlongNormal > 0) {
      return;
    }

    /*
     * --------------------------------------------------
     * 3. Apply a simple elastic collision.
     * --------------------------------------------------
     *
     * For now both units have mass = 1.
     *
     * Later this can become more sophisticated so that
     * a Giant can push a Peasant differently from two
     * Peasants colliding.
     */

    const impulse =
      (-2 * velocityAlongNormal) /
      (this.mass + other.mass);

    this.velocityX -=
      impulse * other.mass * normalX;

    this.velocityY -=
      impulse * other.mass * normalY;

    other.velocityX +=
      impulse * this.mass * normalX;

    other.velocityY +=
      impulse * this.mass * normalY;
    
    /*
     * Collision changed the velocity, so update
     * direction too.
     *
     * This is important for WANDER and JITTER because
     * they use direction when calculating their next
     * velocity.
     */
    this.updateDirectionFromVelocity();

    other.updateDirectionFromVelocity();
  }
}