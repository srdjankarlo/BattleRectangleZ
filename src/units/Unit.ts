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

  // How fast the unit moves, in pixels per second.
  private speed: number;

  // Current movement direction, in radians.
  private direction: number;

  // How large the unit is.
  public readonly radius: number;

  // How this unit moves.
  public readonly movementType: MovementType;

  // Arena boundaries.
  private readonly arenaWidth: number;
  private readonly arenaHeight: number;

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
      case MovementType.JITTER:
        // These movement systems will be implemented later.
        break;
    }
  }

  private updateBounce(deltaSeconds: number): void {
    // Convert our direction into horizontal and vertical movement.
    const velocityX =
      Math.cos(this.direction) * this.speed;

    const velocityY =
      Math.sin(this.direction) * this.speed;

    // Move the unit.
    this.sprite.x += velocityX * deltaSeconds;
    this.sprite.y += velocityY * deltaSeconds;

    // LEFT WALL
    if (this.sprite.x - this.radius <= 0) {
      this.sprite.x = this.radius;

      // Reverse horizontal direction.
      this.direction = Math.PI - this.direction;
    }

    // RIGHT WALL
    if (this.sprite.x + this.radius >= this.arenaWidth) {
      this.sprite.x = this.arenaWidth - this.radius;

      // Reverse horizontal direction.
      this.direction = Math.PI - this.direction;
    }

    // TOP WALL
    if (this.sprite.y - this.radius <= 0) {
      this.sprite.y = this.radius;

      // Reverse vertical direction.
      this.direction = -this.direction;
    }

    // BOTTOM WALL
    if (this.sprite.y + this.radius >= this.arenaHeight) {
      this.sprite.y = this.arenaHeight - this.radius;

      // Reverse vertical direction.
      this.direction = -this.direction;
    }
  }
}