export class Physics {
  public x: number;
  public y: number;

  private velocityX = 0;
  private velocityY = 0;

  public readonly width: number;
  public readonly height: number;

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
    this.x = x;
    this.y = y;

    this.width = width;
    this.height = height;

    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;

    if (mass <= 0) {
      throw new Error("Mass must be greater than 0.");
    }

    this.mass = mass;
  }

  // Bounding radius for spatial checks
  public get radius(): number {
    return Math.max(this.width, this.height) / 2;
  }

  // VELOCITY
  setVelocity(velocityX: number, velocityY: number): void {
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
    this.x += this.velocityX * deltaSeconds;
    this.y += this.velocityY * deltaSeconds;
  }

  // WALL COLLISION
  handleWallCollision(): void {
    const halfWidth = this.width / 2;
    const halfHeight = this.height / 2;

    // LEFT
    if (this.x - halfWidth <= 0) {
      this.x = halfWidth;
      this.velocityX *= -1;
    }

    // RIGHT
    if (this.x + halfWidth >= this.arenaWidth) {
      this.x = this.arenaWidth - halfWidth;
      this.velocityX *= -1;
    }

    // TOP
    if (this.y - halfHeight <= 0) {
      this.y = halfHeight;
      this.velocityY *= -1;
    }

    // BOTTOM
    if (this.y + halfHeight >= this.arenaHeight) {
      this.y = this.arenaHeight - halfHeight;
      this.velocityY *= -1;
    }
  }

  // RECTANGULAR UNIT COLLISION
  resolveCollision(other: Physics): boolean {
    const halfWidthA = this.width / 2;
    const halfHeightA = this.height / 2;
    const halfWidthB = other.width / 2;
    const halfHeightB = other.height / 2;

    // Calculate distance between centers
    const dx = other.x - this.x;
    const dy = other.y - this.y;

    // Calculate overlap on both axes
    const overlapX = halfWidthA + halfWidthB - Math.abs(dx);
    const overlapY = halfHeightA + halfHeightB - Math.abs(dy);

    // If there's no overlap on either axis, no collision occurred
    if (overlapX <= 0 || overlapY <= 0) {
      return false;
    }

    let normalX = 0;
    let normalY = 0;
    let penetration = 0;

    // Resolve along the axis with the smallest overlap (shallowest penetration)
    if (overlapX < overlapY) {
      penetration = overlapX + 1.0; // Add 1px buffer to prevent corner clipping
      normalX = dx < 0 ? -1 : 1;
      normalY = 0;
    } else {
      penetration = overlapY + 1.0;
      normalX = 0;
      normalY = dy < 0 ? -1 : 1;
    }

    // Separate the two rectangles
    this.x -= normalX * (penetration / 2);
    this.y -= normalY * (penetration / 2);

    other.x += normalX * (penetration / 2);
    other.y += normalY * (penetration / 2);

    // Keep units in arena after separation
    this.handleWallCollision();
    other.handleWallCollision();

    // Calculate relative velocity along the collision normal
    const relativeVelocityX = other.velocityX - this.velocityX;
    const relativeVelocityY = other.velocityY - this.velocityY;

    const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;

    // Do not bounce if already moving apart
    if (velocityAlongNormal > 0) {
      return false;
    }

    // Impulse calculation for rectangle bounce
    const impulse = (-2 * velocityAlongNormal) / (this.mass + other.mass);

    this.velocityX -= impulse * other.mass * normalX;
    this.velocityY -= impulse * other.mass * normalY;

    other.velocityX += impulse * this.mass * normalX;
    other.velocityY += impulse * this.mass * normalY;

    return true;
  }
}