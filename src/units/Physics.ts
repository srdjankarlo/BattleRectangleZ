export class Physics {
  public x: number;
  public y: number;

  private velocityX = 0;
  private velocityY = 0;

  public readonly radius: number;

  private readonly arenaWidth: number;
  private readonly arenaHeight: number;

  private readonly mass: number;

  constructor(
    x: number,
    y: number,
    radius: number,
    arenaWidth: number,
    arenaHeight: number,
    mass = 1,
  ) {
    this.x = x;
    this.y = y;

    this.radius = radius;

    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;

    this.mass = mass;
  }

  // VELOCITY
  // --------------------------------------------------
  setVelocity(
    velocityX: number,
    velocityY: number,
  ): void {
    this.velocityX = velocityX;
    this.velocityY = velocityY;
  }

  getVelocityX(): number {
    return this.velocityX;
  }

  getVelocityY(): number {
    return this.velocityY;
  }

  // MOVEMENT
  // --------------------------------------------------
  update(deltaSeconds: number): void {
    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;
  }

  // WALL COLLISION
  // --------------------------------------------------
  handleWallCollision(): void {
    // LEFT
    if (this.x - this.radius <= 0) {
      this.x = this.radius;
      this.velocityX *= -1;
    }

    // RIGHT
    if (
      this.x + this.radius >=
      this.arenaWidth
    ) {
      this.x =
        this.arenaWidth - this.radius;

      this.velocityX *= -1;
    }

    // TOP
    if (this.y - this.radius <= 0) {
      this.y = this.radius;
      this.velocityY *= -1;
    }

    // BOTTOM
    if (
      this.y + this.radius >=
      this.arenaHeight
    ) {
      this.y =
        this.arenaHeight - this.radius;

      this.velocityY *= -1;
    }
  }

  // --------------------------------------------------
  // UNIT COLLISION
  // --------------------------------------------------

  /**
   * Resolves the physical collision between two units.
   *
   * Returns true when a real collision occurred and
   * the units were moving toward each other.
   */
  resolveCollision(
    other: Physics,
  ): boolean {
    const dx =
      other.x - this.x;

    const dy =
      other.y - this.y;

    const distanceSquared =
      dx * dx + dy * dy;

    const minimumDistance =
      this.radius + other.radius;

    // Not touching.
    if (
      distanceSquared >=
      minimumDistance * minimumDistance
    ) {
      return false;
    }

    let distance =
      Math.sqrt(distanceSquared);

    let normalX: number;
    let normalY: number;

    // Exact overlap protection.
    if (distance === 0) {
      const randomAngle =
        Math.random() * Math.PI * 2;

      normalX =
        Math.cos(randomAngle);

      normalY =
        Math.sin(randomAngle);

      distance = 0.0001;
    } else {
      normalX =
        dx / distance;

      normalY =
        dy / distance;
    }

    // Separate overlapping units.
    // ------------------------------------------------
    const overlap =
      minimumDistance - distance;

    this.x -=
      normalX * overlap / 2;

    this.y -=
      normalY * overlap / 2;

    other.x +=
      normalX * overlap / 2;

    other.y +=
      normalY * overlap / 2;

    // Relative velocity.
    // ------------------------------------------------
    const relativeVelocityX =
      other.velocityX -
      this.velocityX;

    const relativeVelocityY =
      other.velocityY -
      this.velocityY;

    const velocityAlongNormal =
      relativeVelocityX * normalX +
      relativeVelocityY * normalY;

    // Already moving apart.
    if (velocityAlongNormal > 0) {
      return false;
    }

    // Elastic collision.
    // ------------------------------------------------
    const impulse =
      (-2 * velocityAlongNormal) /
      (this.mass + other.mass);

    this.velocityX -=
      impulse *
      other.mass *
      normalX;

    this.velocityY -=
      impulse *
      other.mass *
      normalY;

    other.velocityX +=
      impulse *
      this.mass *
      normalX;

    other.velocityY +=
      impulse *
      this.mass *
      normalY;

    return true;
  }
}