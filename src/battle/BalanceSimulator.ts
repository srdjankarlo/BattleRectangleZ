import { Characters } from "../characters/Characters";
import { HeadlessUnit } from "../units/HeadlessUnit";
import type { UnitConfig } from "../units/UnitConfig";
import { ProjectileCore } from "./ProjectileCore";
import { BattleSimulationCore } from "./BattleSimulationCore";

const SIMULATION_STEP = 1 / 30;
const MAX_BATTLE_SECONDS = 45;
const ROUNDS_PER_MATCHUP = 5;

const ARENAS = [
  { name: "Tiny", width: 200, height: 200 },
  { name: "Small", width: 300, height: 300 },
  { name: "Medium", width: 500, height: 500 },
] as const;

type SimProjectile = ProjectileCore<HeadlessUnit>;

type CharacterResult = {
  wins: number;
  losses: number;
  draws: number;
  totalTime: number;
};

/**
 * Runs the same headless battle core used by the live game. Rendering is the
 * only part omitted from the balance test.
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
    lines.push("Simulation rules: shared live-game battle core; rendering omitted.");
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

      const gamesPerCharacter =
        (characterEntries.length - 1) * ROUNDS_PER_MATCHUP;

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

      lines.push(
        `=== ${arena.name.toUpperCase()} ARENA (${arena.width} x ${arena.height}) ===`,
      );
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
    lines.push("- The live and balance simulations share the same BattleSimulationCore.");
    lines.push("- Both use the same Health, Combat, MeleeAttack, RangedAttack, Physics, Movement, and UnitAI classes.");
    lines.push("- Live projectiles and headless projectiles share ProjectileCore.");
    lines.push("- Each matchup uses a deterministic seed for reproducible movement randomness.");
    lines.push("- The report is currently pairwise 1v1, so multi-unit support positioning is not represented.");

    return lines.join("\n");
  }

  downloadReport(): void {
    const report = this.generateReport();
    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

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
    const random = this.createRandom(seed);

    const first = new HeadlessUnit(
      firstConfig,
      arenaWidth * 0.25,
      arenaHeight / 2,
      arenaWidth,
      arenaHeight,
      1,
      random,
    );

    const second = new HeadlessUnit(
      secondConfig,
      arenaWidth * 0.75,
      arenaHeight / 2,
      arenaWidth,
      arenaHeight,
      2,
      random,
    );

    const units = [first, second];
    const simulation = new BattleSimulationCore<HeadlessUnit, SimProjectile>(
      (attacker, target, attack) =>
        new ProjectileCore(attacker, target, attack),
    );

    first.physics.y += (random() - 0.5) * arenaHeight * 0.15;
    second.physics.y += (random() - 0.5) * arenaHeight * 0.15;
    first.physics.handleWallCollision();
    second.physics.handleWallCollision();
    simulation.initialize(units);

    let elapsed = 0;

    while (
      elapsed < MAX_BATTLE_SECONDS &&
      first.isAlive() &&
      second.isAlive()
    ) {
      simulation.step(units, SIMULATION_STEP);
      elapsed += SIMULATION_STEP;
    }

    let winner: 0 | 1 | 2 = 0;

    if (first.isAlive() && !second.isAlive()) {
      winner = 1;
    } else if (second.isAlive() && !first.isAlive()) {
      winner = 2;
    }

    return { winner, duration: elapsed };
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
