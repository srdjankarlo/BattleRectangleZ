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

  // UNIT COLLISION
  resolveCollision(other: Physics): boolean {
    const dx = other.x - this.x;
    const dy = other.y - this.y;

    const distanceSquared = dx * dx + dy * dy;
    const minimumDistance = this.radius + other.radius;

    if (distanceSquared >= minimumDistance * minimumDistance) {
      return false;
    }

    let distance = Math.sqrt(distanceSquared);
    let normalX: number;
    let normalY: number;

    if (distance === 0) {
      const randomAngle = Math.random() * Math.PI * 2;
      normalX = Math.cos(randomAngle);
      normalY = Math.sin(randomAngle);
      distance = 0.0001;
    } else {
      normalX = dx / distance;
      normalY = dy / distance;
    }

    const overlap = minimumDistance - distance;

    this.x -= (normalX * overlap) / 2;
    this.y -= (normalY * overlap) / 2;

    other.x += (normalX * overlap) / 2;
    other.y += (normalY * overlap) / 2;

    const relativeVelocityX = other.velocityX - this.velocityX;
    const relativeVelocityY = other.velocityY - this.velocityY;

    const velocityAlongNormal =
      relativeVelocityX * normalX + relativeVelocityY * normalY;

    if (velocityAlongNormal > 0) {
      return false;
    }

    const impulse = (-2 * velocityAlongNormal) / (this.mass + other.mass);

    this.velocityX -= impulse * other.mass * normalX;
    this.velocityY -= impulse * other.mass * normalY;

    other.velocityX += impulse * this.mass * normalX;
    other.velocityY += impulse * this.mass * normalY;

    return true;
  }
}