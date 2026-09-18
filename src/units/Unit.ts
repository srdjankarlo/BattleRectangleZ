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
    const direction = Math.random() * Math.PI * 2;

    // Convert direction + speed into X/Y velocity.
    this.velocityX = Math.cos(direction) * this.speed;
    this.velocityY = Math.sin(direction) * this.speed;

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
        // implemented later.  
        break;
      case MovementType.JITTER:
        // implemented later.
        break;
    }
  }

  private updateBounce(deltaSeconds: number): void {
    // Move the unit.
    this.sprite.x += this.velocityX * deltaSeconds;
    this.sprite.y += this.velocityY * deltaSeconds;

    this.handleWallCollision();
  }

  private handleWallCollision(): void {
    // LEFT WALL
    if (this.sprite.x - this.radius <= 0) {
      this.sprite.x = this.radius;

      // Reverse horizontal velocity.
      this.velocityX *= -1;
    }

    // RIGHT WALL
    if (this.sprite.x + this.radius >= this.arenaWidth) {
      this.sprite.x = this.arenaWidth - this.radius;

      // Reverse horizontal direction.
      this.velocityX *= -1;
    }

    // TOP WALL
    if (this.sprite.y - this.radius <= 0) {
      this.sprite.y = this.radius;

      // Reverse vertical velocity.
      this.velocityY *= -1;
    }

    // BOTTOM WALL
    if (this.sprite.y + this.radius >= this.arenaHeight) {
      this.sprite.y = this.arenaHeight - this.radius;

      // Reverse vertical direction.
      this.velocityY *= -1;
    }
  }

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
    const distance =
      Math.sqrt(distanceSquared);

    // Prevent division by zero if the units are exactly
    // on top of each other.
    const safeDistance =
      distance === 0 ? 0.0001 : distance;

    // Normal vector from this unit toward the other unit.
    const normalX = dx / safeDistance;
    const normalY = dy / safeDistance;

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
  }
}