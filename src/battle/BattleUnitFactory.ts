import Phaser from "phaser";

import type { BattleSetup, UnitSelection } from "../GameSetup";
import { Characters } from "../characters/Characters";
import { Unit } from "../units/Unit";
import type { UnitConfig } from "../units/UnitConfig";
import type { MovementType } from "../units/Movement";

/**
 * Converts the menu's serializable battle setup into runtime Unit objects.
 * This keeps spawning/configuration details out of the Phaser scene.
 */
export function createBattleUnits(
  scene: Phaser.Scene,
  setup: BattleSetup,
): Unit[] {
  const units: Unit[] = [];
  const unitCounters = new Map<string, number>();

  const teamCount = setup.teams.length;

  for (let teamIndex = 0; teamIndex < teamCount; teamIndex++) {
    const team = setup.teams[teamIndex];

    for (
      let unitIndex = 0;
      unitIndex < team.units.length;
      unitIndex++
    ) {
      const selection = team.units[unitIndex];

      units.push(
        createUnitFromSelection(
          scene,
          setup,
          selection,
          team.id,
          teamIndex,
          teamCount,
          unitIndex,
          team.units.length,
          unitCounters,
        ),
      );
    }
  }

  return units;
}

function createUnitFromSelection(
  scene: Phaser.Scene,
  setup: BattleSetup,
  selection: UnitSelection,
  teamId: number,
  teamIndex: number,
  teamCount: number,
  unitIndex: number,
  unitsInTeam: number,
  unitCounters: Map<string, number>,
): Unit {
  const baseConfig = Characters[selection.characterId];

  let config: UnitConfig = baseConfig;

  if (selection.movementOverride !== "default") {
    config = {
      ...baseConfig,
      movementType: selection.movementOverride as MovementType,
    };
  }

  const baseName = config.name;
  const currentCount = unitCounters.get(baseName) ?? 0;
  const instanceNumber = currentCount + 1;
  unitCounters.set(baseName, instanceNumber);

  const unitSize = Math.max(
    config.stats.width,
    config.stats.height,
  ) / 2;

  const position = getSpawnPosition(
    teamIndex,
    teamCount,
    unitIndex,
    unitsInTeam,
    unitSize,
    setup.arenaWidth,
    setup.arenaHeight,
  );

  return new Unit(
    scene,
    config,
    position.x,
    position.y,
    setup.arenaWidth,
    setup.arenaHeight,
    teamId,
    instanceNumber,
  );
}

function getSpawnPosition(
  teamIndex: number,
  teamCount: number,
  unitIndex: number,
  unitsInTeam: number,
  unitRadius: number,
  arenaWidth: number,
  arenaHeight: number,
): { x: number; y: number } {
  let centerX: number;
  let centerY: number;

  if (teamCount === 2) {
    centerX =
      teamIndex === 0
        ? arenaWidth * 0.22
        : arenaWidth * 0.78;
    centerY = arenaHeight / 2;
  } else {
    const angle =
      -Math.PI / 2 +
      (teamIndex / teamCount) * Math.PI * 2;

    const distance =
      Math.min(arenaWidth, arenaHeight) * 0.3;

    centerX =
      arenaWidth / 2 +
      Math.cos(angle) * distance;

    centerY =
      arenaHeight / 2 +
      Math.sin(angle) * distance;
  }

  const spread = Math.min(
    70,
    Math.min(arenaWidth, arenaHeight) * 0.18,
  );

  const unitAngle =
    unitsInTeam === 1
      ? 0
      : (unitIndex / unitsInTeam) * Math.PI * 2;

  let x =
    centerX +
    Math.cos(unitAngle) * spread;

  let y =
    centerY +
    Math.sin(unitAngle) * spread;

  x = Phaser.Math.Clamp(
    x,
    unitRadius + 5,
    arenaWidth - unitRadius - 5,
  );

  y = Phaser.Math.Clamp(
    y,
    unitRadius + 5,
    arenaHeight - unitRadius - 5,
  );

  return { x, y };
}
