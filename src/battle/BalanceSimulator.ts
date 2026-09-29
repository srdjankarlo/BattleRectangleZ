import { Characters } from "../characters/Characters";
import { AIType } from "../units/AIType";
import { DamageType } from "../units/Damage";
import type { UnitConfig } from "../units/UnitConfig";

const SIMULATION_STEP = 1 / 30;
const MAX_BATTLE_SECONDS = 45;
const AI_STEP = 0.15;
const ROUNDS_PER_MATCHUP = 2;

const ARENAS = [
  { name: "Tiny", width: 200, height: 200 },
  { name: "Small", width: 300, height: 300 },
  { name: "Medium", width: 500, height: 500 },
] as const;

type SimUnit = {
  config: UnitConfig;
  teamId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  shield: number;
  meleeCooldown: number;
  rangedCooldown: number;
  aiTimer: number;
  retreating: boolean;
  target: SimUnit | null;
  movementTarget: SimUnit | null;
};

type SimProjectile = {
  attacker: SimUnit;
  target: SimUnit;
  x: number;
  y: number;
  directionX: number;
  directionY: number;
  speed: number;
  damage: number;
  damageType: DamageType;
  homing: boolean;
  remainingDistance: number;
};

type CharacterResult = {
  wins: number;
  losses: number;
  draws: number;
  totalTime: number;
};

const AI_SAFE_DISTANCE_RATIO = 0.72;
const AI_MIN_DISTANCE_RATIO = 0.55;
const AI_MAX_DISTANCE_RATIO = 0.9;
const ASSASSIN_RETREAT_RATIO = 0.35;
const ASSASSIN_RETURN_RATIO = 0.7;
const SUPPORT_HEALTH_THRESHOLD = 0.85;

/**
 * Runs lightweight, Phaser-free 1v1 matches so the menu can create a balance
 * report without starting a second game instance or rendering thousands of
 * sprites/projectiles.
 */
export class BalanceSimulator {
  generateReport(): string {
    const lines: string[] = [];
    const characterEntries = Object.entries(Characters) as Array<[
      string,
      UnitConfig
    ]>;

    lines.push("BATTLERECTANGLE'Z BALANCE SIMULATION REPORT");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push(`Pairwise rounds per matchup: ${ROUNDS_PER_MATCHUP}`);
    lines.push(`Battle time limit: ${MAX_BATTLE_SECONDS}s`);
    lines.push("");

    for (const arena of ARENAS) {
      const results = new Map<string, CharacterResult>();

      for (const [key] of characterEntries) {
        results.set(key, { wins: 0, losses: 0, draws: 0, totalTime: 0 });
      }

      let totalMatches = 0;

      for (let first = 0; first < characterEntries.length; first++) {
        for (let second = first + 1; second < characterEntries.length; second++) {
          const [firstKey, firstConfig] = characterEntries[first];
          const [secondKey, secondConfig] = characterEntries[second];

          for (let round = 0; round < ROUNDS_PER_MATCHUP; round++) {
            const seed = this.hashSeed(
              arena.name,
              firstKey,
              secondKey,
              round,
            );

            const result = this.simulateBattle(
              firstConfig,
              secondConfig,
              arena.width,
              arena.height,
              seed,
            );

            totalMatches++;
            results.get(firstKey)!.totalTime += result.duration;
            results.get(secondKey)!.totalTime += result.duration;

            if (result.winner === 1) {
              results.get(firstKey)!.wins++;
              results.get(secondKey)!.losses++;
            } else if (result.winner === 2) {
              results.get(secondKey)!.wins++;
              results.get(firstKey)!.losses++;
            } else {
              results.get(firstKey)!.draws++;
              results.get(secondKey)!.draws++;
            }
          }
        }
      }

      const gamesPerCharacter = (characterEntries.length - 1) * ROUNDS_PER_MATCHUP;
      const ordered = characterEntries
        .map(([key, config]) => {
          const result = results.get(key)!;
          return {
            name: config.name,
            ...result,
            winRate: result.wins / Math.max(1, gamesPerCharacter) * 100,
            averageTime: result.totalTime / Math.max(1, gamesPerCharacter),
          };
        })
        .sort((a, b) => b.winRate - a.winRate);

      lines.push(`=== ${arena.name.toUpperCase()} ARENA (${arena.width} x ${arena.height}) ===`);
      lines.push(`Total matches: ${totalMatches}`);
      lines.push("");
      lines.push("Character               W       L       D       Win%    Avg Time");
      lines.push("-------------------------------------------------------------------");

      for (const entry of ordered) {
        lines.push(
          `${entry.name.padEnd(22)} ${String(entry.wins).padStart(5)} ${String(entry.losses).padStart(7)} ${String(entry.draws).padStart(7)} ${entry.winRate.toFixed(1).padStart(8)} ${entry.averageTime.toFixed(1).padStart(10)}s`,
        );
      }

      lines.push("");
    }

    lines.push("NOTES");
    lines.push("- This report is a lightweight headless 1v1 balance test.");
    lines.push("- Win rate is based only on completed pairwise games in the selected arena size.");
    lines.push("- Random movement uses deterministic seeds per matchup so reports are reproducible for the same code/data.");
    lines.push("- Team-support behavior is implemented in the live game AI but is not meaningfully exercised by 1v1 tests.");

    return lines.join("\n");
  }

  downloadReport(): void {
    const report = this.generateReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    link.href = url;
    link.download = `BattleRectanglez_balance_report_${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private simulateBattle(
    firstConfig: UnitConfig,
    secondConfig: UnitConfig,
    arenaWidth: number,
    arenaHeight: number,
    seed: number,
  ): { winner: 0 | 1 | 2; duration: number } {
    const first = this.createUnit(firstConfig, 1, arenaWidth * 0.25, arenaHeight / 2);
    const second = this.createUnit(secondConfig, 2, arenaWidth * 0.75, arenaHeight / 2);
    const units = [first, second];
    const projectiles: SimProjectile[] = [];
    const random = this.createRandom(seed);
    let elapsed = 0;

    // Small deterministic spawn variation prevents identical matchups from
    // always opening with exactly the same trajectory.
    first.y += (random() - 0.5) * arenaHeight * 0.15;
    second.y += (random() - 0.5) * arenaHeight * 0.15;

    while (elapsed < MAX_BATTLE_SECONDS && first.health > 0 && second.health > 0) {
      for (const unit of units) {
        this.updateCooldowns(unit, SIMULATION_STEP);
        this.regenerate(unit, SIMULATION_STEP);
      }

      for (const unit of units) {
        this.updateAI(unit, units);
        this.move(unit, SIMULATION_STEP, arenaWidth, arenaHeight);
      }

      this.resolveMelee(first, second);
      this.resolveMelee(second, first);
      this.resolveRanged(first, second, projectiles);
      this.resolveRanged(second, first, projectiles);
      this.updateProjectiles(projectiles, SIMULATION_STEP);

      elapsed += SIMULATION_STEP;
    }

    let winner: 0 | 1 | 2 = 0;
    if (first.health > 0 && second.health <= 0) winner = 1;
    if (second.health > 0 && first.health <= 0) winner = 2;

    return { winner, duration: elapsed };
  }

  private createUnit(
    config: UnitConfig,
    teamId: number,
    x: number,
    y: number,
  ): SimUnit {
    return {
      config,
      teamId,
      x,
      y,
      vx: 0,
      vy: 0,
      health: config.stats.maxHealth,
      shield: config.stats.maxShield ?? 0,
      meleeCooldown: 0,
      rangedCooldown: 0,
      aiTimer: 0,
      retreating: false,
      target: null,
      movementTarget: null,
    };
  }

  private updateAI(unit: SimUnit, units: readonly SimUnit[]): void {
    unit.aiTimer -= SIMULATION_STEP;
    if (unit.aiTimer > 0) return;
    unit.aiTimer = AI_STEP;

    const enemies = units.filter((candidate) => candidate.teamId !== unit.teamId && candidate.health > 0);
    if (enemies.length === 0) {
      unit.vx = 0;
      unit.vy = 0;
      return;
    }

    if (unit.config.aiType === AIType.ASSASSIN) {
      if (!unit.retreating && this.healthRatio(unit) <= ASSASSIN_RETREAT_RATIO) {
        unit.retreating = units.some((candidate) => candidate.teamId === unit.teamId && candidate !== unit && candidate.health > 0 && (candidate.config.aiType === AIType.SUPPORT || candidate.config.aiType === AIType.TANK));
      } else if (unit.retreating && this.healthRatio(unit) >= ASSASSIN_RETURN_RATIO) {
        unit.retreating = false;
      }

      if (unit.retreating) {
        const healer = units.find((candidate) => candidate.teamId === unit.teamId && candidate !== unit && candidate.health > 0 && (candidate.config.aiType === AIType.SUPPORT || candidate.config.aiType === AIType.TANK)) ?? null;
        unit.target = null;
        unit.movementTarget = healer;
        this.moveToward(unit, healer, 70);
        return;
      }
    }

    unit.target = this.selectEnemy(unit, enemies);

    if (unit.config.aiType === AIType.SUPPORT || unit.config.aiType === AIType.TANK) {
      unit.movementTarget = this.selectSupportAlly(unit, units);

      if (unit.movementTarget || unit.config.aiType === AIType.SUPPORT) {
        unit.target = null;
      }
    } else {
      unit.movementTarget = unit.target;
    }

    if (unit.config.aiType === AIType.MARKSMAN && unit.config.stats.rangedAttack) {
      this.moveRanged(unit, unit.target);
      return;
    }

    if ((unit.config.aiType === AIType.SUPPORT || unit.config.aiType === AIType.TANK) && unit.movementTarget) {
      const distance = this.distance(unit, unit.movementTarget);
      if (distance > 90) this.moveToward(unit, unit.movementTarget, 0);
      else if (distance < 55) this.moveAway(unit, unit.movementTarget);
      else unit.vx = 0, unit.vy = 0;
      return;
    }

    this.moveToward(unit, unit.target, 0);
  }

  private selectEnemy(unit: SimUnit, enemies: readonly SimUnit[]): SimUnit {
    let best = enemies[0];
    let bestValue = Number.POSITIVE_INFINITY;

    for (const candidate of enemies) {
      if (unit.config.aiType === AIType.TANK) {
        const value = -this.estimatedDps(candidate);
        if (value < bestValue) {
          best = candidate;
          bestValue = value;
        }
        continue;
      }

      if (unit.config.aiType === AIType.ASSASSIN) {
        const value = this.healthRatio(candidate) * 0.7 + candidate.config.stats.maxHealth / 10000 * 0.3;
        if (value < bestValue) {
          best = candidate;
          bestValue = value;
        }
        continue;
      }

      const value = this.distance(unit, candidate);
      if (value < bestValue) {
        best = candidate;
        bestValue = value;
      }
    }

    return best;
  }

  private selectSupportAlly(unit: SimUnit, units: readonly SimUnit[]): SimUnit | null {
    let best: SimUnit | null = null;
    let bestValue = Number.POSITIVE_INFINITY;

    for (const candidate of units) {
      if (candidate === unit || candidate.teamId !== unit.teamId || candidate.health <= 0) continue;
      if (this.healthRatio(candidate) > SUPPORT_HEALTH_THRESHOLD) continue;
      const value = this.healthRatio(candidate) + candidate.config.stats.maxHealth / 100000;
      if (value < bestValue) {
        best = candidate;
        bestValue = value;
      }
    }

    return best;
  }

  private moveRanged(unit: SimUnit, target: SimUnit | null): void {
    const attack = unit.config.stats.rangedAttack;
    if (!attack || !target) {
      unit.vx = 0;
      unit.vy = 0;
      return;
    }

    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const minDistance = attack.range * AI_MIN_DISTANCE_RATIO;
    const idealDistance = attack.range * AI_SAFE_DISTANCE_RATIO;
    const maxDistance = attack.range * AI_MAX_DISTANCE_RATIO;

    if (distance < minDistance) {
      this.setVelocity(unit, -dx, -dy);
      return;
    }

    if (distance > maxDistance) {
      this.setVelocity(unit, dx, dy);
      return;
    }

    const strafe = unit.teamId === 1 ? 1 : -1;
    const radial = Math.abs(distance - idealDistance) > attack.range * 0.08
      ? (distance < idealDistance ? -0.25 : 0.25)
      : 0;

    this.setVelocity(
      unit,
      -dy * strafe + dx * radial,
      dx * strafe + dy * radial,
    );
  }

  private moveToward(unit: SimUnit, target: SimUnit | null, stopDistance: number): void {
    if (!target || target.health <= 0) {
      unit.vx = 0;
      unit.vy = 0;
      return;
    }

    const dx = target.x - unit.x;
    const dy = target.y - unit.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;

    if (distance <= stopDistance) {
      unit.vx = 0;
      unit.vy = 0;
      return;
    }

    this.setVelocity(unit, dx, dy);
  }

  private moveAway(unit: SimUnit, target: SimUnit): void {
    this.setVelocity(unit, unit.x - target.x, unit.y - target.y);
  }

  private setVelocity(unit: SimUnit, dx: number, dy: number): void {
    const length = Math.sqrt(dx * dx + dy * dy) || 1;
    unit.vx = dx / length * unit.config.stats.speed;
    unit.vy = dy / length * unit.config.stats.speed;
  }

  private move(unit: SimUnit, delta: number, arenaWidth: number, arenaHeight: number): void {
    unit.x += unit.vx * delta;
    unit.y += unit.vy * delta;

    const halfWidth = unit.config.stats.width / 2;
    const halfHeight = unit.config.stats.height / 2;

    if (unit.x <= halfWidth) {
      unit.x = halfWidth;
      unit.vx = Math.abs(unit.vx);
    } else if (unit.x >= arenaWidth - halfWidth) {
      unit.x = arenaWidth - halfWidth;
      unit.vx = -Math.abs(unit.vx);
    }

    if (unit.y <= halfHeight) {
      unit.y = halfHeight;
      unit.vy = Math.abs(unit.vy);
    } else if (unit.y >= arenaHeight - halfHeight) {
      unit.y = arenaHeight - halfHeight;
      unit.vy = -Math.abs(unit.vy);
    }
  }

  private resolveMelee(attacker: SimUnit, target: SimUnit): void {
    const attack = attacker.config.stats.meleeAttack;
    if (!attack || attacker.health <= 0 || target.health <= 0 || attacker.meleeCooldown > 0) return;
    if (!this.inRange(attacker, target, attack.range)) return;

    this.applyDamage(attacker, target, attack.damage, attack.damageType);
    attacker.meleeCooldown = 1 / attack.attackSpeed;
  }

  private resolveRanged(attacker: SimUnit, target: SimUnit, projectiles: SimProjectile[]): void {
    const attack = attacker.config.stats.rangedAttack;
    if (!attack || attacker.health <= 0 || target.health <= 0 || attacker.rangedCooldown > 0) return;
    if (this.distance(attacker, target) > attack.range + target.config.stats.width / 2) return;

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const length = Math.sqrt(dx * dx + dy * dy) || 1;

    projectiles.push({
      attacker,
      target,
      x: attacker.x,
      y: attacker.y,
      directionX: dx / length,
      directionY: dy / length,
      speed: attack.projectileSpeed,
      damage: attack.damage,
      damageType: attack.damageType,
      homing: (attack.projectileBehavior ?? "homing") === "homing",
      remainingDistance: attack.range + attacker.config.stats.width,
    });

    attacker.rangedCooldown = 1 / attack.attackSpeed;
  }

  private updateProjectiles(projectiles: SimProjectile[], delta: number): void {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      if (projectile.attacker.health <= 0 || projectile.target.health <= 0) {
        projectiles.splice(i, 1);
        continue;
      }

      if (projectile.homing) {
        const dx = projectile.target.x - projectile.x;
        const dy = projectile.target.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 1;
        projectile.directionX = dx / distance;
        projectile.directionY = dy / distance;
      }

      const travel = projectile.speed * delta;
      const oldX = projectile.x;
      const oldY = projectile.y;
      projectile.x += projectile.directionX * travel;
      projectile.y += projectile.directionY * travel;
      projectile.remainingDistance -= travel;

      const hitRadius = projectile.target.config.stats.width / 2 + 5;
      if (this.segmentHitsCircle(oldX, oldY, projectile.x, projectile.y, projectile.target.x, projectile.target.y, hitRadius)) {
        this.applyDamage(projectile.attacker, projectile.target, projectile.damage, projectile.damageType);
        projectiles.splice(i, 1);
        continue;
      }

      if (projectile.remainingDistance <= 0) {
        projectiles.splice(i, 1);
      }
    }
  }

  private applyDamage(attacker: SimUnit, target: SimUnit, rawDamage: number, damageType: DamageType): void {
    const resistance = damageType === DamageType.MAGIC
      ? target.config.stats.magicResistance ?? 0
      : target.config.stats.armor ?? 0;
    const finalDamage = rawDamage * 100 / (100 + resistance);
    const shieldDamage = Math.min(target.shield, finalDamage);
    target.shield -= shieldDamage;
    const healthDamage = Math.min(target.health, finalDamage - shieldDamage);
    target.health -= healthDamage;

    if (healthDamage > 0 && attacker.config.stats.lifeSteal) {
      attacker.health = Math.min(
        attacker.config.stats.maxHealth,
        attacker.health + healthDamage * attacker.config.stats.lifeSteal / 100,
      );
    }
  }

  private regenerate(unit: SimUnit, delta: number): void {
    const regeneration = unit.config.stats.healthRegeneration ?? 0;
    if (regeneration <= 0 || unit.health <= 0) return;
    unit.health = Math.min(unit.config.stats.maxHealth, unit.health + regeneration * delta);
  }

  private updateCooldowns(unit: SimUnit, delta: number): void {
    unit.meleeCooldown = Math.max(0, unit.meleeCooldown - delta);
    unit.rangedCooldown = Math.max(0, unit.rangedCooldown - delta);
  }

  private inRange(attacker: SimUnit, target: SimUnit, range: number): boolean {
    const dx = Math.abs(target.x - attacker.x);
    const dy = Math.abs(target.y - attacker.y);
    return dx <= attacker.config.stats.width / 2 + target.config.stats.width / 2 + range &&
      dy <= attacker.config.stats.height / 2 + target.config.stats.height / 2 + range;
  }

  private distance(a: SimUnit, b: SimUnit): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private healthRatio(unit: SimUnit): number {
    return unit.health / unit.config.stats.maxHealth;
  }

  private estimatedDps(unit: SimUnit): number {
    const melee = unit.config.stats.meleeAttack;
    const ranged = unit.config.stats.rangedAttack;
    return (melee ? melee.damage * melee.attackSpeed : 0) + (ranged ? ranged.damage * ranged.attackSpeed : 0);
  }

  private segmentHitsCircle(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    centerX: number,
    centerY: number,
    radius: number,
  ): boolean {
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;

    if (lengthSquared === 0) {
      const dx = centerX - startX;
      const dy = centerY - startY;
      return dx * dx + dy * dy <= radius * radius;
    }

    const projection = Math.max(
      0,
      Math.min(
        1,
        ((centerX - startX) * segmentX + (centerY - startY) * segmentY) / lengthSquared,
      ),
    );

    const closestX = startX + segmentX * projection;
    const closestY = startY + segmentY * projection;
    const dx = centerX - closestX;
    const dy = centerY - closestY;
    return dx * dx + dy * dy <= radius * radius;
  }

  private hashSeed(...parts: Array<string | number>): number {
    let hash = 2166136261;
    const text = parts.join("|");
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  private createRandom(seed: number): () => number {
    let value = seed || 1;
    return () => {
      value = Math.imul(1664525, value) + 1013904223;
      return (value >>> 0) / 4294967296;
    };
  }
}
