import Phaser from "phaser";

import { Movement } from "./Movement";
import { Combat } from "./Combat";
import { Health } from "./Health";
import { MeleeAttack } from "./MeleeAttack";
import { RangedAttack } from "./RangedAttack";
import { Physics } from "./Physics";
import { UnitAI } from "./UnitAI";
import type { UnitConfig } from "./UnitConfig";
import { DamageType } from "./Damage";
import type { DamageResult } from "./Health";

const MELEE_SWING_DURATION = 0.12;
const MELEE_SWING_HALF_ANGLE = Math.PI / 3;
const MELEE_WEAPON_WIDTH = 8;
const MELEE_WEAPON_LENGTH_MIN = 28;
const MELEE_WEAPON_LENGTH_MAX = 70;

export class Unit {
  // --------------------------------------------------
  // VISUALS
  // --------------------------------------------------
  public readonly sprite: Phaser.GameObjects.Image;
  public readonly healthBarBg: Phaser.GameObjects.Rectangle;
  public readonly healthBarFill: Phaser.GameObjects.Rectangle;

  public readonly meleeWeapon: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Image | null;

  private meleeSwingActive = false;
  private meleeSwingElapsed = 0;
  private meleeSwingStartAngle = 0;

  private readonly healthBarWidth: number;
  private readonly healthBarOffsetY: number;

  private lastHealthRatio = -1;
  private lastHealthBarColor = -1;

  // --------------------------------------------------
  // CONFIGURATION
  // --------------------------------------------------
  public readonly config: Readonly<UnitConfig>;
  public readonly name: string;
  public readonly teamId: number;
  public readonly instanceNumber: number;

  // --------------------------------------------------
  // SYSTEMS
  // --------------------------------------------------
  public readonly movement: Movement;
  public readonly combat: Combat;
  public readonly health: Health;
  public readonly physics: Physics;
  public readonly meleeAttack: MeleeAttack | null;
  public readonly rangedAttack: RangedAttack | null;
  public readonly ai: UnitAI;

  constructor(
    scene: Phaser.Scene,
    config: UnitConfig,
    x: number,
    y: number,
    arenaWidth: number,
    arenaHeight: number,
    teamId: number,
    instanceNumber: number,
	  aiEnabled = true,
  ) {
    this.config = config;
    this.name = config.name;
    this.teamId = teamId;
    this.instanceNumber = instanceNumber;

    const stats = config.stats;

    this.health = new Health(
      stats.maxHealth,
      stats.maxShield ?? 0,
      stats.healthRegeneration ?? 0,
    );

    this.combat = new Combat(stats.lifeSteal ?? 0);
    this.meleeAttack = stats.meleeAttack ? new MeleeAttack(stats.meleeAttack) : null;
    this.rangedAttack = stats.rangedAttack ? new RangedAttack(stats.rangedAttack) : null;

    this.physics = new Physics(
      x,
      y,
      stats.width,
      stats.height,
      arenaWidth,
      arenaHeight,
      stats.mass,
    );

    this.movement = new Movement(
      stats.speed,
      config.movementType,
    );
    this.movement.initialize(this.physics);

    this.ai = new UnitAI(this, config.aiType, aiEnabled);

    this.sprite = scene.add.image(x, y, config.icon);
    this.sprite.setDisplaySize(stats.width, stats.height);
    this.sprite.setDepth(10);

    // Melee weapons are only created for units that actually have a melee attack.
    if (this.meleeAttack) {
      const meleeWeaponLength = Phaser.Math.Clamp(this.meleeAttack.range * 2, MELEE_WEAPON_LENGTH_MIN, MELEE_WEAPON_LENGTH_MAX);

      if (this.meleeAttack.sprite) {
        const weaponImage = scene.add.image(x, y, this.meleeAttack.sprite);
        weaponImage
          .setDisplaySize(meleeWeaponLength, MELEE_WEAPON_WIDTH)
          .setOrigin(0, 0.5)
          .setDepth(9)
          .setVisible(false);
        this.meleeWeapon = weaponImage;
      } else {
        const weaponRectangle = scene.add.rectangle(x, y, meleeWeaponLength, MELEE_WEAPON_WIDTH, 0xd8d8d8);
        weaponRectangle
          .setOrigin(0, 0.5)
          .setStrokeStyle(1, 0x202020, 0.9)
          .setDepth(9)
          .setVisible(false);
        this.meleeWeapon = weaponRectangle;
      }
    } else {
      this.meleeWeapon = null;
    }

    // Health bar geometry never changes during a battle, so cache it.
    this.healthBarWidth = Math.max(30, stats.width);
    this.healthBarOffsetY = stats.height / 2 + 8;

    this.healthBarBg = scene.add.rectangle(
      x,
      y - this.healthBarOffsetY,
      this.healthBarWidth,
      6,
      0x111111,
    );
    this.healthBarBg.setDepth(11).setStrokeStyle(1, 0x000000, 0.8);

    this.healthBarFill = scene.add.rectangle(
      x - this.healthBarWidth / 2,
      y - this.healthBarOffsetY,
      this.healthBarWidth,
      4,
      0x22c55e,
    );
    this.healthBarFill.setOrigin(0, 0.5).setDepth(12);

    this.updateHealthBar();
  }

  // --------------------------------------------------
  // UPDATE
  // --------------------------------------------------

  update(deltaSeconds: number, units: readonly Unit[] = []): void {
    this.meleeAttack?.update(deltaSeconds);
    this.rangedAttack?.update(deltaSeconds);

    if (!this.isAlive()) {
      return;
    }

    if (this.health.regenerate(deltaSeconds)) {
      this.updateHealthBar();
    }

    this.ai.update(deltaSeconds, units);

    // AI-controlled units keep their chosen velocity between AI decisions.
    // MovementType remains the fallback behavior when there is no AI directive.
    // AI is currently the movement authority. Movement remains on the unit as
    // the low-level movement fallback for future neutral/non-combat states.
    if (!this.aiControlsMovement()) {
      this.movement.update(deltaSeconds, this.physics);
    }

    this.physics.update(deltaSeconds);
    this.physics.handleWallCollision();
    this.updateMeleeWeapon(deltaSeconds);
    this.syncSpriteToPhysics();
  }

  private aiControlsMovement(): boolean {
    return this.ai.controlsMovement();
  }

  // --------------------------------------------------
  // POSITION SYNCHRONIZATION
  // --------------------------------------------------

  private syncSpriteToPhysics(): void {
    const x = this.physics.x;
    const y = this.physics.y;

    this.sprite.x = x;
    this.sprite.y = y;

    this.healthBarBg.x = x;
    this.healthBarBg.y = y - this.healthBarOffsetY;

    this.healthBarFill.x = x - this.healthBarWidth / 2;
    this.healthBarFill.y = y - this.healthBarOffsetY;

    if (!this.meleeSwingActive && this.meleeWeapon) {
      this.meleeWeapon.x = x;
      this.meleeWeapon.y = y;
    }
  }

  private updateMeleeWeapon(deltaSeconds: number): void {
    if (!this.meleeSwingActive || !this.meleeWeapon) {
      return;
    }

    this.meleeSwingElapsed += deltaSeconds;

    if (this.meleeSwingElapsed >= MELEE_SWING_DURATION) {
      this.meleeSwingActive = false;
      this.meleeWeapon?.setVisible(false);
      return;
    }

    const progress = this.meleeSwingElapsed / MELEE_SWING_DURATION;
    const angle =
      this.meleeSwingStartAngle -
      MELEE_SWING_HALF_ANGLE +
      progress * MELEE_SWING_HALF_ANGLE * 2;

    this.meleeWeapon.x = this.physics.x;
    this.meleeWeapon.y = this.physics.y;
    this.meleeWeapon.rotation = angle;
  }

  // --------------------------------------------------
  // PHYSICAL COLLISION
  // --------------------------------------------------

  public resolveCollision(other: Unit): void {
    if (!this.isAlive() || !other.isAlive()) {
      return;
    }

    // Physical collision only changes position/velocity. Combat is handled by
    // the dedicated melee/ranged attack systems below.
    this.physics.resolveCollision(other.physics);
  }

  // --------------------------------------------------
  // MELEE ATTACK
  // --------------------------------------------------

  public isWithinMeleeRange(other: Unit): boolean {
    return this.meleeAttack
      ? this.physics.isWithinRange(other.physics, this.meleeAttack.range)
      : false;
  }

  public performMeleeAttack(target: Unit): boolean {
    const attack = this.meleeAttack;

    if (
      !attack ||
      !this.isAlive() ||
      !target.isAlive() ||
      this.teamId === target.teamId ||
      !attack.canAttack() ||
      !this.isWithinMeleeRange(target)
    ) {
      return false;
    }

    target.receiveDamage(attack.damage, attack.damageType, this);

    attack.startCooldown();
    this.startMeleeSwing(target);
    return true;
  }

  private startMeleeSwing(target: Unit): void {
    if (!this.meleeWeapon) {
      return;
    }

    const dx = target.physics.x - this.physics.x;
    const dy = target.physics.y - this.physics.y;

    this.meleeSwingStartAngle = Math.atan2(dy, dx);
    this.meleeSwingElapsed = 0;
    this.meleeSwingActive = true;
    this.meleeWeapon.rotation =
      this.meleeSwingStartAngle - MELEE_SWING_HALF_ANGLE;
    this.meleeWeapon.x = this.physics.x;
    this.meleeWeapon.y = this.physics.y;
    this.meleeWeapon.setVisible(true);
  }

  // --------------------------------------------------
  // HEALTH BAR
  // --------------------------------------------------

  private updateHealthBar(): void {
    if (!this.isAlive()) {
      return;
    }

    const healthRatio = Phaser.Math.Clamp(this.getHealthRatio(), 0, 1);

    if (healthRatio !== this.lastHealthRatio) {
      this.lastHealthRatio = healthRatio;
      this.healthBarFill.setScale(healthRatio, 1);
    }

    const color = this.getHealthColor(healthRatio);

    if (color !== this.lastHealthBarColor) {
      this.lastHealthBarColor = color;
      this.healthBarFill.setFillStyle(color);
    }
  }

  private getHealthColor(healthRatio: number): number {
    if (healthRatio > 0.75) return 0x22c55e;
    if (healthRatio > 0.5) return 0x84cc16;
    if (healthRatio > 0.25) return 0xfacc15;
    if (healthRatio > 0.1) return 0xf97316;
    return 0xef4444;
  }

  // --------------------------------------------------
  // DAMAGE & DEATH
  // --------------------------------------------------

  public receiveDamage(
    rawDamage: number,
    damageType: DamageType,
    attacker?: Unit,
  ): DamageResult {
    if (!this.isAlive()) {
      return { shieldDamage: 0, healthDamage: 0, totalDamage: 0 };
    }

    const finalDamage = attacker
      ? attacker.combat.calculateDamage(rawDamage, damageType, this.config.stats)
      : rawDamage;

    const result = this.health.takeDamage(finalDamage);

    if (result.healthDamage > 0) {
      this.updateHealthBar();
    }

    if (!this.isAlive()) {
      this.die();
    }

    if (attacker && result.healthDamage > 0) {
      const healing = attacker.combat.calculateLifeStealHealing(result.healthDamage);

      if (healing > 0) {
        attacker.health.heal(healing);
        attacker.updateHealthBar();
      }
    }

    return result;
  }

  private die(): void {
    this.sprite.setVisible(false);
    this.meleeWeapon?.setVisible(false);
    this.healthBarBg.setVisible(false);
    this.healthBarFill.setVisible(false);
  }

  // --------------------------------------------------
  // STATE ACCESSORS
  // --------------------------------------------------

  public isAlive(): boolean { return this.health.isAlive(); }
  public getHealth(): number { return this.health.getCurrentHealth(); }
  public getMaxHealth(): number { return this.health.getMaxHealth(); }
  public getHealthRegeneration(): number { return this.health.getHealthRegeneration(); }
  public getHealthRatio(): number { return this.health.getHealthRatio(); }
  public getShield(): number { return this.health.getCurrentShield(); }
  public getMaxShield(): number { return this.health.getMaxShield(); }

  public destroy(): void {
    this.sprite.destroy();
    this.meleeWeapon?.destroy();
    this.healthBarBg.destroy();
    this.healthBarFill.destroy();
  }
}
