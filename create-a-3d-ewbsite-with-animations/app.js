const storageKeys = {
  users: "multiGame.users",
  session: "multiGame.session",
  tempSession: "multiGame.tempSession",
  otp: "multiGame.otp",
};

const games = [
  {
    id: "snake",
    title: "Snake Game",
    tag: "Grid Rush",
    accent: "#2ff7ff",
    soft: "rgba(47, 247, 255, 0.2)",
    copy: "A glowing arena chase with fast turns, food pickups, and rising score pressure.",
  },
  {
    id: "sidi",
    title: "Sidi Game",
    tag: "Arcade Dash",
    accent: "#ff3df2",
    soft: "rgba(255, 61, 242, 0.2)",
    copy: "A classic lane dodger with falling hazards, neon pickups, and arcade momentum.",
  },
  {
    id: "cards",
    title: "Cards Game",
    tag: "Memory Deck",
    accent: "#80ff72",
    soft: "rgba(128, 255, 114, 0.18)",
    copy: "Flip the cyber cards, match every pair, and keep the move count sharp.",
  },
  {
    id: "zero-x",
    title: "Zero X",
    tag: "Tic Tac Toe",
    accent: "#ffd166",
    soft: "rgba(255, 209, 102, 0.2)",
    copy: "A polished local duel board for X and O with instant round history.",
  },
  {
    id: "pong",
    title: "Neon Pong",
    tag: "Solo Rally",
    accent: "#9d7cff",
    soft: "rgba(157, 124, 255, 0.2)",
    copy: "Keep the plasma ball alive with a responsive paddle and clean bounce physics.",
  },
  {
    id: "reflex",
    title: "Reflex Tap",
    tag: "Aim Burst",
    accent: "#ff4b6e",
    soft: "rgba(255, 75, 110, 0.2)",
    copy: "Tap the moving energy target before the clock drains and stack your hits.",
  },
];

const state = {
  authMode: "login",
  currentUser: null,
  activeGame: null,
  cleanupGame: null,
  liveScore: 0,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const views = {
  auth: $("#authView"),
  dashboard: $("#dashboardView"),
  game: $("#gameView"),
};

const authForm = $("#authForm");
const emailInput = $("#emailInput");
const passwordInput = $("#passwordInput");
const confirmInput = $("#confirmInput");
const confirmWrap = $("#confirmWrap");
const rememberWrap = $("#rememberWrap");
const rememberInput = $("#rememberInput");
const otpInput = $("#otpInput");
const otpRelay = $("#otpRelay");
const otpCode = $("#otpCode");
const authSubmitBtn = $("#authSubmitBtn");
const profileEmail = $("#profileEmail");
const gamesGrid = $("#gamesGrid");
const historyList = $("#historyList");
const totalPlays = $("#totalPlays");
const bestScore = $("#bestScore");
const lastGame = $("#lastGame");
const gameTitle = $("#gameTitle");
const liveScore = $("#liveScore");
const liveBest = $("#liveBest");
const gameMount = $("#gameMount");
const gameShell = $("#gameShell");
const loadingLayer = $("#loadingLayer");
const toastStack = $("#toastStack");

function getJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function digest(value) {
  if (crypto.subtle) {
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < value.length; index += 1) {
    const char = value.charCodeAt(index);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

async function hashPassword(password, salt) {
  return digest(`${salt}:${password}`);
}

function getUsers() {
  return getJson(storageKeys.users, {});
}

function saveUsers(users) {
  setJson(storageKeys.users, users);
}

function getHistory(email = state.currentUser) {
  if (!email) return [];
  return getJson(`multiGame.history.${email}`, []);
}

function saveHistory(history, email = state.currentUser) {
  if (!email) return;
  setJson(`multiGame.history.${email}`, history.slice(0, 50));
}

function getBestForGame(gameId) {
  return getHistory()
    .filter((item) => item.gameId === gameId)
    .reduce((best, item) => Math.max(best, Number(item.score) || 0), 0);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toastStack.append(toast);
  window.setTimeout(() => toast.remove(), 3200);
}

function switchView(name) {
  Object.values(views).forEach((view) => view.classList.remove("active"));
  views[name].classList.add("active");
}

function setAuthMode(mode) {
  state.authMode = mode;
  $$(".tab-btn").forEach((button) => button.classList.toggle("active", button.dataset.authMode === mode));
  confirmWrap.classList.toggle("hidden", mode !== "signup");
  rememberWrap.classList.toggle("hidden", mode !== "login");
  authSubmitBtn.textContent = mode === "signup" ? "Create Account" : "Enter Dashboard";
  passwordInput.autocomplete = mode === "signup" ? "new-password" : "current-password";
  otpRelay.classList.add("hidden");
  otpInput.value = "";
}

function storeOtp(email, mode, code) {
  const otps = getJson(storageKeys.otp, {});
  otps[email] = {
    mode,
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };
  sessionStorage.setItem(storageKeys.otp, JSON.stringify(otps));
}

function getOtp(email) {
  try {
    const otps = JSON.parse(sessionStorage.getItem(storageKeys.otp)) || {};
    return otps[email];
  } catch {
    return null;
  }
}

function clearOtp(email) {
  try {
    const otps = JSON.parse(sessionStorage.getItem(storageKeys.otp)) || {};
    delete otps[email];
    sessionStorage.setItem(storageKeys.otp, JSON.stringify(otps));
  } catch {
    sessionStorage.removeItem(storageKeys.otp);
  }
}

function saveSession(email) {
  if (rememberInput.checked || state.authMode === "signup") {
    localStorage.setItem(storageKeys.session, email);
    sessionStorage.removeItem(storageKeys.tempSession);
  } else {
    sessionStorage.setItem(storageKeys.tempSession, email);
    localStorage.removeItem(storageKeys.session);
  }
}

function getSavedSession() {
  return localStorage.getItem(storageKeys.session) || sessionStorage.getItem(storageKeys.tempSession);
}

async function sendOtp() {
  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const users = getUsers();

  if (!email || password.length < 6) {
    showToast("Enter a valid email and a 6 character password.");
    return;
  }

  if (state.authMode === "signup" && users[email]) {
    showToast("This email already has a Multi-Game account.");
    return;
  }

  if (state.authMode === "login" && !users[email]) {
    showToast("Create an account before logging in.");
    return;
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  storeOtp(email, state.authMode, code);
  otpCode.textContent = code;
  otpRelay.classList.remove("hidden");
  showToast(`OTP sent to ${email}`);
}

async function handleAuth(event) {
  event.preventDefault();

  const email = normalizeEmail(emailInput.value);
  const password = passwordInput.value;
  const confirm = confirmInput.value;
  const otp = otpInput.value.trim();
  const users = getUsers();
  const record = users[email];
  const otpRecord = getOtp(email);

  if (!email || password.length < 6) {
    showToast("Check your email and password.");
    return;
  }

  if (!otpRecord || otpRecord.code !== otp || otpRecord.mode !== state.authMode || otpRecord.expiresAt < Date.now()) {
    showToast("OTP verification failed.");
    return;
  }

  if (state.authMode === "signup") {
    if (password !== confirm) {
      showToast("Passwords do not match.");
      return;
    }

    if (record) {
      showToast("This email already exists.");
      return;
    }

    const salt = generateSalt();
    users[email] = {
      salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    };
    saveUsers(users);
  } else {
    if (!record) {
      showToast("Account not found.");
      return;
    }

    const candidateHash = await hashPassword(password, record.salt);
    if (candidateHash !== record.passwordHash) {
      showToast("Password check failed.");
      return;
    }
  }

  clearOtp(email);
  state.currentUser = email;
  saveSession(email);
  openDashboard();
  showToast(`Welcome, ${email}`);
}

function logout() {
  if (state.cleanupGame) state.cleanupGame();
  state.currentUser = null;
  localStorage.removeItem(storageKeys.session);
  sessionStorage.removeItem(storageKeys.tempSession);
  authForm.reset();
  setAuthMode("login");
  switchView("auth");
}

function openDashboard() {
  state.activeGame = null;
  state.liveScore = 0;
  if (state.cleanupGame) {
    state.cleanupGame();
    state.cleanupGame = null;
  }
  gameMount.innerHTML = "";
  profileEmail.textContent = state.currentUser;
  renderDashboard();
  switchView("dashboard");
}

function renderDashboard() {
  renderStats();
  renderGames();
  renderHistory();
}

function renderStats() {
  const history = getHistory();
  totalPlays.textContent = history.length;
  bestScore.textContent = history.reduce((best, item) => Math.max(best, Number(item.score) || 0), 0);
  lastGame.textContent = history[0]?.title || "None";
}

function renderGames() {
  gamesGrid.innerHTML = games
    .map((game) => {
      const best = getBestForGame(game.id);
      return `
        <button class="game-card tilt-card" type="button" data-game="${game.id}"
          style="--accent: ${game.accent}; --accent-soft: ${game.soft}">
          <p class="eyebrow">${game.tag}</p>
          <h3>${game.title}</h3>
          <p>${game.copy}</p>
          <div class="game-chip-row">
            <span class="game-chip">Best ${best}</span>
            <span class="play-pill">Play</span>
          </div>
        </button>
      `;
    })
    .join("");
}

function renderHistory() {
  const history = getHistory();

  if (!history.length) {
    historyList.innerHTML = `<div class="empty-history">No games played yet.</div>`;
    return;
  }

  historyList.innerHTML = history
    .map((item) => {
      const date = new Date(item.playedAt);
      return `
        <article class="history-item">
          <span class="history-dot"></span>
          <div>
            <strong>${item.title}</strong>
            <span>${date.toLocaleString()}</span>
          </div>
          <span class="history-score">${item.score}</span>
        </article>
      `;
    })
    .join("");
}

function setLiveScore(score) {
  state.liveScore = Math.max(0, Math.round(score));
  liveScore.textContent = state.liveScore;
}

function finishGame(score, label = "Finished") {
  const game = state.activeGame;
  if (!game) return;

  const history = getHistory();
  history.unshift({
    gameId: game.id,
    title: game.title,
    score: Math.max(0, Math.round(score)),
    result: label,
    playedAt: new Date().toISOString(),
  });
  saveHistory(history);
  liveBest.textContent = getBestForGame(game.id);
  renderStats();
}

function showLoading() {
  loadingLayer.classList.remove("hidden");
  window.setTimeout(() => loadingLayer.classList.add("hidden"), 620);
}

function openGame(gameId) {
  const game = games.find((item) => item.id === gameId);
  if (!game) return;

  if (state.cleanupGame) state.cleanupGame();
  state.activeGame = game;
  state.cleanupGame = null;
  gameTitle.textContent = game.title;
  setLiveScore(0);
  liveBest.textContent = getBestForGame(game.id);
  gameMount.innerHTML = "";
  switchView("game");
  showLoading();

  window.setTimeout(() => {
    if (state.activeGame?.id !== gameId) return;
    const starters = {
      snake: startSnake,
      sidi: startSidi,
      cards: startCards,
      "zero-x": startZeroX,
      pong: startPong,
      reflex: startReflex,
    };
    state.cleanupGame = starters[gameId]();
  }, 260);
}

function makeConsole({ message = "", controls = true } = {}) {
  const shell = document.createElement("div");
  shell.className = "arcade-console";
  const msg = document.createElement("div");
  msg.className = "game-message";
  msg.textContent = message;
  shell.append(msg);
  gameMount.replaceChildren(shell);
  return { shell, msg };
}

function createCanvas(width, height, ratio = width / height) {
  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.width = width;
  canvas.height = height;
  canvas.style.setProperty("--canvas-w", `${width}px`);
  canvas.style.setProperty("--canvas-ratio", String(ratio));
  return canvas;
}

function startSnake() {
  const { shell, msg } = makeConsole({ message: "Snake online" });
  const canvas = createCanvas(480, 480, 1);
  const ctx = canvas.getContext("2d");
  const dpad = document.createElement("div");
  dpad.className = "dpad";
  dpad.innerHTML = `
    <button class="pad-btn" data-dir="up" aria-label="Up">↑</button>
    <button class="pad-btn" data-dir="left" aria-label="Left">←</button>
    <button class="pad-btn" data-dir="down" aria-label="Down">↓</button>
    <button class="pad-btn" data-dir="right" aria-label="Right">→</button>
  `;
  shell.prepend(canvas);
  shell.append(dpad);

  const size = 20;
  const cells = canvas.width / size;
  let snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  let food = { x: 15, y: 13 };
  let dir = { x: 1, y: 0 };
  let pending = dir;
  let score = 0;
  let gameOver = false;

  function placeFood() {
    do {
      food = {
        x: Math.floor(Math.random() * cells),
        y: Math.floor(Math.random() * cells),
      };
    } while (snake.some((part) => part.x === food.x && part.y === food.y));
  }

  function turn(next) {
    const dirs = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const chosen = dirs[next];
    if (!chosen) return;
    if (chosen.x + dir.x === 0 && chosen.y + dir.y === 0) return;
    pending = chosen;
  }

  function drawGrid() {
    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(47, 247, 255, 0.08)";
    for (let line = 0; line <= cells; line += 1) {
      ctx.beginPath();
      ctx.moveTo(line * size, 0);
      ctx.lineTo(line * size, canvas.height);
      ctx.moveTo(0, line * size);
      ctx.lineTo(canvas.width, line * size);
      ctx.stroke();
    }
  }

  function draw() {
    drawGrid();
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ffd166";
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(food.x * size + 4, food.y * size + 4, size - 8, size - 8);
    ctx.shadowColor = "#2ff7ff";
    snake.forEach((part, index) => {
      ctx.fillStyle = index === 0 ? "#ffffff" : "#2ff7ff";
      ctx.fillRect(part.x * size + 2, part.y * size + 2, size - 4, size - 4);
    });
    ctx.shadowBlur = 0;
  }

  function tick() {
    if (gameOver) return;
    dir = pending;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const hitWall = head.x < 0 || head.x >= cells || head.y < 0 || head.y >= cells;
    const hitSelf = snake.some((part) => part.x === head.x && part.y === head.y);

    if (hitWall || hitSelf) {
      gameOver = true;
      msg.textContent = `Game over. Score ${score}`;
      finishGame(score, "Crash");
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      setLiveScore(score);
      placeFood();
    } else {
      snake.pop();
    }
    draw();
  }

  function onKey(event) {
    const map = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };
    if (map[event.key]) {
      event.preventDefault();
      turn(map[event.key]);
    }
  }

  dpad.addEventListener("click", (event) => turn(event.target.closest("button")?.dataset.dir));
  window.addEventListener("keydown", onKey);
  draw();
  const timer = window.setInterval(tick, 105);
  return () => {
    window.clearInterval(timer);
    window.removeEventListener("keydown", onKey);
  };
}

function startSidi() {
  const { shell, msg } = makeConsole({ message: "Sidi arena armed" });
  const canvas = createCanvas(560, 700, 0.8);
  const ctx = canvas.getContext("2d");
  const controls = document.createElement("div");
  controls.className = "control-row";
  controls.innerHTML = `
    <button class="pad-btn" data-move="-1" aria-label="Left">←</button>
    <button class="pad-btn" data-move="1" aria-label="Right">→</button>
  `;
  shell.prepend(canvas);
  shell.append(controls);

  const lanes = [92, 216, 340, 464];
  let lane = 1;
  let score = 0;
  let speed = 3.4;
  let running = true;
  let lastSpawn = 0;
  const hazards = [];
  const pickups = [];

  function move(delta) {
    lane = Math.max(0, Math.min(lanes.length - 1, lane + delta));
  }

  function drawRoad() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#100517");
    gradient.addColorStop(1, "#05050a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "rgba(47, 247, 255, 0.22)";
    ctx.lineWidth = 2;
    for (let index = 0; index < lanes.length; index += 1) {
      const x = lanes[index];
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2, 110);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ctx.strokeStyle = "rgba(255, 61, 242, 0.18)";
    for (let y = 130; y < canvas.height; y += 44) {
      const scale = y / canvas.height;
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 260 * scale, y);
      ctx.lineTo(canvas.width / 2 + 260 * scale, y);
      ctx.stroke();
    }
  }

  function spawn() {
    const x = lanes[Math.floor(Math.random() * lanes.length)];
    if (Math.random() > 0.74) {
      pickups.push({ x, y: 72, r: 13 });
    } else {
      hazards.push({ x, y: 58, w: 54, h: 38 });
    }
  }

  function drawPlayer() {
    const x = lanes[lane];
    const y = canvas.height - 98;
    ctx.save();
    ctx.shadowBlur = 24;
    ctx.shadowColor = "#2ff7ff";
    ctx.fillStyle = "#2ff7ff";
    ctx.beginPath();
    ctx.moveTo(x, y - 34);
    ctx.lineTo(x - 34, y + 34);
    ctx.lineTo(x + 34, y + 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 7, y - 6, 14, 28);
    ctx.restore();
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function frame(time) {
    if (!running) return;
    drawRoad();
    if (time - lastSpawn > 680) {
      spawn();
      lastSpawn = time;
      speed += 0.05;
    }

    const playerRect = { x: lanes[lane] - 27, y: canvas.height - 124, w: 54, h: 74 };

    hazards.forEach((hazard) => {
      hazard.y += speed;
      ctx.save();
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ff4b6e";
      ctx.fillStyle = "#ff4b6e";
      ctx.fillRect(hazard.x - hazard.w / 2, hazard.y, hazard.w, hazard.h);
      ctx.restore();
      if (rectsOverlap(playerRect, { x: hazard.x - hazard.w / 2, y: hazard.y, w: hazard.w, h: hazard.h })) {
        running = false;
        msg.textContent = `Impact. Score ${score}`;
        finishGame(score, "Impact");
      }
    });

    pickups.forEach((pickup) => {
      pickup.y += speed * 0.9;
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#80ff72";
      ctx.fillStyle = "#80ff72";
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (Math.abs(pickup.x - lanes[lane]) < 44 && Math.abs(pickup.y - (canvas.height - 96)) < 52) {
        pickup.collected = true;
        score += 50;
        setLiveScore(score);
      }
    });

    for (let index = hazards.length - 1; index >= 0; index -= 1) {
      if (hazards[index].y > canvas.height + 60) {
        hazards.splice(index, 1);
        score += 5;
        setLiveScore(score);
      }
    }

    for (let index = pickups.length - 1; index >= 0; index -= 1) {
      if (pickups[index].y > canvas.height + 50 || pickups[index].collected) pickups.splice(index, 1);
    }

    drawPlayer();
    requestAnimationFrame(frame);
  }

  function onKey(event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") move(-1);
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") move(1);
  }

  controls.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (button) move(Number(button.dataset.move));
  });
  window.addEventListener("keydown", onKey);
  requestAnimationFrame(frame);
  return () => {
    running = false;
    window.removeEventListener("keydown", onKey);
  };
}

function startCards() {
  const { shell, msg } = makeConsole({ message: "Deck synced" });
  const board = document.createElement("div");
  board.className = "memory-board";
  shell.prepend(board);

  const symbols = ["01", "07", "12", "19", "24", "31", "42", "YP"];
  const deck = [...symbols, ...symbols]
    .sort(() => Math.random() - 0.5)
    .map((value, index) => ({ value, id: index, matched: false }));
  let first = null;
  let lock = false;
  let moves = 0;
  let matched = 0;

  function scoreNow() {
    return Math.max(0, 1200 - moves * 35 + matched * 80);
  }

  function render() {
    board.innerHTML = deck
      .map(
        (card) => `
          <button class="memory-card ${card.matched ? "matched" : ""}" type="button" data-id="${card.id}">
            <span>${card.value}</span>
          </button>
        `,
      )
      .join("");
  }

  function reveal(button) {
    button.classList.add("revealed");
  }

  board.addEventListener("click", (event) => {
    const button = event.target.closest(".memory-card");
    if (!button || lock) return;
    const card = deck.find((item) => item.id === Number(button.dataset.id));
    if (!card || card.matched || button.classList.contains("revealed")) return;

    reveal(button);
    if (!first) {
      first = { card, button };
      return;
    }

    moves += 1;
    if (first.card.value === card.value) {
      first.card.matched = true;
      card.matched = true;
      first.button.classList.add("matched");
      button.classList.add("matched");
      matched += 1;
      const score = scoreNow();
      setLiveScore(score);
      msg.textContent = `Moves ${moves}`;
      first = null;
      if (matched === symbols.length) {
        msg.textContent = `Deck clear. Score ${score}`;
        finishGame(score, "Matched");
      }
      return;
    }

    lock = true;
    window.setTimeout(() => {
      first.button.classList.remove("revealed");
      button.classList.remove("revealed");
      first = null;
      lock = false;
      setLiveScore(scoreNow());
      msg.textContent = `Moves ${moves}`;
    }, 650);
  });

  render();
  setLiveScore(scoreNow());
  return () => {};
}

function startZeroX() {
  const { shell, msg } = makeConsole({ message: "X turn" });
  const board = document.createElement("div");
  board.className = "zero-board";
  shell.prepend(board);

  const cells = Array(9).fill("");
  let turn = "X";
  let finished = false;
  let rounds = 0;
  const wins = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  function getWinner() {
    for (const line of wins) {
      const [a, b, c] = line;
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
    }
    return cells.every(Boolean) ? "Draw" : "";
  }

  function render() {
    board.innerHTML = cells
      .map((value, index) => `<button class="zero-cell" type="button" data-index="${index}">${value}</button>`)
      .join("");
  }

  board.addEventListener("click", (event) => {
    const button = event.target.closest(".zero-cell");
    if (!button || finished) return;
    const index = Number(button.dataset.index);
    if (cells[index]) return;
    cells[index] = turn;
    rounds += 1;
    const winner = getWinner();
    const score = winner && winner !== "Draw" ? 300 - rounds * 12 : winner === "Draw" ? 90 : rounds * 10;
    setLiveScore(score);
    render();

    if (winner) {
      finished = true;
      msg.textContent = winner === "Draw" ? "Draw round" : `${winner} wins`;
      finishGame(score, winner);
      window.setTimeout(() => {
        cells.fill("");
        turn = "X";
        finished = false;
        rounds = 0;
        setLiveScore(0);
        msg.textContent = "X turn";
        render();
      }, 1500);
      return;
    }

    turn = turn === "X" ? "O" : "X";
    msg.textContent = `${turn} turn`;
  });

  render();
  return () => {};
}

function startPong() {
  const { shell, msg } = makeConsole({ message: "Rally active" });
  const canvas = createCanvas(640, 420, 640 / 420);
  const ctx = canvas.getContext("2d");
  const buttons = document.createElement("div");
  buttons.className = "paddle-controls";
  buttons.innerHTML = `
    <button class="pad-btn" data-step="-42" aria-label="Left">←</button>
    <button class="pad-btn" data-step="42" aria-label="Right">→</button>
  `;
  shell.prepend(canvas);
  shell.append(buttons);

  let paddleX = canvas.width / 2 - 56;
  const paddleW = 112;
  const paddleH = 14;
  const ball = { x: canvas.width / 2, y: canvas.height / 2, vx: 4, vy: -4, r: 10 };
  let score = 0;
  let running = true;

  function draw() {
    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#2ff7ff";
    ctx.fillStyle = "#2ff7ff";
    ctx.fillRect(paddleX, canvas.height - 42, paddleW, paddleH);
    ctx.shadowColor = "#ff3df2";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function frame() {
    if (!running) return;
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < ball.r || ball.x > canvas.width - ball.r) ball.vx *= -1;
    if (ball.y < ball.r) ball.vy *= -1;

    const paddleY = canvas.height - 42;
    if (
      ball.y + ball.r >= paddleY &&
      ball.y + ball.r <= paddleY + paddleH + 8 &&
      ball.x >= paddleX &&
      ball.x <= paddleX + paddleW &&
      ball.vy > 0
    ) {
      const hit = (ball.x - (paddleX + paddleW / 2)) / (paddleW / 2);
      ball.vx = hit * 5.4;
      ball.vy = -Math.min(8, Math.abs(ball.vy) + 0.35);
      score += 15;
      setLiveScore(score);
    }

    if (ball.y > canvas.height + ball.r) {
      running = false;
      msg.textContent = `Rally lost. Score ${score}`;
      finishGame(score, "Miss");
      return;
    }

    draw();
    requestAnimationFrame(frame);
  }

  function clampPaddle() {
    paddleX = Math.max(0, Math.min(canvas.width - paddleW, paddleX));
  }

  function movePaddle(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    paddleX = (clientX - rect.left) * scale - paddleW / 2;
    clampPaddle();
  }

  function onKey(event) {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") paddleX -= 36;
    if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") paddleX += 36;
    clampPaddle();
  }

  canvas.addEventListener("pointermove", (event) => movePaddle(event.clientX));
  buttons.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    paddleX += Number(button.dataset.step);
    clampPaddle();
  });
  window.addEventListener("keydown", onKey);
  draw();
  requestAnimationFrame(frame);
  return () => {
    running = false;
    window.removeEventListener("keydown", onKey);
  };
}

function startReflex() {
  const { shell, msg } = makeConsole({ message: "30" });
  const arena = document.createElement("div");
  arena.className = "reflex-arena";
  const target = document.createElement("button");
  target.className = "reflex-target";
  target.type = "button";
  target.textContent = "+";
  arena.append(target);
  shell.prepend(arena);

  let score = 0;
  let seconds = 30;
  let running = true;

  function place() {
    const rect = arena.getBoundingClientRect();
    const size = target.offsetWidth || 72;
    target.style.left = `${Math.random() * Math.max(1, rect.width - size)}px`;
    target.style.top = `${Math.random() * Math.max(1, rect.height - size)}px`;
  }

  target.addEventListener("click", () => {
    if (!running) return;
    score += 25;
    setLiveScore(score);
    place();
  });

  const timer = window.setInterval(() => {
    seconds -= 1;
    msg.textContent = String(seconds);
    if (seconds <= 0) {
      running = false;
      window.clearInterval(timer);
      msg.textContent = `Time. Score ${score}`;
      finishGame(score, "Time");
      target.disabled = true;
    }
  }, 1000);

  requestAnimationFrame(place);
  return () => {
    running = false;
    window.clearInterval(timer);
  };
}

function initBackground() {
  const canvas = $("#spaceCanvas");
  const ctx = canvas.getContext("2d");
  let width = 0;
  let height = 0;
  let stars = [];
  const pointer = { x: 0, y: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.min(180, Math.floor(width / 7)) }, () => ({
      x: (Math.random() - 0.5) * width,
      y: (Math.random() - 0.5) * height,
      z: Math.random() * width,
      hue: Math.random() > 0.5 ? "#2ff7ff" : "#ff3df2",
    }));
  }

  function drawWave(time) {
    ctx.save();
    ctx.translate(width / 2, height * 0.72);
    ctx.strokeStyle = "rgba(128, 255, 114, 0.16)";
    ctx.lineWidth = 1;
    for (let row = 0; row < 18; row += 1) {
      ctx.beginPath();
      for (let col = -18; col <= 18; col += 1) {
        const x = col * 46;
        const z = row * 28 + ((time / 28) % 28);
        const perspective = 420 / (420 + z);
        const px = x * perspective;
        const py = z * perspective + Math.sin((col + time / 400) * 0.7) * 7;
        if (col === -18) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function frame(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(7, 7, 13, 0.72)";
    ctx.fillRect(0, 0, width, height);
    drawWave(time);

    for (const star of stars) {
      star.z -= 2.2;
      if (star.z <= 1) {
        star.x = (Math.random() - 0.5) * width;
        star.y = (Math.random() - 0.5) * height;
        star.z = width;
      }
      const k = 180 / star.z;
      const x = star.x * k + width / 2 + pointer.x * 14;
      const y = star.y * k + height / 2 + pointer.y * 14;
      const size = Math.max(0.5, (1 - star.z / width) * 3.2);
      ctx.fillStyle = star.hue;
      ctx.globalAlpha = Math.max(0.12, 1 - star.z / width);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (event) => {
    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;
    document.documentElement.style.setProperty("--mx", `${event.clientX}px`);
    document.documentElement.style.setProperty("--my", `${event.clientY}px`);
    pointer.x = x - 0.5;
    pointer.y = y - 0.5;
  });
  resize();
  requestAnimationFrame(frame);
}

function initTilt() {
  document.addEventListener("pointermove", (event) => {
    const card = event.target.closest(".tilt-card");
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--rx", `${(-py * 6).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${(px * 8).toFixed(2)}deg`);
  });

  document.addEventListener("pointerout", (event) => {
    const card = event.target.closest(".tilt-card");
    if (!card || card.contains(event.relatedTarget)) return;
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

function bindEvents() {
  $$(".tab-btn").forEach((button) => {
    button.addEventListener("click", () => setAuthMode(button.dataset.authMode));
  });
  $("#sendOtpBtn").addEventListener("click", sendOtp);
  authForm.addEventListener("submit", handleAuth);
  $("#logoutBtn").addEventListener("click", logout);
  $("#backBtn").addEventListener("click", openDashboard);
  $("#clearHistoryBtn").addEventListener("click", () => {
    if (!window.confirm("Clear all local game history for this profile?")) return;
    saveHistory([]);
    renderDashboard();
    showToast("History cleared.");
  });
  gamesGrid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-game]");
    if (card) openGame(card.dataset.game);
  });
  $("#fullscreenBtn").addEventListener("click", async () => {
    if (!document.fullscreenElement) {
      await gameShell.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  });
}

function boot() {
  initBackground();
  initTilt();
  bindEvents();
  setAuthMode("login");

  const saved = getSavedSession();
  if (saved && getUsers()[saved]) {
    state.currentUser = saved;
    openDashboard();
  }
}

boot();
