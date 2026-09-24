import {
  Characters,
  CharacterDivisions,
  type CharacterId,
} from "./characters/Characters";
import type {
  BattleSetup,
  GameMode,
  MovementOverride,
  UnitSelection,
} from "./GameSetup";

// --------------------------------------------------
// MENU DATA
// --------------------------------------------------

type ArenaOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

type TeamState = {
  id: number;
  units: UnitSelection[];
};

const ARENAS: ArenaOption[] = [
  { id: "tiny", label: "Tiny", width: 200, height: 200 },
  { id: "small", label: "Small", width: 500, height: 500 },
  { id: "medium", label: "Medium", width: 1000, height: 1000 },
  { id: "big", label: "Big", width: 1500, height: 1500 },
  { id: "large", label: "Large", width: 2000, height: 2000 },
];

const DEFAULT_SELECTION: UnitSelection = {
  characterId: "KNIGHT" as CharacterId,
  movementOverride: "default",
};

const MIN_TEAMS = 1;
const MAX_TEAMS = 8;

// --------------------------------------------------
// GAME MENU
// --------------------------------------------------

export class GameMenu {
  private readonly root: HTMLElement;
  private readonly onStart: (setup: BattleSetup) => void;

  // These values are the actual menu state.
  // Rendering HTML must never reset them.
  private mode: GameMode = "simulation";
  private arenaId = "tiny";
  private teamCount = 2;

  private teams: TeamState[] = [
    {
      id: 1,
      units: [this.cloneSelection(DEFAULT_SELECTION)],
    },
    {
      id: 2,
      units: [this.cloneSelection(DEFAULT_SELECTION)],
    },
  ];

  constructor(
    root: HTMLElement,
    onStart: (setup: BattleSetup) => void,
  ) {
    this.root = root;
    this.onStart = onStart;

    this.root.classList.add("battlerectanglez-menu-root");
    this.render();
  }

  hide(): void {
    this.root.classList.add("hidden");
  }

  show(): void {
    this.root.classList.remove("hidden");
  }

  // --------------------------------------------------
  // FULL MENU RENDER
  // --------------------------------------------------

  private render(): void {
    this.root.innerHTML = `
      <main class="bb-menu">
        <section class="bb-hero">
          <div class="bb-logo-mark">BRZ</div>
          <div class="bb-kicker">BATTLE SIMULATOR</div>
          <h1>BattleRectangle'z</h1>
          <p>Choose the battlefield, build the teams, and let them fight.</p>
        </section>

        <section class="bb-panel bb-setup-panel">
          <div class="bb-panel-heading">
            <div>
              <div class="bb-section-kicker">MATCH SETUP</div>
              <h2>Configure battle</h2>
            </div>
            <div class="bb-status-pill">SIMULATION ONLINE</div>
          </div>

          <div class="bb-match-options">
            <section class="bb-setting-block">
              <div class="bb-setting-label">GAME MODE</div>
              <div id="bb-mode-options" class="bb-mode-options"></div>
            </section>

            <section class="bb-setting-block bb-arena-section">
              <div class="bb-setting-label">ARENA</div>
              <div id="bb-arena-options" class="bb-arena-options"></div>
            </section>

            <section class="bb-setting-block bb-team-count-section">
              <div class="bb-setting-label">NUMBER OF TEAMS</div>
              <div class="bb-number-control">
                <button
                  id="bb-team-minus"
                  class="bb-step-button"
                  type="button"
                  aria-label="Decrease number of teams"
                >−</button>
                <input
                  id="bb-team-count"
                  type="number"
                  min="${MIN_TEAMS}"
                  max="${MAX_TEAMS}"
                  step="1"
                  inputmode="numeric"
                  aria-label="Number of teams"
                />
                <button
                  id="bb-team-plus"
                  class="bb-step-button"
                  type="button"
                  aria-label="Increase number of teams"
                >+</button>
              </div>
              <div class="bb-setting-hint">1–8 teams</div>
            </section>
          </div>

          <div class="bb-divider"></div>

          <div class="bb-panel-heading bb-teams-heading">
            <div>
              <div class="bb-section-kicker">ROSTER</div>
              <h2>Your teams</h2>
            </div>
            <span class="bb-hint">New units copy the previous unit</span>
          </div>

          <div id="bb-mode-message" class="bb-mode-message hidden"></div>
          <div id="bb-teams" class="bb-teams"></div>

          <div class="bb-actions">
            <button id="bb-start" class="bb-primary-button" type="button">
              <span>START BATTLE</span>
              <span class="bb-button-arrow">→</span>
            </button>
          </div>
        </section>

        <footer class="bb-footer">
          <span>BATTLERECTANGLE'Z // EARLY BUILD</span>
          <span>Simulation is currently playable</span>
        </footer>
      </main>
    `;

    this.renderModeOptions();
    this.renderArenaOptions();
    this.syncTopControls();
    this.renderTeams();
    this.bindStaticEvents();
    this.updateModeAvailability();
  }

  // --------------------------------------------------
  // MODE
  // --------------------------------------------------

  private renderModeOptions(): void {
    const container = this.getElement<HTMLElement>("#bb-mode-options");

    const modes: Array<{
      value: GameMode;
      title: string;
      description: string;
      available: boolean;
    }> = [
      {
        value: "simulation",
        title: "Simulation",
        description: "Bot vs bot",
        available: true,
      },
      {
        value: "story",
        title: "Story Mode",
        description: "Coming soon",
        available: false,
      },
      {
        value: "pvp",
        title: "PvP",
        description: "Coming soon",
        available: false,
      },
    ];

    container.innerHTML = modes
      .map(
        (mode) => `
          <button
            type="button"
            class="bb-mode-option ${this.mode === mode.value ? "selected" : ""} ${mode.available ? "" : "unavailable"}"
            data-mode="${mode.value}"
          >
            <span class="bb-mode-title">${mode.title}</span>
            <span class="bb-mode-description">${mode.description}</span>
          </button>
        `,
      )
      .join("");
  }

  private renderArenaOptions(): void {
    const container = this.getElement<HTMLElement>("#bb-arena-options");

    container.innerHTML = ARENAS.map(
      (arena) => `
        <button
          type="button"
          class="bb-arena-option ${this.arenaId === arena.id ? "selected" : ""}"
          data-arena-id="${arena.id}"
        >
          <span class="bb-arena-name">${arena.label}</span>
          <span class="bb-arena-size">${arena.width} × ${arena.height}</span>
        </button>
      `,
    ).join("");
  }

  private syncTopControls(): void {
    const teamCountInput =
      this.getElement<HTMLInputElement>("#bb-team-count");

    teamCountInput.value = String(this.teamCount);
  }

  // --------------------------------------------------
  // TEAM RENDERING
  // --------------------------------------------------

  private renderTeams(): void {
    const container = this.getElement<HTMLElement>("#bb-teams");

    container.innerHTML = this.teams
      .map(
        (team) => `
          <section class="bb-team-card" data-team-id="${team.id}">
            <div class="bb-team-card-header">
              <div class="bb-team-title">
                <span class="bb-team-number">TEAM ${team.id}</span>
              </div>
              <span class="bb-unit-count">${team.units.length} UNIT${team.units.length === 1 ? "" : "S"}</span>
            </div>

            <div class="bb-unit-list">
              ${team.units
                .map(
                  (_unit, unitIndex) => `
                    <div
                      class="bb-unit-row"
                      data-team-id="${team.id}"
                      data-unit-index="${unitIndex}"
                    >
                      <span class="bb-unit-index">${String(unitIndex + 1).padStart(2, "0")}</span>

                      <label class="bb-unit-field">
                        <span>Character</span>
                        <select class="bb-unit-character" aria-label="Character"></select>
                      </label>

                      <label class="bb-unit-field">
                        <span>Movement</span>
                        <select class="bb-unit-movement" aria-label="Movement"></select>
                      </label>

                      <button
                        class="bb-remove-unit"
                        type="button"
                        aria-label="Remove unit"
                      >×</button>
                    </div>
                  `,
                )
                .join("")}
            </div>

            <button
              class="bb-add-unit"
              type="button"
              data-team-id="${team.id}"
            >
              + ADD UNIT
            </button>
          </section>
        `,
      )
      .join("");

    this.populateUnitSelects();
    this.bindTeamEvents();
  }

  private populateUnitSelects(): void {
    const characterOptions = CharacterDivisions
      .map(
        (division) => `
          <optgroup label="${division.name}">
            ${division.characters
              .map((id) => {
                const config = Characters[id];
                return `<option value="${id}">${config.name}</option>`;
              })
              .join("")}
          </optgroup>
        `,
      )
      .join("");

    const movementOptions = `
      <option value="default">Default</option>
      <option value="bounce">Bounce</option>
      <option value="wander">Wander</option>
      <option value="jitter">Jitter</option>
    `;

    const rows = Array.from(
      this.root.querySelectorAll<HTMLElement>(".bb-unit-row"),
    );

    for (const row of rows) {
      const teamId = Number(row.dataset.teamId);
      const unitIndex = Number(row.dataset.unitIndex);
      const unit = this.getUnit(teamId, unitIndex);

      if (!unit) {
        continue;
      }

      const characterSelect =
        row.querySelector<HTMLSelectElement>(".bb-unit-character");
      const movementSelect =
        row.querySelector<HTMLSelectElement>(".bb-unit-movement");

      if (!characterSelect || !movementSelect) {
        continue;
      }

      characterSelect.innerHTML = characterOptions;
      movementSelect.innerHTML = movementOptions;

      characterSelect.value = unit.characterId;
      movementSelect.value = unit.movementOverride;
    }
  }

  // --------------------------------------------------
  // EVENTS
  // --------------------------------------------------

  private bindStaticEvents(): void {
    this.bindModeEvents();
    this.bindArenaEvents();

    const minusButton =
      this.getElement<HTMLButtonElement>("#bb-team-minus");
    const plusButton =
      this.getElement<HTMLButtonElement>("#bb-team-plus");
    const input =
      this.getElement<HTMLInputElement>("#bb-team-count");

    minusButton.addEventListener("click", () => {
      this.setTeamCount(this.teamCount - 1);
    });

    plusButton.addEventListener("click", () => {
      this.setTeamCount(this.teamCount + 1);
    });

    input.addEventListener("change", () => {
      const requested = Number(input.value);

      if (!Number.isFinite(requested)) {
        input.value = String(this.teamCount);
        return;
      }

      this.setTeamCount(requested);
    });

    this.getElement<HTMLButtonElement>("#bb-start").addEventListener(
      "click",
      () => {
        this.startBattle();
      },
    );
  }

  private bindModeEvents(): void {
    const modeButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>(".bb-mode-option"),
    );

    for (const button of modeButtons) {
      button.addEventListener("click", () => {
        const nextMode = button.dataset.mode as GameMode | undefined;

        if (!nextMode) {
          return;
        }

        this.mode = nextMode;
        this.renderModeOptions();
        this.bindModeEvents();
        this.updateModeAvailability();
      });
    }
  }

  private bindArenaEvents(): void {
    const arenaButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>(".bb-arena-option"),
    );

    for (const button of arenaButtons) {
      button.addEventListener("click", () => {
        const arenaId = button.dataset.arenaId;

        if (!arenaId) {
          return;
        }

        // Only this event changes arenaId.
        // Team/roster changes never touch the selected arena.
        this.arenaId = arenaId;
        this.renderArenaOptions();
        this.bindArenaEvents();
      });
    }
  }

  private bindTeamEvents(): void {
    const characterSelects = Array.from(
      this.root.querySelectorAll<HTMLSelectElement>(".bb-unit-character"),
    );

    for (const select of characterSelects) {
      select.addEventListener("change", (event) => {
        const target = event.currentTarget as HTMLSelectElement;
        const row = target.closest<HTMLElement>(".bb-unit-row");

        if (!row) {
          return;
        }

        const teamId = Number(row.dataset.teamId);
        const unitIndex = Number(row.dataset.unitIndex);
        const unit = this.getUnit(teamId, unitIndex);

        if (!unit) {
          return;
        }

        unit.characterId = target.value as CharacterId;
      });
    }

    const movementSelects = Array.from(
      this.root.querySelectorAll<HTMLSelectElement>(".bb-unit-movement"),
    );

    for (const select of movementSelects) {
      select.addEventListener("change", (event) => {
        const target = event.currentTarget as HTMLSelectElement;
        const row = target.closest<HTMLElement>(".bb-unit-row");

        if (!row) {
          return;
        }

        const teamId = Number(row.dataset.teamId);
        const unitIndex = Number(row.dataset.unitIndex);
        const unit = this.getUnit(teamId, unitIndex);

        if (!unit) {
          return;
        }

        unit.movementOverride = target.value as MovementOverride;
      });
    }

    const removeButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>(".bb-remove-unit"),
    );

    for (const button of removeButtons) {
      button.addEventListener("click", (event) => {
        const target = event.currentTarget as HTMLButtonElement;
        const row = target.closest<HTMLElement>(".bb-unit-row");

        if (!row) {
          return;
        }

        const teamId = Number(row.dataset.teamId);
        const unitIndex = Number(row.dataset.unitIndex);
        const team = this.teams.find((item) => item.id === teamId);

        if (!team || team.units.length === 1) {
          return;
        }

        team.units.splice(unitIndex, 1);
        this.renderTeams();
      });
    }

    const addButtons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>(".bb-add-unit"),
    );

    for (const button of addButtons) {
      button.addEventListener("click", (event) => {
        const target = event.currentTarget as HTMLButtonElement;
        const teamId = Number(target.dataset.teamId);
        const team = this.teams.find((item) => item.id === teamId);

        if (!team) {
          return;
        }

        // IMPORTANT:
        // Copy the last unit in this team.
        // This is why adding another unit keeps the previous
        // character and movement selection by default.
        const previousUnit = team.units.at(-1);
        const nextUnit = previousUnit
          ? this.cloneSelection(previousUnit)
          : this.cloneSelection(DEFAULT_SELECTION);

        team.units.push(nextUnit);
        this.renderTeams();
      });
    }
  }

  // --------------------------------------------------
  // TEAM COUNT
  // --------------------------------------------------

  private setTeamCount(requestedCount: number): void {
    const newCount = Math.max(
      MIN_TEAMS,
      Math.min(MAX_TEAMS, Math.round(requestedCount)),
    );

    while (this.teams.length < newCount) {
      const teamId = this.teams.length + 1;

      this.teams.push({
        id: teamId,
        units: [this.cloneSelection(DEFAULT_SELECTION)],
      });
    }

    if (this.teams.length > newCount) {
      this.teams = this.teams.slice(0, newCount);
    }

    this.teamCount = newCount;

    const input =
      this.getElement<HTMLInputElement>("#bb-team-count");
    input.value = String(this.teamCount);

    this.renderTeams();
  }

  // --------------------------------------------------
  // MODE VISIBILITY
  // --------------------------------------------------

  private updateModeAvailability(): void {
    const arenaSection =
      this.getElement<HTMLElement>(".bb-arena-section");
    const teamCountSection =
      this.getElement<HTMLElement>(".bb-team-count-section");
    const startButton =
      this.getElement<HTMLButtonElement>("#bb-start");
    const message =
      this.getElement<HTMLElement>("#bb-mode-message");

    const storyMode = this.mode === "story";
    const playable = this.mode === "simulation";

    arenaSection.classList.toggle("hidden", storyMode);
    teamCountSection.classList.toggle("hidden", storyMode);

    startButton.disabled = !playable;

    if (!playable) {
      message.textContent =
        this.mode === "story"
          ? "Story Mode is planned but is not playable yet."
          : "PvP is planned but is not playable yet.";
      message.classList.remove("hidden");
    } else {
      message.textContent = "";
      message.classList.add("hidden");
    }
  }

  // --------------------------------------------------
  // START BATTLE
  // --------------------------------------------------

  private startBattle(): void {
    if (this.mode !== "simulation") {
      return;
    }

    const arena = ARENAS.find(
      (item) => item.id === this.arenaId,
    );

    if (!arena) {
      return;
    }

    const setup: BattleSetup = {
      mode: this.mode,
      arenaWidth: arena.width,
      arenaHeight: arena.height,
      teams: this.teams.map((team) => ({
        id: team.id,
        units: team.units.map((unit) =>
          this.cloneSelection(unit),
        ),
      })),
    };

    this.onStart(setup);
  }

  // --------------------------------------------------
  // HELPERS
  // --------------------------------------------------

  private getUnit(
    teamId: number,
    unitIndex: number,
  ): UnitSelection | undefined {
    return this.teams
      .find((team) => team.id === teamId)
      ?.units[unitIndex];
  }

  private cloneSelection(
    selection: UnitSelection,
  ): UnitSelection {
    return {
      characterId: selection.characterId,
      movementOverride: selection.movementOverride,
    };
  }

  private getElement<T extends Element>(selector: string): T {
    const element = this.root.querySelector<T>(selector);

    if (!element) {
      throw new Error(
        `BattleRectanglez menu element not found: ${selector}`,
      );
    }

    return element;
  }
}
