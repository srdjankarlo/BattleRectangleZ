import { Movement } from "./Movement";
import { Combat } from "./Combat";
import { Health } from "./Health";
import { MeleeAttack } from "./MeleeAttack";
import { RangedAttack } from "./RangedAttack";
import { Physics } from "./Physics";
import { UnitAI } from "./UnitAI";
import type { UnitConfig } from "./UnitConfig";
import type { DamageResult } from "./Health";
import { DamageType } from "./Damage";
import { applyDamage, performMeleeAttack } from "./CombatRules";

/**
 * Headless version of Unit. It deliberately uses the same gameplay systems as
 * the live Phaser Unit and omits only sprites/health-bar rendering.
 */
export class HeadlessUnit {
  public readonly config: Readonly<UnitConfig>;
  public readonly teamId: number;

  public readonly health: Health;
  public readonly combat: Combat;
  public readonly physics: Physics;
  public readonly movement: Movement;
  public readonly meleeAttack: MeleeAttack | null;
  public readonly rangedAttack: RangedAttack | null;
  public readonly ai: UnitAI<HeadlessUnit>;

  constructor(
    config: UnitConfig,
    x: number,
    y: number,
    arenaWidth: number,
    arenaHeight: number,
    teamId: number,
    random: () => number,
  ) {
    this.config = config;
    this.teamId = teamId;

    this.health = new Health(
      config.stats.maxHealth,
      config.stats.maxShield ?? 0,
      config.stats.healthRegeneration ?? 0,
    );

    this.combat = new Combat(config.stats.lifeSteal ?? 0);
    this.physics = new Physics(
      x,
      y,
      config.stats.width,
      config.stats.height,
      arenaWidth,
      arenaHeight,
      config.stats.mass,
    );

    this.meleeAttack = config.stats.meleeAttack
      ? new MeleeAttack(config.stats.meleeAttack)
      : null;

    this.rangedAttack = config.stats.rangedAttack
      ? new RangedAttack(config.stats.rangedAttack)
      : null;

    this.movement = new Movement(
      config.stats.speed,
      config.movementType,
      random,
    );

    this.movement.initialize(this.physics);
    this.ai = new UnitAI<HeadlessUnit>(this, config.aiType, true);
  }

  update(deltaSeconds: number, units: readonly HeadlessUnit[]): void {
    this.meleeAttack?.update(deltaSeconds);
    this.rangedAttack?.update(deltaSeconds);

    if (!this.isAlive()) {
      return;
    }

    this.health.regenerate(deltaSeconds);
    this.ai.update(deltaSeconds, units);

    if (!this.ai.controlsMovement()) {
      this.movement.update(deltaSeconds, this.physics);
    }

    this.physics.update(deltaSeconds);
    this.physics.handleWallCollision();
  }

  performMeleeAttack(target: HeadlessUnit): boolean {
    return performMeleeAttack(this, target);
  }

  receiveDamage(
    rawDamage: number,
    damageType: DamageType,
    attacker?: HeadlessUnit,
  ): DamageResult {
    const result = attacker
      ? applyDamage(attacker, this, rawDamage, damageType)
      : this.health.takeDamage(rawDamage);

    return result;
  }

  isAlive(): boolean {
    return this.health.isAlive();
  }

  getHealth(): number {
    return this.health.getCurrentHealth();
  }

  getMaxHealth(): number {
    return this.health.getMaxHealth();
  }

  getHealthRatio(): number {
    return this.health.getHealthRatio();
  }

  getHealthRegeneration(): number {
    return this.health.getHealthRegeneration();
  }

  getShield(): number {
    return this.health.getCurrentShield();
  }

  getMaxShield(): number {
    return this.health.getMaxShield();
  }
}
