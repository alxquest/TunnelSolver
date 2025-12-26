class CRand {
  // Mirrors glibc's random()/rand() as shared in the referenced GnuRand snippet.
  constructor(seed) {
    const MOD31 = 2147483647n;
    const LEN = 344;
    const DEG = 31;

    this.state = new Array(LEN).fill(0n);
    const sanitizedSeed = BigInt(seed) % MOD31 || 1n; // glibc treats seed 0 as 1

    // Park-Miller to initialize r[0..30]
    this.state[0] = sanitizedSeed;
    for (let i = 1; i < DEG; i += 1) {
      this.state[i] = (16807n * this.state[i - 1]) % MOD31;
    }

    // r[31..33] = r[i-31]
    for (let i = DEG; i < DEG + 3; i += 1) {
      this.state[i] = this.state[i - DEG];
    }

    // r[34..343] = r[i-31] + r[i-3] (uint overflow semantics)
    for (let i = DEG + 3; i < LEN; i += 1) {
      this.state[i] = (this.state[i - DEG] + this.state[i - 3]) & 0xffffffffn;
    }

    this.index = 0;
  }

  rand() {
    // uint x = r[n % 344] = r[(n + 313) % 344] + r[(n + 341) % 344];
    const i = this.index % 344;
    const x =
      this.state[(this.index + 313) % 344] + this.state[(this.index + 341) % 344];
    this.state[i] = x & 0xffffffffn; // mimic uint overflow
    this.index = (this.index + 1) % 344;
    return Number((this.state[i] >> 1n) & 0x7fffffffn); // (int)(x >> 1)
  }
}

const directionClassMap = {
  left: "direction-left",
  middle: "direction-middle",
  right: "direction-right",
};

const AREA_ONE_BASE_FIRST_PART = 3;
const AREA_ONE_BASE_SECOND_PART = 2;
const AREA_ONE_CREEPER_ADDITIONS = {
  left: [4, 0, 8],
  middle: [0, 8, 4],
  right: [8, 4, 0],
};

const STORAGE_KEY = "tunnelCalculator.lastEntry";
const CHARACTER_LIST_KEY = "tunnelCalculator.characters";

const form = document.getElementById("calculatorForm");
const characterNameInput = document.getElementById("characterName");
const characterOptions = document.getElementById("characterOptions");
const playerIdInput = document.getElementById("playerId");
const tunnelLevelInput = document.getElementById("tunnelLevel");
const errorMessage = document.getElementById("errorMessage");
const characterStatus = document.getElementById("characterStatus");
const seedValue = document.getElementById("seedValue");
const characterNameDisplay = document.getElementById("characterNameDisplay");
const b1Value = document.getElementById("b1Value");
const b2Value = document.getElementById("b2Value");
const cValue = document.getElementById("cValue");
const area1Direction = document.getElementById("area1Direction");
const area2Direction = document.getElementById("area2Direction");
const area3Direction = document.getElementById("area3Direction");
const area4Direction = document.getElementById("area4Direction");
const gridCells = document.querySelectorAll(".tunnel-grid .cell");
const prevLevelBtn = document.getElementById("prevLevel");
const nextLevelBtn = document.getElementById("nextLevel");
const prevLevelLabel = document.getElementById("prevLevelLabel");
const nextLevelLabel = document.getElementById("nextLevelLabel");
const currentLevelLabel = document.getElementById("currentLevelLabel");
const removeCharacterBtn = document.getElementById("removeCharacter");
const savedCharactersList = document.getElementById("savedCharactersList");

let storedCharacters = loadStoredCharacters();

function computeAreaOneCreepers(b1, direction) {
  const additions = AREA_ONE_CREEPER_ADDITIONS[direction.toLowerCase()];
  if (!additions) return null;

  const firstPart = AREA_ONE_BASE_FIRST_PART;
  const added = additions[b1] ?? 0;
  const secondPart = AREA_ONE_BASE_SECOND_PART + added;

  return {
    total: firstPart + secondPart,
    firstPart,
    secondPart,
  };
}

function getCreeperCounts(directions, b1) {
  const counts = [null, null, null, null];

  const areaOneDirection = directions[0];
  const areaOneDetails = computeAreaOneCreepers(b1, areaOneDirection);

  if (areaOneDetails) {
    counts[0] = {
      ...areaOneDetails,
      summary: `${areaOneDetails.total} creepers (3 + ${areaOneDetails.secondPart})`,
    };
  }

  return counts;
}

function formatDirection(value, position) {
  if (position === "first") {
    if (value === 1) return "Left";
    if (value === 0) return "Middle";
    return "Right"; // value === 2
  }

  if (position === "third") {
    if (value === 2) return "Left";
    if (value === 0) return "Middle";
    return "Right"; // value === 1
  }

  if (position === "fourth") {
    return value === 0 ? "Left" : "Right";
  }

  // second area
  if (value === 0) return "Left";
  if (value === 1) return "Middle";
  return "Right";
}

function directionClass(direction) {
  return directionClassMap[direction.toLowerCase()] ?? "";
}

function updateDirectionBadges(directions, creeperCounts) {
  const labels = [
    { element: area1Direction, text: directions[0] },
    { element: area2Direction, text: directions[1] },
    { element: area3Direction, text: directions[2] },
    { element: area4Direction, text: directions[3] },
  ];

  labels.forEach(({ element, text }) => {
    element.textContent = text;
    element.classList.remove("direction-left", "direction-middle", "direction-right");
    element.classList.add(directionClass(text));
  });

  updateGridHighlight(directions, creeperCounts);
}

function updateGridHighlight(directions, creeperCounts) {
  gridCells.forEach((cell) => {
    cell.classList.remove(
      "active",
      "direction-left",
      "direction-middle",
      "direction-right"
    );
    cell.removeAttribute("data-creepers");
  });

  directions.forEach((dir, idx) => {
    const area = idx + 1;
    const target = document.querySelector(
      `.tunnel-grid .cell[data-area="${area}"][data-direction="${dir.toLowerCase()}"]`
    );
    if (target) {
      target.classList.add("active", directionClass(dir));
    }
  });
}

function validateInputs() {
  const playerId = Number(playerIdInput.value);
  const level = Number(tunnelLevelInput.value);
  const characterName = characterNameInput.value.trim();

  if (!Number.isInteger(playerId) || playerId < 0) {
    throw new Error("Player ID must be a non-negative integer.");
  }

  if (!Number.isInteger(level) || level < 1) {
    throw new Error("Tunnel level must be at least 1.");
  }

  return { playerId, level, characterName };
}

function loadStoredCharacters() {
  try {
    const raw = localStorage.getItem(CHARACTER_LIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => ({
        name: typeof entry.name === "string" ? entry.name.trim() : "",
        playerId: Number(entry.playerId),
        level: Number(entry.level),
      }))
      .filter(
        (entry) =>
          entry.name &&
          Number.isInteger(entry.playerId) &&
          Number.isInteger(entry.level)
      );
  } catch (err) {
    console.warn("Unable to read saved characters", err);
    return [];
  }
}

function saveStoredCharacters(characters) {
  try {
    localStorage.setItem(CHARACTER_LIST_KEY, JSON.stringify(characters));
  } catch (err) {
    console.warn("Unable to save characters", err);
  }
}

function loadLastEntry() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const playerId = Number(parsed.playerId);
    const level = Number(parsed.level);
    const name = typeof parsed.name === "string" ? parsed.name : "";
    if (!Number.isInteger(playerId) || !Number.isInteger(level)) {
      return null;
    }
    return { playerId, level, name };
  } catch (err) {
    console.warn("Unable to read saved entry", err);
    return null;
  }
}

function persistEntry(entry) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entry));
  } catch (err) {
    console.warn("Unable to save entry", err);
  }
}

function updateCharacterLabel(name) {
  const displayName = name && name.trim() ? name.trim() : "--";
  characterNameDisplay.textContent = displayName;
}

function namesMatch(a, b) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function findStoredCharacter(name) {
  return storedCharacters.find((entry) => namesMatch(entry.name, name));
}

function refreshCharacterOptions(selectedName = "") {
  while (characterOptions.firstChild) {
    characterOptions.removeChild(characterOptions.firstChild);
  }

  const sorted = [...storedCharacters].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  sorted.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.name;
    option.dataset.playerId = `${entry.playerId}`;
    option.dataset.level = `${entry.level}`;
    characterOptions.appendChild(option);
  });

  if (selectedName) {
    const matching = sorted.find((entry) => namesMatch(entry.name, selectedName));
    if (matching) {
      characterNameInput.value = matching.name;
    }
  }

  renderSavedCharacters(selectedName);
}

function saveCharacter(entry) {
  const name = entry.name?.trim();
  if (!name) return;

  const existingIndex = storedCharacters.findIndex((item) => namesMatch(item.name, name));
  const normalized = {
    name,
    playerId: entry.playerId,
    level: entry.level,
  };

  if (existingIndex >= 0) {
    storedCharacters[existingIndex] = normalized;
  } else {
    storedCharacters.push(normalized);
  }

  saveStoredCharacters(storedCharacters);
  refreshCharacterOptions(name);
}

function renderSavedCharacters(selectedName = "") {
  if (!savedCharactersList) return;

  while (savedCharactersList.firstChild) {
    savedCharactersList.removeChild(savedCharactersList.firstChild);
  }

  if (!storedCharacters.length) {
    const empty = document.createElement("p");
    empty.className = "muted saved-list__empty";
    empty.textContent = "No saved characters yet.";
    savedCharactersList.appendChild(empty);
    return;
  }

  const sorted = [...storedCharacters].sort((a, b) => a.name.localeCompare(b.name));
  const list = document.createElement("ul");
  list.className = "saved-list";

  sorted.forEach((entry) => {
    const item = document.createElement("li");
    item.className = "saved-list__item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "ghost saved-list__load";
    button.dataset.name = entry.name;
    button.dataset.playerId = `${entry.playerId}`;
    button.dataset.level = `${entry.level}`;

    const nameLabel = document.createElement("div");
    nameLabel.className = "saved-list__name";
    nameLabel.textContent = entry.name;

    const meta = document.createElement("div");
    meta.className = "saved-list__meta";
    meta.textContent = `ID ${entry.playerId} • Level ${entry.level}`;

    button.appendChild(nameLabel);
    button.appendChild(meta);

    if (selectedName && namesMatch(entry.name, selectedName)) {
      button.classList.add("is-selected");
    }

    item.appendChild(button);
    list.appendChild(item);
  });

  savedCharactersList.appendChild(list);
}

function showStatus(message = "") {
  characterStatus.textContent = message;
}

function loadCharacterFromInput() {
  const name = characterNameInput.value.trim();
  if (!name) {
    showStatus("");
    return;
  }

  const match = findStoredCharacter(name);
  if (!match) {
    showStatus("No saved data for that character yet.");
    return;
  }

  loadCharacterEntry(match);
}

function loadCharacterEntry(entry) {
  playerIdInput.value = entry.playerId;
  tunnelLevelInput.value = entry.level;
  characterNameInput.value = entry.name;
  updateCharacterLabel(entry.name);
  showStatus("Loaded saved character.");
  refreshCharacterOptions(entry.name);
  calculate();
}

function removeCharacter() {
  const name = characterNameInput.value.trim();
  if (!name) {
    showStatus("Enter a name to remove it from saved characters.");
    return;
  }

  const before = storedCharacters.length;
  storedCharacters = storedCharacters.filter((entry) => !namesMatch(entry.name, name));

  if (storedCharacters.length === before) {
    showStatus("No saved character matched that name.");
    return;
  }

  saveStoredCharacters(storedCharacters);
  refreshCharacterOptions();
  renderSavedCharacters();
  showStatus("Removed saved character.");
}

function calculate() {
  let playerId;
  let level;
  let characterName;
  try {
    ({ playerId, level, characterName } = validateInputs());
    errorMessage.textContent = "";
  } catch (err) {
    errorMessage.textContent = err.message;
    return;
  }

  const seed = Number((BigInt(playerId) * BigInt(level)) & BigInt(0xffffffff));
  const rng = new CRand(seed);

  const b1 = rng.rand() % 3;
  const b2 = rng.rand() % 2;
  const cRaw = rng.rand() % 3;
  const c = cRaw;

  const first = formatDirection(c, "first");
  const second = formatDirection(b1, "second");
  const third = formatDirection(c, "third");
  const fourth = formatDirection(b2, "fourth");

  seedValue.textContent = `${seed}`;
  b1Value.textContent = `${b1}`;
  b2Value.textContent = `${b2}`;
  cValue.textContent = `${c}`;
  updateCharacterLabel(characterName);
  persistEntry({ playerId, level, name: characterName });
  if (characterName.trim()) {
    saveCharacter({ playerId, level, name: characterName });
    showStatus("Saved character entry.");
  } else {
    showStatus("");
  }

  const creeperCounts = getCreeperCounts([first, second, third, fourth], b1);

  updateDirectionBadges([first, second, third, fourth], creeperCounts);
  updateLevelLabels(level);
}

function updateLevelLabels(level) {
  currentLevelLabel.textContent = level;

  const prevLevel = Math.max(level - 1, 1);
  const nextLevel = level + 1;

  prevLevelLabel.textContent = prevLevel;
  nextLevelLabel.textContent = nextLevel;
}

function nudgeLevel(delta) {
  const current = Number(tunnelLevelInput.value) || 1;
  const nextLevel = Math.max(current + delta, 1);
  tunnelLevelInput.value = nextLevel;
  calculate();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  calculate();
});

prevLevelBtn.addEventListener("click", () => nudgeLevel(-1));
nextLevelBtn.addEventListener("click", () => nudgeLevel(1));
characterNameInput.addEventListener("input", loadCharacterFromInput);
characterNameInput.addEventListener("change", loadCharacterFromInput);
characterNameInput.addEventListener("blur", loadCharacterFromInput);
removeCharacterBtn.addEventListener("click", removeCharacter);
savedCharactersList?.addEventListener("click", (event) => {
  const target = event.target.closest("button[data-name]");
  if (!target) return;

  const entry = {
    name: target.dataset.name ?? "",
    playerId: Number(target.dataset.playerId),
    level: Number(target.dataset.level),
  };

  if (!entry.name || Number.isNaN(entry.playerId) || Number.isNaN(entry.level)) return;
  loadCharacterEntry(entry);
});

refreshCharacterOptions();
const saved = loadLastEntry();
const savedCharacter = saved?.name ? findStoredCharacter(saved.name) : null;
playerIdInput.value = savedCharacter?.playerId ?? saved?.playerId ?? 57;
tunnelLevelInput.value = savedCharacter?.level ?? saved?.level ?? 10;
characterNameInput.value = savedCharacter?.name ?? saved?.name ?? "";
renderSavedCharacters(characterNameInput.value);
calculate();
