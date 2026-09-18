import Phaser from "phaser";

export const MovementType = {
  BOUNCE: "bounce",
  WANDER: "wander",
  JITTER: "jitter",
} as const;

export type MovementType =
  (typeof MovementType)[keyof typeof MovementType];

export class Unit {
  
  // Visual
  // --------------------------------------------------
  // The Phaser object that actually appears on the screen.
  public readonly sprite: Phaser.GameObjects.Arc;
  // Health ellipse surrounding the unit.
  private readonly healthEllipse: Phaser.GameObjects.Graphics;
  
  // Basic unit properties
  // --------------------------------------------------
  public readonly name: string;
  public readonly radius: number; // How large the unit is.
  public readonly movementType: MovementType; // How this unit moves.

  // Combat properties
  // --------------------------------------------------
  private readonly maxHealth: number;
  private health: number;
  private readonly bodyAttackDamage: number;

  // Prevents body collision from dealing damage every
  // single frame while units are touching.
  private bodyDamageCooldown = 0;
  private readonly bodyDamageCooldownDuration = 0.3;

  // Movement
  // --------------------------------------------------
  private speed: number; // How fast the unit moves, in pixels per second.
  
  // Current velocity in pixels per second.
  private velocityX: number;
  private velocityY: number;

  // Arena boundaries.
  // --------------------------------------------------
  private readonly arenaWidth: number;
  private readonly arenaHeight: number;

  // Physics
  // --------------------------------------------------
  // Used for collision calculations.
  // For now every unit has the same mass.
  // Later this can be changed for different character types.
  private readonly mass = 1;

  constructor(
    scene: Phaser.Scene,
    name: string,
    x: number,
    y: number,
    radius: number,
    speed: number,
    maxHealth: number,
    bodyAttackDamage: number,
    movementType: MovementType,
    color: number,
    arenaWidth: number,
    arenaHeight: number,
  ) {
    this.name = name;
    this.radius = radius;
    this.speed = speed;
    this.maxHealth = maxHealth;
    this.health = maxHealth;
    this.bodyAttackDamage = bodyAttackDamage;
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

    // Create unit
    // ------------------------------------------------
    // Create the visible circle.
    this.sprite = scene.add.circle(
      x,
      y,
      radius,
      color,
    );

    // Create health elipse
    // ------------------------------------------------
    this.healthEllipse = scene.add.graphics();
    this.updateHealthEllipse();
  }

  // Public update
  // --------------------------------------------------
  update(deltaSeconds: number): void {
    // Decrease damage cooldown over time.
    if (this.bodyDamageCooldown > 0) {
      this.bodyDamageCooldown -= deltaSeconds;

      if (this.bodyDamageCooldown < 0) {
        this.bodyDamageCooldown = 0;
      }
    }

    // Dead units do not move.
    if (!this.isAlive()) {
      return;
    }

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
    this.updateHealthEllipse();
  }

  // BOUNCE
  // --------------------------------------------------
  private updateBounce(deltaSeconds: number): void {
    // Move the unit.
    // Bounce does not change its direction by itself.
    // It keeps traveling in the current direction.
    this.sprite.x += this.velocityX * deltaSeconds;
    this.sprite.y += this.velocityY * deltaSeconds;
  }

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
      Phaser.Math.DegToRad(360);

    const randomTurn =
      Phaser.Math.FloatBetween(-1, 1) *
      maximumTurnPerSecond *
      deltaSeconds;

    const currentDirection =
      Math.atan2(
        this.velocityY,
        this.velocityX,
      );
    
    const newDirection = currentDirection + randomTurn;

    this.velocityX =
      Math.cos(newDirection) * this.speed;

    this.velocityY =
      Math.sin(newDirection) * this.speed;

    this.sprite.x +=
      this.velocityX * deltaSeconds;

    this.sprite.y +=
      this.velocityY * deltaSeconds;
  }

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
    
    const currentDirection =
      Math.atan2(
        this.velocityY,
        this.velocityX,
      );

    const newDirection =
      currentDirection + randomJitter;

    this.velocityX =
      Math.cos(newDirection) * this.speed;

    this.velocityY =
      Math.sin(newDirection) * this.speed;

    this.sprite.x +=
      this.velocityX * deltaSeconds;

    this.sprite.y +=
      this.velocityY * deltaSeconds;
  }

  // WALL COLLISION
  // --------------------------------------------------
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

  // UNIT COLLISION
  // --------------------------------------------------
  resolveCollision(other: Unit): void {
    // Dead units don't collide.
    if (!this.isAlive() || !other.isAlive()) {
      return;
    }

    const dx = other.sprite.x - this.sprite.x;
    const dy = other.sprite.y - this.sprite.y;

    const distanceSquared = dx * dx + dy * dy;

    const minimumDistance = this.radius + other.radius;

    // They aren't touching.
    if (distanceSquared >= minimumDistance * minimumDistance) {
      return;
    }

    // Distance between the centers.
    let distance = Math.sqrt(distanceSquared);
    
    let normalX: number;
    let normalY: number;

    // Prevent division by zero if the units are exactly
    // on top of each other.
    /*
     * If both circles somehow occupy exactly the
     * same position, choose a random collision direction.
     */
    if (distance === 0) {
      const randomAngle = Math.random() * Math.PI * 2;

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
    const overlap = minimumDistance - distance;

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
    
    // Body damage
    // -----------------------------------------------
    this.tryDealBodyDamage(other);
    other.tryDealBodyDamage(this);
  }

  // BODY DAMAGE
  // --------------------------------------------------
  private tryDealBodyDamage(target: Unit): void {
    if (this.bodyDamageCooldown > 0) {
      return;
    }

    if (!this.isAlive() || !target.isAlive()) {
      return;
    }

    target.takeDamage(this.bodyAttackDamage,);

    this.bodyDamageCooldown = this.bodyDamageCooldownDuration;
  }

  private takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount,);

    // Update immediately instead of waiting for
    // the next frame.
    this.updateHealthEllipse();

    if (!this.isAlive()) {
      this.die();
    }
  }

  // DEATH
  // --------------------------------------------------
  private die(): void {
    // Hide everything immediately.
    this.sprite.setVisible(false);
    this.healthEllipse.setVisible(false);
  }

  // HEALTH
  // --------------------------------------------------
  public isAlive(): boolean {
    return this.health > 0;
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public getHealthRatio(): number {
    return this.health / this.maxHealth;
  }

  // HEALTH ELLIPSE
  // --------------------------------------------------
  private updateHealthEllipse(): void {
    this.healthEllipse.clear();

    if (!this.isAlive()) {
      return;
    }

    const centerX = this.sprite.x;
    const centerY = this.sprite.y;

    // Make the ellipse slightly larger than the circle.
    const radiusX = this.radius + 8;
    const radiusY = this.radius + 12;

    // -----------------------------------------------
    // Background ellipse.
    // -----------------------------------------------

    this.healthEllipse.lineStyle(
      3,
      0x444444,
      1,
    );

    this.drawEllipse(
      centerX,
      centerY,
      radiusX,
      radiusY,
      0,
      Math.PI * 2,
    );

    // -----------------------------------------------
    // Current health.
    // -----------------------------------------------

    const healthRatio =
      this.getHealthRatio();

    const healthEndAngle =
      -Math.PI / 2 +
      Math.PI * 2 * healthRatio;

    this.healthEllipse.lineStyle(
      4,
      0x00ff66,
      1,
    );

    this.drawEllipse(
      centerX,
      centerY,
      radiusX,
      radiusY,
      -Math.PI / 2,
      healthEndAngle,
    );
  }

  private drawEllipse(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    startAngle: number,
    endAngle: number,
  ): void {
    this.healthEllipse.beginPath();

    const steps = 60;

    for (
      let i = 0;
      i <= steps;
      i++
    ) {
      const progress =
        i / steps;

      const angle =
        startAngle +
        (endAngle - startAngle) *
          progress;

      const x =
        centerX +
        Math.cos(angle) * radiusX;

      const y =
        centerY +
        Math.sin(angle) * radiusY;

      if (i === 0) {
        this.healthEllipse.moveTo(
          x,
          y,
        );
      } else {
        this.healthEllipse.lineTo(
          x,
          y,
        );
      }
    }

    this.healthEllipse.strokePath();
  }

  // CLEANUP
  // --------------------------------------------------
  public destroy(): void {
    this.sprite.destroy();
    this.healthEllipse.destroy();
  }
}