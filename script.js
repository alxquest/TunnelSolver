class CRand {
  // Mirrors glibc's random()/rand() as shared in the referenced GnuRand snippet.
  constructor(seed) {
    const MOD31 = 2147483647n;
    const LEN = 344;
    const DEG = 31;

    this.state = new Array(LEN).fill(0n);
    const sanitizedSeed = BigInt(seed) % MOD31 || 1n; // glibc treats seed 0 as 1

    // Park–Miller to initialize r[0..30]
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

const form = document.getElementById("calculatorForm");
const playerIdInput = document.getElementById("playerId");
const tunnelLevelInput = document.getElementById("tunnelLevel");
const errorMessage = document.getElementById("errorMessage");
const seedValue = document.getElementById("seedValue");
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

function updateDirectionBadges(directions) {
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

  updateGridHighlight(directions);
}

function updateGridHighlight(directions) {
  gridCells.forEach((cell) => {
    cell.classList.remove(
      "active",
      "direction-left",
      "direction-middle",
      "direction-right"
    );
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

  if (!Number.isInteger(playerId) || playerId < 0) {
    throw new Error("Player ID must be a non-negative integer.");
  }

  if (!Number.isInteger(level) || level < 1) {
    throw new Error("Tunnel level must be at least 1.");
  }

  return { playerId, level };
}

function calculate() {
  let playerId;
  let level;
  try {
    ({ playerId, level } = validateInputs());
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

  updateDirectionBadges([first, second, third, fourth]);
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

// Seed with sample data for quick demo
playerIdInput.value = 57;
tunnelLevelInput.value = 57;
calculate();
