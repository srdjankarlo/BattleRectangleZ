import {
  Characters,
} from "./characters/Characters";

import type {
  CharacterId,
} from "./characters/Characters";

import {
  MovementType,
} from "./units/Movement";

import type {
  MovementOverride,
} from "./GameSetup";

import {
  ARENAS,
} from "./GameSetup";

import type {
  ArenaId,
  BattleSetup,
  GameMode,
  TeamSetup,
} from "./GameSetup";

// --------------------------------------------------
// MENU CLASS
// --------------------------------------------------

export class GameMenu {
  private readonly root: HTMLElement;

  private readonly onStart:
    (setup: BattleSetup) => void;

  private teams: TeamSetup[] = [
    this.createDefaultTeam(1),
    this.createDefaultTeam(2),
  ];

  constructor(
    root: HTMLElement,
    onStart: (
      setup: BattleSetup,
    ) => void,
  ) {
    this.root = root;
    this.onStart = onStart;

    this.render();
  }

  // ------------------------------------------------
  // DEFAULT TEAM
  // ------------------------------------------------

  private createDefaultTeam(
    id: number,
  ): TeamSetup {
    return {
      id,

      units: [
        {
          characterId: "KNIGHT",
          movementOverride:
            "default",
        },
      ],
    };
  }

  // ------------------------------------------------
  // RENDER MENU
  // ------------------------------------------------

  private render(): void {
    this.root.innerHTML = "";

    const menu =
      document.createElement(
        "div",
      );

    menu.className =
      "battle-menu";

    // ----------------------------------------------
    // Title
    // ----------------------------------------------

    const title =
      document.createElement(
        "h1",
      );

    title.textContent =
      "BATTLEBALL'Z";

    menu.appendChild(
      title,
    );

    const subtitle =
      document.createElement(
        "p",
      );

    subtitle.textContent =
      "Battle setup";

    subtitle.className =
      "menu-subtitle";

    menu.appendChild(
      subtitle,
    );

    // ----------------------------------------------
    // General settings
    // ----------------------------------------------

    const settings =
      document.createElement(
        "div",
      );

    settings.className =
      "menu-settings";

    // Game mode.
    settings.appendChild(
      this.createModeSelector(),
    );

    // Arena.
    settings.appendChild(
      this.createArenaSelector(),
    );

    // Number of teams.
    settings.appendChild(
      this.createTeamCountInput(),
    );

    menu.appendChild(
      settings,
    );

    // ----------------------------------------------
    // Error message
    // ----------------------------------------------

    const error =
      document.createElement(
        "div",
      );

    error.id =
      "battle-menu-error";

    menu.appendChild(
      error,
    );

    // ----------------------------------------------
    // Teams
    // ----------------------------------------------

    const teamsContainer =
      document.createElement(
        "div",
      );

    teamsContainer.id =
      "teams-container";

    this.renderTeams(
      teamsContainer,
    );

    menu.appendChild(
      teamsContainer,
    );

    // ----------------------------------------------
    // Start button
    // ----------------------------------------------

    const startButton =
      document.createElement(
        "button",
      );

    startButton.type =
      "button";

    startButton.className =
      "start-battle-button";

    startButton.textContent =
      "START BATTLE";

    startButton.addEventListener(
      "click",
      () => {
        this.startBattle();
      },
    );

    menu.appendChild(
      startButton,
    );

    this.root.appendChild(
      menu,
    );

    this.updateStartButton();
  }

  // ------------------------------------------------
  // MODE SELECTOR
  // ------------------------------------------------

  private createModeSelector(): HTMLElement {
    return this.createLabeledSelect(
      "GAME MODE",
      "game-mode",
      [
        {
          value: "simulation",
          label: "Simulation",
        },
        {
          value: "story",
          label: "Story Mode",
        },
        {
          value: "pvp",
          label: "PvP",
        },
      ],
      "simulation",
      (value) => {
        void value;

        this.updateStartButton();
      },
    );
  }

  // ------------------------------------------------
  // ARENA SELECTOR
  // ------------------------------------------------

  private createArenaSelector(): HTMLElement {
    const options =
      (
        Object.entries(
          ARENAS,
        ) as [
          ArenaId,
          (typeof ARENAS)[ArenaId],
        ][]
      ).map(
        ([id, arena]) => ({
          value: id,
          label: arena.label,
        }),
      );

    return this.createLabeledSelect(
      "ARENA",
      "arena",
      options,
      "small",
      () => {},
    );
  }

  // ------------------------------------------------
  // TEAM COUNT
  // ------------------------------------------------

  private createTeamCountInput(): HTMLElement {
    const wrapper =
      document.createElement(
        "label",
      );

    wrapper.className =
      "menu-field";

    const text =
      document.createElement(
        "span",
      );

    text.textContent =
      "NUMBER OF TEAMS";

    const input =
      document.createElement(
        "input",
      );

    input.type =
      "number";

    input.min = "2";

    input.max = "20";

    input.step = "1";

    input.value =
      this.teams.length.toString();

    input.addEventListener(
      "change",
      () => {
        this.changeTeamCount(
          Number(input.value),
        );
      },
    );

    wrapper.appendChild(
      text,
    );

    wrapper.appendChild(
      input,
    );

    return wrapper;
  }

  // ------------------------------------------------
  // GENERIC SELECT
  // ------------------------------------------------

  private createLabeledSelect(
    labelText: string,
    id: string,
    options: {
      value: string;
      label: string;
    }[],
    defaultValue: string,
    onChange: (
      value: string,
    ) => void,
  ): HTMLElement {
    const wrapper =
      document.createElement(
        "label",
      );

    wrapper.className =
      "menu-field";

    const label =
      document.createElement(
        "span",
      );

    label.textContent =
      labelText;

    const select =
      document.createElement(
        "select",
      );

    select.id = id;

    for (
      const optionData of options
    ) {
      const option =
        document.createElement(
          "option",
        );

      option.value =
        optionData.value;

      option.textContent =
        optionData.label;

      select.appendChild(
        option,
      );
    }

    select.value =
      defaultValue;

    select.addEventListener(
      "change",
      () => {
        onChange(
          select.value,
        );
      },
    );

    wrapper.appendChild(
      label,
    );

    wrapper.appendChild(
      select,
    );

    return wrapper;
  }

  // ------------------------------------------------
  // TEAMS
  // ------------------------------------------------

  private renderTeams(
    container: HTMLElement,
  ): void {
    container.innerHTML = "";

    for (
      const team of this.teams
    ) {
      const teamElement =
        document.createElement(
          "section",
        );

      teamElement.className =
        "team-section";

      const heading =
        document.createElement(
          "h2",
        );

      heading.textContent =
        `TEAM ${team.id}`;

      teamElement.appendChild(
        heading,
      );

      const unitsContainer =
        document.createElement(
          "div",
        );

      unitsContainer.className =
        "team-units";

      for (
        let unitIndex = 0;
        unitIndex <
          team.units.length;
        unitIndex++
      ) {
        const row =
          this.createUnitRow(
            team,
            unitIndex,
          );

        unitsContainer.appendChild(
          row,
        );
      }

      teamElement.appendChild(
        unitsContainer,
      );

      // --------------------------------------------
      // Add unit button
      // --------------------------------------------

      const addButton =
        document.createElement(
          "button",
        );

      addButton.type =
        "button";

      addButton.className =
        "secondary-button";

      addButton.textContent =
        "+ ADD UNIT";

      addButton.addEventListener(
        "click",
        () => {
          team.units.push({
            characterId:
              "KNIGHT",
            movementOverride:
              "default",
          });

          this.render();
        },
      );

      teamElement.appendChild(
        addButton,
      );

      container.appendChild(
        teamElement,
      );
    }
  }

  // ------------------------------------------------
  // UNIT ROW
  // ------------------------------------------------

  private createUnitRow(
    team: TeamSetup,
    unitIndex: number,
  ): HTMLElement {
    const unit =
      team.units[
        unitIndex
      ];

    const row =
      document.createElement(
        "div",
      );

    row.className =
      "unit-selection-row";

    // ----------------------------------------------
    // Character
    // ----------------------------------------------

    const characterSelect =
      document.createElement(
        "select",
      );

    characterSelect.className =
      "unit-character-select";

    const characterIds =
      Object.keys(
        Characters,
      ) as CharacterId[];

    for (
      const characterId
      of characterIds
    ) {
      const option =
        document.createElement(
          "option",
        );

      option.value =
        characterId;

      option.textContent =
        Characters[
          characterId
        ].name;

      characterSelect.appendChild(
        option,
      );
    }

    characterSelect.value =
      unit.characterId;

    characterSelect.addEventListener(
      "change",
      () => {
        unit.characterId =
          characterSelect.value as CharacterId;
      },
    );

    // ----------------------------------------------
    // Movement
    // ----------------------------------------------

    const movementSelect =
      document.createElement(
        "select",
      );

    movementSelect.className =
      "unit-movement-select";

    const movementOptions: {
      value: MovementOverride;
      label: string;
    }[] = [
      {
        value: "default",
        label: "Default",
      },
      {
        value: MovementType.BOUNCE,
        label: "Bounce",
      },
      {
        value: MovementType.WANDER,
        label: "Wander",
      },
      {
        value: MovementType.JITTER,
        label: "Jitter",
      },
    ];

    for (
      const optionData
      of movementOptions
    ) {
      const option =
        document.createElement(
          "option",
        );

      option.value =
        optionData.value;

      option.textContent =
        optionData.label;

      movementSelect.appendChild(
        option,
      );
    }

    movementSelect.value =
      unit.movementOverride;

    movementSelect.addEventListener(
      "change",
      () => {
        unit.movementOverride =
          movementSelect.value as MovementOverride;
      },
    );

    // ----------------------------------------------
    // Remove
    // ----------------------------------------------

    const removeButton =
      document.createElement(
        "button",
      );

    removeButton.type =
      "button";

    removeButton.className =
      "remove-unit-button";

    removeButton.textContent =
      "×";

    removeButton.title =
      "Remove unit";

    removeButton.addEventListener(
      "click",
      () => {
        team.units.splice(
          unitIndex,
          1,
        );

        this.render();
      },
    );

    row.appendChild(
      characterSelect,
    );

    row.appendChild(
      movementSelect,
    );

    row.appendChild(
      removeButton,
    );

    return row;
  }

  // ------------------------------------------------
  // TEAM COUNT CHANGE
  // ------------------------------------------------

  private changeTeamCount(
    requestedCount: number,
  ): void {
    const count =
      Math.max(
        2,
        Math.min(
          20,
          Math.floor(
            requestedCount,
          ),
        ),
      );

    while (
      this.teams.length <
      count
    ) {
      this.teams.push(
        this.createDefaultTeam(
          this.teams.length + 1,
        ),
      );
    }

    while (
      this.teams.length >
      count
    ) {
      this.teams.pop();
    }

    for (
      let i = 0;
      i < this.teams.length;
      i++
    ) {
      this.teams[i].id =
        i + 1;
    }

    this.render();
  }

  // ------------------------------------------------
  // START
  // ------------------------------------------------

  private startBattle(): void {
    const modeSelect =
      document.getElementById(
        "game-mode",
      ) as HTMLSelectElement;

    const arenaSelect =
      document.getElementById(
        "arena",
      ) as HTMLSelectElement;

    const error =
      document.getElementById(
        "battle-menu-error",
      );

    if (!error) {
      return;
    }

    error.textContent = "";

    const mode =
      modeSelect.value as GameMode;

    if (
      mode !==
      "simulation"
    ) {
      error.textContent =
        "This mode is not implemented yet.";

      return;
    }

    const emptyTeam =
      this.teams.find(
        (team) =>
          team.units.length === 0,
      );

    if (emptyTeam) {
      error.textContent =
        `Team ${emptyTeam.id} must contain at least one unit.`;

      return;
    }

    const arena =
      ARENAS[
        arenaSelect.value as ArenaId
      ];

    const setup: BattleSetup = {
      mode,

      arenaWidth:
        arena.width,

      arenaHeight:
        arena.height,

      teams:
        this.teams.map(
          (team) => ({
            id: team.id,

            units:
              team.units.map(
                (unit) => ({
                  ...unit,
                }),
              ),
          }),
        ),
    };

    this.onStart(
      setup,
    );
  }

  // ------------------------------------------------
  // START BUTTON STATE
  // ------------------------------------------------

  private updateStartButton(): void {
    const modeSelect =
      document.getElementById(
        "game-mode",
      ) as
        | HTMLSelectElement
        | null;

    const startButton =
      this.root.querySelector(
        ".start-battle-button",
      ) as
        | HTMLButtonElement
        | null;

    if (
      !modeSelect ||
      !startButton
    ) {
      return;
    }

    if (
      modeSelect.value ===
      "simulation"
    ) {
      startButton.disabled =
        false;

      startButton.textContent =
        "START SIMULATION";
    } else {
      startButton.disabled =
        true;

      startButton.textContent =
        modeSelect.value ===
        "story"
          ? "STORY MODE — COMING SOON"
          : "PVP — COMING SOON";
    }
  }

  // ------------------------------------------------
  // VISIBILITY
  // ------------------------------------------------

  show(): void {
    this.root.style.display =
      "block";
  }

  hide(): void {
    this.root.style.display =
      "none";
  }
}