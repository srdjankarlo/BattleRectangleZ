export class Physics {
  public x: number;
  public y: number;

  private velocityX = 0;
  private velocityY = 0;

  public readonly width: number;
  public readonly height: number;
  private readonly halfWidth: number;
  private readonly halfHeight: number;
  private readonly boundingRadius: number;

  private readonly arenaWidth: number;
  private readonly arenaHeight: number;

  private readonly mass: number;

  constructor(
    x: number,
    y: number,
    width: number,
    height: number,
    arenaWidth: number,
    arenaHeight: number,
    mass = 1,
  ) {
    if (width <= 0 || height <= 0) {
      throw new Error(
        "Physics width and height must be greater than 0.",
      );
    }

    this.x = x;
    this.y = y;

    this.width = width;
    this.height = height;
    this.halfWidth = width / 2;
    this.halfHeight = height / 2;
    this.boundingRadius = Math.max(width, height) / 2;

    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;

    if (mass <= 0) {
      throw new Error(
        "Mass must be greater than 0.",
      );
    }

    this.mass = mass;
  }

  // Bounding radius is cached because unit dimensions do not change.
  public get radius(): number {
    return this.boundingRadius;
  }

  // VELOCITY

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

  update(deltaSeconds: number): void {
    this.x +=
      this.velocityX * deltaSeconds;

    this.y +=
      this.velocityY * deltaSeconds;
  }

  // WALL COLLISION

  handleWallCollision(): void {
    // LEFT
    if (this.x - this.halfWidth <= 0) {
      this.x = this.halfWidth;
      this.velocityX *= -1;
    }

    // RIGHT
    if (
      this.x + this.halfWidth >=
      this.arenaWidth
    ) {
      this.x =
        this.arenaWidth -
        this.halfWidth;
      this.velocityX *= -1;
    }

    // TOP
    if (this.y - this.halfHeight <= 0) {
      this.y = this.halfHeight;
      this.velocityY *= -1;
    }

    // BOTTOM
    if (
      this.y + this.halfHeight >=
      this.arenaHeight
    ) {
      this.y =
        this.arenaHeight -
        this.halfHeight;
      this.velocityY *= -1;
    }
  }

  // RECTANGLE COLLISION

  resolveCollision(
    other: Physics,
  ): boolean {
    const dx = other.x - this.x;
    const dy = other.y - this.y;

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const maxAllowedX =
      this.halfWidth +
      other.halfWidth;

    const maxAllowedY =
      this.halfHeight +
      other.halfHeight;

    // Fast guard: most pairs do not collide.
    if (
      absDx >= maxAllowedX ||
      absDy >= maxAllowedY
    ) {
      return false;
    }

    const overlapX =
      maxAllowedX - absDx;

    const overlapY =
      maxAllowedY - absDy;

    let normalX = 0;
    let normalY = 0;
    let penetration: number;

    const useHorizontalSeparation =
      overlapX < overlapY;

    if (useHorizontalSeparation) {
      penetration = overlapX + 1;
      normalX = dx < 0 ? -1 : 1;
    } else {
      penetration = overlapY + 1;
      normalY = dy < 0 ? -1 : 1;
    }

    // Separate the units while respecting arena walls.
    //
    // A normal 50/50 split is not enough at a wall: if one unit is already
    // touching that wall, moving it outward gets clamped back immediately,
    // recreating the overlap. Give the free unit the remaining separation
    // distance instead.
    let separated = this.separateWithArenaBounds(
      other,
      normalX,
      normalY,
      penetration,
    );

    // If the preferred separation axis is completely blocked by the arena
    // boundary, try the other axis. This handles units trapped together in a
    // corner or pressed against the same side wall.
    if (!separated) {
      if (useHorizontalSeparation) {
        penetration = overlapY + 1;
        normalX = 0;
        normalY = dy < 0 ? -1 : 1;
      } else {
        penetration = overlapX + 1;
        normalX = dx < 0 ? -1 : 1;
        normalY = 0;
      }

      separated = this.separateWithArenaBounds(
        other,
        normalX,
        normalY,
        penetration,
      );
    }

    if (!separated) {
      // This can only happen when the units are too large for the arena to
      // provide enough room for a non-overlapping configuration.
      return false;
    }

    const relativeVelocityX =
      other.velocityX -
      this.velocityX;

    const relativeVelocityY =
      other.velocityY -
      this.velocityY;

    const velocityAlongNormal =
      relativeVelocityX * normalX +
      relativeVelocityY * normalY;

    // Already separating.
    if (velocityAlongNormal > 0) {
      return false;
    }

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

    return true;
  }

  private separateWithArenaBounds(
    other: Physics,
    normalX: number,
    normalY: number,
    penetration: number,
  ): boolean {
    const movePositiveX = normalX > 0;
    const movePositiveY = normalY > 0;

    if (normalX !== 0) {
      const thisAvailable = movePositiveX
        ? this.x - this.halfWidth
        : this.arenaWidth - this.halfWidth - this.x;

      const otherAvailable = movePositiveX
        ? this.arenaWidth - other.halfWidth - other.x
        : other.x - other.halfWidth;

      const totalAvailable =
        Math.max(0, thisAvailable) +
        Math.max(0, otherAvailable);

      if (totalAvailable + 1e-6 < penetration) {
        return false;
      }

      let thisMove = Math.min(
        penetration / 2,
        Math.max(0, thisAvailable),
      );

      let otherMove = penetration - thisMove;

      if (otherMove > Math.max(0, otherAvailable)) {
        otherMove = Math.max(0, otherAvailable);
        thisMove = penetration - otherMove;
      }

      this.x += movePositiveX
        ? -thisMove
        : thisMove;

      other.x += movePositiveX
        ? otherMove
        : -otherMove;
    } else {
      const thisAvailable = movePositiveY
        ? this.y - this.halfHeight
        : this.arenaHeight - this.halfHeight - this.y;

      const otherAvailable = movePositiveY
        ? this.arenaHeight - other.halfHeight - other.y
        : other.y - other.halfHeight;

      const totalAvailable =
        Math.max(0, thisAvailable) +
        Math.max(0, otherAvailable);

      if (totalAvailable + 1e-6 < penetration) {
        return false;
      }

      let thisMove = Math.min(
        penetration / 2,
        Math.max(0, thisAvailable),
      );

      let otherMove = penetration - thisMove;

      if (otherMove > Math.max(0, otherAvailable)) {
        otherMove = Math.max(0, otherAvailable);
        thisMove = penetration - otherMove;
      }

      this.y += movePositiveY
        ? -thisMove
        : thisMove;

      other.y += movePositiveY
        ? otherMove
        : -otherMove;
    }

    // The movement above is calculated from the remaining free space, so the
    // units should already be inside the arena. This final clamp protects
    // against tiny floating-point errors without changing their velocities.
    this.constrainPositionToArena();
    other.constrainPositionToArena();

    return true;
  }

  private constrainPositionToArena(): void {
    this.x = Math.max(
      this.halfWidth,
      Math.min(
        this.arenaWidth - this.halfWidth,
        this.x,
      ),
    );

    this.y = Math.max(
      this.halfHeight,
      Math.min(
        this.arenaHeight - this.halfHeight,
        this.y,
      ),
    );
  }
}
