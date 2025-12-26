class CRand {
  constructor(seed) {
    this.state = seed >>> 0;
  }

  rand() {
    // ANSI C style LCG (matches glibc behavior closely)
    this.state = (Math.imul(1103515245, this.state) + 12345) & 0x7fffffff;
    return (this.state >>> 16) & 0x7fff;
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
const overlayNodes = document.querySelectorAll(".path-overlay .node");
const prevLevelBtn = document.getElementById("prevLevel");
const nextLevelBtn = document.getElementById("nextLevel");
const prevLevelLabel = document.getElementById("prevLevelLabel");
const nextLevelLabel = document.getElementById("nextLevelLabel");
const currentLevelLabel = document.getElementById("currentLevelLabel");

function normalizeCValue(rawC) {
  // Map rand() % 3 (0,1,2) to 1..3 so we can surface "3" as described.
  return rawC === 0 ? 3 : rawC;
}

function formatDirection(value, position) {
  if (position === "first") {
    if (value === 2) return "Left";
    if (value === 1) return "Middle";
    return "Right";
  }

  if (position === "third") {
    if (value === 3) return "Left";
    if (value === 1) return "Middle";
    return "Right";
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

  overlayNodes.forEach((node, index) => {
    const badge = node.querySelector(".direction-pill");
    if (!badge) return;
    badge.textContent = directions[index];
    badge.classList.remove("direction-left", "direction-middle", "direction-right");
    badge.classList.add(directionClass(directions[index]));
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
  const c = normalizeCValue(cRaw);

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
