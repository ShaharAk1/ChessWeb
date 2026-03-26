import "./styles.css";
import { Chess } from "chess.js";

const FILLED_GLYPHS = {
  wp: "♟",
  wr: "♜",
  wn: "♞",
  wb: "♝",
  wq: "♛",
  wk: "♚",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bq: "♛",
  bk: "♚"
};

const DIAGRAM_GLYPHS = {
  wp: "♙",
  wr: "♖",
  wn: "♘",
  wb: "♗",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  br: "♜",
  bn: "♞",
  bb: "♝",
  bq: "♛",
  bk: "♚"
};

const PIECE_GLYPH_SETS = [
  DIAGRAM_GLYPHS,
  FILLED_GLYPHS,
  DIAGRAM_GLYPHS,
  FILLED_GLYPHS,
  FILLED_GLYPHS,
  FILLED_GLYPHS
];

// Piece themes come from HollowLeaf1981/ChessPieces (MIT license).
// Each theme has full piece icons (white/black + all piece types).
const PIECE_THEME_LABELS = ["Classic", "Anime", "Apollo", "Artemis", "Clash", "Hades"];
const PIECE_THEME_FOLDERS = ["Jupiter", "Anime", "Hera", "Artemis", "Clash", "Hades"];

const BOARD_THEMES = [
  { name: "Classic", light: "#f0d9b5", dark: "#b58863", border: "#3f3f46" },
  { name: "Green", light: "#eeeed2", dark: "#769656", border: "#4a5d3a" },
  { name: "Blue", light: "#dee3e6", dark: "#8ca2ad", border: "#5c6b73" },
  { name: "Rose", light: "#f5e6e8", dark: "#c9a0a8", border: "#7d5a62" },
  { name: "Slate", light: "#c8d0dc", dark: "#6b7c93", border: "#3d4a5c" },
  { name: "Walnut", light: "#e8dcc8", dark: "#8b6914", border: "#4a3728" }
];

const OPENINGS = [
  { name: "Sicilian Defense", eco: "B20", moves: "e4 c5", description: "A sharp opening where Black fights for the center with c5." },
  { name: "Queen's Gambit", eco: "D06", moves: "d4 d5 c4", description: "White offers a pawn to gain central control." },
  { name: "King's Indian Defense", eco: "E60", moves: "d4 Nf6 c4 g6", description: "Black fianchettoes the king bishop and prepares counterplay." },
  { name: "Ruy Lopez", eco: "C60", moves: "e4 e5 Nf3 Nc6 Bb5", description: "One of the oldest and most respected openings." },
  { name: "French Defense", eco: "C00", moves: "e4 e6", description: "Black builds a solid pawn structure but cedes space." },
  { name: "Caro-Kann Defense", eco: "B10", moves: "e4 c6", description: "A solid defense aiming for d5." }
];

function toBoardMap(chess) {
  const board = {};
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

  for (let rank = 1; rank <= 8; rank += 1) {
    for (const file of files) {
      const square = `${file}${rank}`;
      const piece = chess.get(square);
      if (piece) board[square] = piece;
    }
  }

  return board;
}

function legalMovesBySquare(chess) {
  const map = {};
  chess.moves({ verbose: true }).forEach((move) => {
    if (!map[move.from]) map[move.from] = [];
    map[move.from].push(move.to);
  });
  return map;
}

function toState(game) {
  const chess = game.engine;
  const result = game.result ?? { status: "ongoing", winner: null, reason: null };
  const now = Date.now();
  const hasActiveDrawOffer =
    Boolean(game.drawOffer?.fromColor) && Number(game.drawOffer?.expiresAt || 0) > now;
  return {
    id: game.id,
    fen: chess.fen(),
    turn: chess.turn(),
    history: chess.history(),
    board: toBoardMap(chess),
    legalMoves: legalMovesBySquare(chess),
    isCheck: chess.inCheck(),
    isCheckmate: chess.isCheckmate(),
    isDraw: chess.isDraw(),
    isStalemate: chess.isStalemate(),
    isInsufficientMaterial: chess.isInsufficientMaterial(),
    isThreefoldRepetition: chess.isThreefoldRepetition(),
    isGameOver: chess.isGameOver(),
    result,
    hasActiveDrawOffer
  };
}

const LS_BOARD = "chessweb_board_theme";
const LS_PIECE = "chessweb_piece_theme";
const LS_GAME_IDS = "chessweb_game_ids";
const LS_PLAYER_ID = "chessweb_player_id";
const LS_MULTIPLAYER_GAME_ID = "chessweb_multiplayer_game_id";

let localGames = {};

const app = document.querySelector("#app");
const PAGE_ROUTES = {
  local: {
    hash: "#/local",
    title: "ChessWeb - Local Mode",
    buttonText: "Local Mode"
  },
  multiplayer: {
    hash: "#/multiplayer",
    title: "ChessWeb - Multiplayer",
    buttonText: "Multiplayer"
  },
  openings: {
    hash: "#/openings",
    title: "ChessWeb - Openings",
    buttonText: "Openings"
  },
  improve: {
    hash: "#/improve",
    title: "ChessWeb - Improve",
    buttonText: "Improve"
  }
};

let gameId = null;
let gameState = null;
let selectedSquare = null;
let legalSquares = [];
let gameIdsByPage = {};

let boardThemeIndex = 0;
let pieceThemeIndex = 0;
let customizeOpen = false;
let audioCtx = null;
let playerId = null;
let multiplayerSession = null;
let multiplayerPollTimer = null;
let outcomeModal = null;
const dismissedOutcomeSignatures = new Set();
let selectedOpening = null;
let currentMoveIndex = 0;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone({ frequency, type = "sine", duration = 0.09, volume = 0.8 }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playMoveSound() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Short wood-knock feel: brief contact click + hollow low-mid body.
  const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.016), ctx.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length);
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(1250, now);
  noiseFilter.Q.setValueAtTime(0.85, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.02, now + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.016);
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.018);

  const body = ctx.createOscillator();
  body.type = "triangle";
  body.frequency.setValueAtTime(145, now);
  body.frequency.exponentialRampToValueAtTime(95, now + 0.055);
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.0001, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.035, now + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  const bodyLP = ctx.createBiquadFilter();
  bodyLP.type = "lowpass";
  bodyLP.frequency.setValueAtTime(440, now);

  body.connect(bodyLP);
  bodyLP.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(now);
  body.stop(now + 0.07);
}

function playButtonSound() {
  playTone({ frequency: 360, type: "sine", duration: 0.05, volume: 0.2 });
}

function clampThemeIndex(value, max) {
  const n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n) || n < 0 || n > max) return 0;
  return n;
}

function getOrCreatePlayerId() {
  const existing = localStorage.getItem(LS_PLAYER_ID);
  if (existing) return existing;

  const generated =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`) || String(Date.now());
  localStorage.setItem(LS_PLAYER_ID, generated);
  return generated;
}

function loadThemePreferences() {
  boardThemeIndex = clampThemeIndex(localStorage.getItem(LS_BOARD), BOARD_THEMES.length - 1);
  pieceThemeIndex = clampThemeIndex(localStorage.getItem(LS_PIECE), PIECE_THEME_LABELS.length - 1);
}

function loadGameIds() {
  let parsed = {};
  try {
    const raw = localStorage.getItem(LS_GAME_IDS);
    if (raw) parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  if (!parsed || typeof parsed !== "object") {
    gameIdsByPage = {};
    return;
  }

  const valid = {};
  Object.keys(PAGE_ROUTES).forEach((key) => {
    if (typeof parsed[key] === "string" && parsed[key].trim()) {
      valid[key] = parsed[key];
    }
  });
  gameIdsByPage = valid;
}

function saveGameIds() {
  localStorage.setItem(LS_GAME_IDS, JSON.stringify(gameIdsByPage));
}

function saveBoardTheme(index) {
  boardThemeIndex = index;
  localStorage.setItem(LS_BOARD, String(index));
}

function savePieceTheme(index) {
  pieceThemeIndex = index;
  localStorage.setItem(LS_PIECE, String(index));
}

function getPieceGlyph(color, type, themeIdx = pieceThemeIndex) {
  const key = `${color}${type}`;
  const set = PIECE_GLYPH_SETS[themeIdx] || FILLED_GLYPHS;
  return set[key] ?? FILLED_GLYPHS[key];
}

const PIECE_ICON_BASE_URL =
  "https://raw.githubusercontent.com/HollowLeaf1981/ChessPieces/main/";

const PIECE_TYPE_TO_LETTER = {
  p: "P",
  n: "N",
  b: "B",
  r: "R",
  q: "Q",
  k: "K"
};

function getPieceIconUrl(color, type, themeIdx = pieceThemeIndex) {
  const folder = PIECE_THEME_FOLDERS[themeIdx] ?? PIECE_THEME_FOLDERS[0];
  const pieceColor = color === "b" ? "b" : "w";
  const pieceLetter = PIECE_TYPE_TO_LETTER[type] ?? "P";
  return `${PIECE_ICON_BASE_URL}${folder}/${pieceColor}${pieceLetter}.png`;
}

function getPieceIconHTML(color, type, themeIdx = pieceThemeIndex) {
  const src = getPieceIconUrl(color, type, themeIdx);
  return `<img src="${src}" alt="" draggable="false" />`;
}

function currentPageKey() {
  const hash = window.location.hash || PAGE_ROUTES.local.hash;
  return (
    Object.keys(PAGE_ROUTES).find((key) => PAGE_ROUTES[key].hash === hash) ??
    "local"
  );
}

function statusText(state) {
  const result = state.result;
  if (result?.status === "win") {
    return `${result.winner === "w" ? "White" : "Black"} wins`;
  }
  if (result?.status === "draw") return "Draw";
  if (state.isCheckmate) return `Checkmate - ${state.turn === "w" ? "Black" : "White"} wins`;
  if (state.isDraw) return "Draw";
  if (state.isStalemate) return "Stalemate";
  if (state.isCheck) return `${state.turn === "w" ? "White" : "Black"} to move (check)`;
  return `${state.turn === "w" ? "White" : "Black"} to move`;
}

function squareColor(file, rank) {
  return (file + rank) % 2 === 0 ? "light" : "dark";
}

function resetSelection() {
  selectedSquare = null;
  legalSquares = [];
}

async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(payload.error || "Request failed");
  }

  return response.json();
}

async function startGame() {
  const pageKey = currentPageKey();
  const gameIdLocal = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chess = new Chess();
  const game = { id: gameIdLocal, engine: chess };
  localGames[gameIdLocal] = game;
  gameId = gameIdLocal;
  gameState = toState(game);
  gameIdsByPage[pageKey] = gameIdLocal;
  saveGameIds();
  resetSelection();
  render();
}

async function createMultiplayerGame() {
  const payload = await api("/multiplayer/create", {
    method: "POST",
    body: { playerId }
  });
  gameId = payload.gameId;
  gameState = payload.state;
  multiplayerSession = {
    gameId: payload.gameId,
    assignedColor: payload.assignedColor,
    whiteJoined: payload.assignedColor === "w",
    blackJoined: payload.assignedColor === "b",
    pendingDrawRequest: null
  };
  localStorage.setItem(LS_MULTIPLAYER_GAME_ID, payload.gameId);
  resetSelection();
  render();
}

async function joinMultiplayerGameById(rawId) {
  const requestedId = String(rawId || "").trim().toUpperCase();
  if (!requestedId) throw new Error("Please enter a game ID");

  const payload = await api("/multiplayer/join", {
    method: "POST",
    body: { gameId: requestedId, playerId }
  });
  gameId = payload.gameId;
  gameState = payload.state;
  multiplayerSession = {
    gameId: payload.gameId,
    assignedColor: payload.assignedColor,
    whiteJoined: true,
    blackJoined: true,
    pendingDrawRequest: null
  };
  localStorage.setItem(LS_MULTIPLAYER_GAME_ID, payload.gameId);
  resetSelection();
  render();
}

async function loadState() {
  if (!gameId) return;
  if (gameId.startsWith("local-")) {
    const game = localGames[gameId];
    if (!game) throw new Error("Local game not found");
    gameState = toState(game);
    return;
  }
  if (currentPageKey() === "multiplayer") {
    const payload = await api("/multiplayer/state", {
      method: "POST",
      body: { gameId, playerId }
    });
    gameState = payload.state;
    multiplayerSession = {
      gameId: payload.gameId,
      assignedColor: payload.assignedColor,
      whiteJoined: payload.players.whiteJoined,
      blackJoined: payload.players.blackJoined,
      pendingDrawRequest: payload.pendingDrawRequest ?? null
    };
    return;
  }

  const payload = await api("/game/state", {
    method: "POST",
    body: { gameId }
  });
  gameState = payload.state;
}

async function ensurePageGame() {
  const pageKey = currentPageKey();
  if (pageKey === "multiplayer") {
    const savedMultiplayerId = localStorage.getItem(LS_MULTIPLAYER_GAME_ID);
    if (!savedMultiplayerId) {
      gameId = null;
      gameState = null;
      multiplayerSession = null;
      resetSelection();
      render();
      return;
    }

    gameId = savedMultiplayerId;
    try {
      await loadState();
      resetSelection();
      render();
    } catch {
      gameId = null;
      gameState = null;
      multiplayerSession = null;
      localStorage.removeItem(LS_MULTIPLAYER_GAME_ID);
      resetSelection();
      render();
    }
    return;
  }

  const savedGameId = gameIdsByPage[pageKey];

  if (!savedGameId) {
    await startGame();
    return;
  }

  gameId = savedGameId;
  try {
    await loadState();
    resetSelection();
    render();
  } catch {
    // If a saved game no longer exists on the server, create a replacement.
    await startGame();
  }
}

async function clickSquare(square) {
  if (!gameState) return;
  if (gameState.result?.status && gameState.result.status !== "ongoing") return;
  if (
    currentPageKey() === "multiplayer" &&
    multiplayerSession &&
    gameState.turn !== multiplayerSession.assignedColor
  ) {
    return;
  }

  if (selectedSquare === null) {
    const moves = gameState.legalMoves[square] || [];
    if (!moves.length) return;
    selectedSquare = square;
    legalSquares = moves;
    render();
    return;
  }

  if (selectedSquare === square) {
    resetSelection();
    render();
    return;
  }

  const isTargetLegal = legalSquares.includes(square);
  if (!isTargetLegal) {
    const moves = gameState.legalMoves[square] || [];
    if (!moves.length) {
      resetSelection();
      render();
      return;
    }
    selectedSquare = square;
    legalSquares = moves;
    render();
    return;
  }

  if (gameId.startsWith("local-")) {
    // Local move
    const game = localGames[gameId];
    if (!game) return;
    const move = game.engine.move({ from: selectedSquare, to: square });
    if (!move) return;
    gameState = toState(game);
    playMoveSound();
    resetSelection();
    render();
  } else {
    // Server move
    const path = currentPageKey() === "multiplayer" ? "/multiplayer/move" : "/game/move";
    const body =
      currentPageKey() === "multiplayer"
        ? { gameId, playerId, from: selectedSquare, to: square }
        : { gameId, from: selectedSquare, to: square };
    const payload = await api(path, { method: "POST", body });
    gameState = payload.state;
    playMoveSound();
    resetSelection();
    render();
  }
}

function boardStyleAttrs() {
  const t = BOARD_THEMES[boardThemeIndex] ?? BOARD_THEMES[0];
  return `style="--sq-light:${t.light};--sq-dark:${t.dark};--board-border:${t.border}" data-piece-theme="${pieceThemeIndex}"`;
}

function boardHtml(state) {
  const isBlackPerspective =
    currentPageKey() === "multiplayer" && multiplayerSession?.assignedColor === "b";
  const ranks = isBlackPerspective ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = isBlackPerspective
    ? ["h", "g", "f", "e", "d", "c", "b", "a"]
    : ["a", "b", "c", "d", "e", "f", "g", "h"];
  let html = `<div class="board" aria-label="Chess board" ${boardStyleAttrs()}>`;

  ranks.forEach((rank, rankIdx) => {
    files.forEach((file, fileIdx) => {
      const square = `${file}${rank}`;
      const piece = state.board[square];
      const pieceKey = piece ? `${piece.color}${piece.type}` : null;
      const pieceHtml = pieceKey
        ? `<span class="piece">${getPieceIconHTML(
            piece.color,
            piece.type,
            pieceThemeIndex
          )}</span>`
        : "";
      const classes = ["square", squareColor(fileIdx, rankIdx)];
      if (selectedSquare === square) classes.push("selected");
      if (legalSquares.includes(square)) classes.push("legal");
      html += `<button type="button" class="${classes.join(" ")}" data-square="${square}" title="${square}">${pieceHtml}</button>`;
    });
  });

  html += "</div>";
  return html;
}

function multiplayerControlsHtml() {
  const session = multiplayerSession;
  const roleText = session
    ? `You are playing as ${session.assignedColor === "w" ? "White" : "Black"}`
    : "Not connected to a multiplayer game";
  const waitingText = session
    ? session.whiteJoined && session.blackJoined
      ? "Both players connected"
      : "Waiting for opponent to join"
    : "Create or join a game to start";
  const gameCode = session?.gameId ?? "";
  const bothJoined = Boolean(session?.whiteJoined && session?.blackJoined);
  const gameOngoing = gameState?.result?.status === "ongoing";
  const drawIncoming = session?.pendingDrawRequest;
  const drawOutgoing = gameState?.hasActiveDrawOffer && !drawIncoming;
  const showLobbyActions = !session;
  const showInGameActions = Boolean(session && bothJoined && gameOngoing);

  return `
    ${
      showLobbyActions
        ? `<div class="controls">
             <button type="button" id="mp-create-btn">Create game</button>
           </div>
           <div class="controls">
             <input id="mp-join-id" placeholder="Enter game ID" value="" />
             <button type="button" id="mp-join-btn">Join game</button>
           </div>`
        : ""
    }
    ${
      showInGameActions
        ? `<div class="controls">
             <button type="button" id="mp-draw-btn">Request Draw</button>
             <button type="button" id="mp-surrender-btn">Surrender</button>
           </div>`
        : ""
    }
    <p class="status"><strong>Game ID:</strong> ${gameCode || "-"}</p>
    <p class="status"><strong>Role:</strong> ${roleText}</p>
    <p class="status"><strong>Players:</strong> ${waitingText}</p>
    ${
      drawIncoming
        ? `<p class="status"><strong>Draw offer:</strong> Opponent requested a draw.</p>
           <div class="controls">
             <button type="button" id="mp-draw-accept-btn">Accept</button>
             <button type="button" id="mp-draw-decline-btn">Decline</button>
           </div>`
        : ""
    }
    ${drawOutgoing ? `<p class="status"><strong>Draw offer:</strong> Waiting for opponent response.</p>` : ""}
  `;
}

function resultCardTitle(state) {
  const result = state?.result;
  if (result?.status === "draw") return "Draw!";
  if (result?.status === "win") return `${result.winner === "w" ? "White" : "Black"} Wins!`;
  if (state?.isCheckmate) return `${state.turn === "w" ? "Black" : "White"} Wins!`;
  if (state?.isDraw || state?.isStalemate) return "Draw!";
  return "";
}

function maybeOpenOutcomeModal(state) {
  const title = resultCardTitle(state);
  if (!title) return;
  const signature = `${state.id}:${state.history.length}:${title}`;
  if (dismissedOutcomeSignatures.has(signature)) return;
  if (outcomeModal?.signature === signature) return;
  outcomeModal = { signature, title };
}

function clearMultiplayerSession() {
  localStorage.removeItem(LS_MULTIPLAYER_GAME_ID);
  gameId = null;
  gameState = null;
  multiplayerSession = null;
  resetSelection();
}

function miniBoardCells(themeIdx) {
  const t = BOARD_THEMES[themeIdx];
  let cells = "";
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const light = (r + c) % 2 === 0;
      const bg = light ? t.light : t.dark;
      cells += `<div class="mb" style="background:${bg}"></div>`;
    }
  }
  return cells;
}

function customizePanelHtml() {
  const boardOptions = BOARD_THEMES.map((t, i) => {
    const active = i === boardThemeIndex ? "active" : "";
    return `
      <button type="button" class="customize-option ${active}" data-board-theme="${i}" aria-pressed="${i === boardThemeIndex}">
        <div class="mini-board" aria-hidden="true">${miniBoardCells(i)}</div>
        <span>${t.name}</span>
      </button>`;
  }).join("");

  const pieceOptions = PIECE_THEME_LABELS.map((label, i) => {
    const active = i === pieceThemeIndex ? "active" : "";
    const king = getPieceIconHTML("w", "k", i);
    return `
      <button type="button" class="customize-option ${active}" data-piece-theme="${i}" aria-pressed="${i === pieceThemeIndex}">
        <div class="piece-theme-swatch" data-piece-theme="${i}" aria-hidden="true">
          <span class="piece">${king}</span>
        </div>
        <span>${label}</span>
      </button>`;
  }).join("");

  const hiddenAttr = customizeOpen ? "" : "hidden";

  return `
    <button type="button" class="customize-trigger" id="customize-toggle" aria-label="Customize board" title="Customize" aria-expanded="${customizeOpen}" aria-controls="customize-panel">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18.37 2.63 14 7l-5 5L5 16l-2 5 5-2 4-4 4.37-4.37a2 2 0 000-2.83L18.37 2.63z" />
        <path d="M10 14l4-4" />
      </svg>
    </button>
    <div class="customize-panel" id="customize-panel" role="dialog" aria-label="Board customization" ${hiddenAttr}>
      <h2>Board</h2>
      <div class="customize-grid">${boardOptions}</div>
      <h2>Pieces</h2>
      <div class="customize-grid">${pieceOptions}</div>
    </div>`;
}

function miniOpeningBoardHtml(opening) {
  const chess = new Chess();
  const moveList = opening.moves.split(" ");
  for (const move of moveList) {
    chess.move(move);
  }
  const board = toBoardMap(chess);
  const t = BOARD_THEMES[boardThemeIndex] ?? BOARD_THEMES[0];
  let html = `<div class="mini-opening-board" data-moves="${opening.moves}" title="Load ${opening.name} opening">`;
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  ranks.forEach((rank, rankIdx) => {
    files.forEach((file, fileIdx) => {
      const square = `${file}${rank}`;
      const piece = board[square];
      let pieceHtml = "";
      if (piece) {
        const pieceGlyph = getPieceGlyph(piece.color, piece.type, pieceThemeIndex);
        const pieceColorClass = piece.color === "w" ? "mini-piece-white" : "mini-piece-black";
        pieceHtml = `<span class="mini-piece ${pieceColorClass}">${pieceGlyph}</span>`;
      }
      const light = (fileIdx + rankIdx) % 2 === 0;
      const bg = light ? t.light : t.dark;
      html += `<div class="mini-square" style="background:${bg}">${pieceHtml}</div>`;
    });
  });
  html += `</div>`;
  return html;
}

function openingItemHtml(opening) {
  return `
    <div class="opening-item">
      <h3>${opening.name}</h3>
      ${miniOpeningBoardHtml(opening)}
    </div>`;
}

function render() {
  const pageKey = currentPageKey();
  const page = PAGE_ROUTES[pageKey];
  const canRenderBoard = Boolean(gameState);
  const notification = !canRenderBoard ? `<div class="notification" style="position:fixed;top:0;left:28%;background:#550080;color:#fff;text-align:center;padding:0.7rem;z-index:1000;font-size:1.2rem;opacity:0.8;width:30%;border-radius:2px">${
    pageKey === "multiplayer"
      ? "Create or join a multiplayer game to start."
      : "Loading game..."
  }</div>` : '';
  const boardSection = canRenderBoard
    ? boardHtml(gameState)
    : `<div class="board" ${boardStyleAttrs()}></div>`;
  if (canRenderBoard) maybeOpenOutcomeModal(gameState);
  const statusLine = canRenderBoard
    ? `<p class="status"><strong>Status:</strong> ${statusText(gameState)}</p>`
    : `<p class="status"><strong>Status:</strong> ${
        pageKey === "multiplayer" ? "Waiting for multiplayer game" : "Loading"
      }</p>`;
  const movesLine = canRenderBoard
    ? `<p class="status"><strong>Moves:</strong> ${gameState.history.join(" ") || "-"}</p>`
    : `<p class="status"><strong>Moves:</strong> -</p>`;
  const controlsSection =
    pageKey === "multiplayer"
      ? multiplayerControlsHtml()
      : `<div class="controls">
          <button type="button" id="new-game-btn">New game</button>
          <button type="button" id="refresh-btn">Refresh state</button>
        </div>`;
  const navHtml = Object.entries(PAGE_ROUTES)
    .map(([key, route]) => {
      const activeClass = key === pageKey ? "active" : "";
      return `<button type="button" class="nav-button ${activeClass}" data-route="${route.hash}">${route.buttonText}</button>`;
    })
    .join("");

  app.innerHTML = `
    ${notification}${customizePanelHtml()}
    <main class="layout">
      <section class="board-wrap">
        ${boardSection}
      </section>
      ${ pageKey !== "openings" ? `
      <aside class="panel">
        <h1>${page.title}</h1>
        ${statusLine}
        ${movesLine}
        ${controlsSection}
        <p class="future-note">
          ${
            pageKey === "multiplayer"
              ? "Create a game to share its ID, or join an existing one with a game ID."
              : "This mode uses an independent board state saved per page."
          }
        </p>
      </aside>`: `
      <aside class="panel openings">
        <h1>${selectedOpening ? selectedOpening.name : "Openings"}</h1>
        ${selectedOpening ? `<div class="opening-nav">
          <button type="button" id="prev-move" title="Previous move">&larr;</button>
          <button type="button" id="next-move" title="Next move">&rarr;</button>
        </div>` : ''}
        <p class="future-note">Select an opening to load it on the board.</p>
        <div class="openings-table">${OPENINGS.map(openingItemHtml).join("")}</div>
      </aside>
      `}
    </main>
    <nav class="sidebar" aria-label="Navigation">
      ${navHtml}
    </nav>
    ${
      outcomeModal
        ? `<div class="result-overlay" id="result-overlay">
             <div class="result-card">
               <h2>${outcomeModal.title}</h2>
               <button type="button" id="result-close-btn">Close</button>
             </div>
           </div>`
        : ""
    }
  `;

  const toggle = app.querySelector("#customize-toggle");
  const panel = app.querySelector("#customize-panel");
  toggle.addEventListener("click", () => {
    playButtonSound();
    customizeOpen = !customizeOpen;
    toggle.setAttribute("aria-expanded", String(customizeOpen));
    if (customizeOpen) {
      panel.removeAttribute("hidden");
    } else {
      panel.setAttribute("hidden", "");
    }
  });

  app.querySelectorAll("[data-board-theme]").forEach((btn) => {
    btn.addEventListener("click", () => {
      playButtonSound();
      const idx = Number.parseInt(btn.getAttribute("data-board-theme"), 10);
      saveBoardTheme(idx);
      render();
    });
  });

  app.querySelectorAll("[data-piece-theme].customize-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      playButtonSound();
      const idx = Number.parseInt(btn.getAttribute("data-piece-theme"), 10);
      savePieceTheme(idx);
      render();
    });
  });

  app.querySelectorAll(".square").forEach((element) => {
    element.addEventListener("click", async () => {
      try {
        await clickSquare(element.dataset.square);
      } catch (error) {
        alert(error.message);
      }
    });
  });

  const newGameBtn = app.querySelector("#new-game-btn");
  if (newGameBtn) {
    newGameBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        await startGame();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const refreshBtn = app.querySelector("#refresh-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        await loadState();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const mpCreateBtn = app.querySelector("#mp-create-btn");
  if (mpCreateBtn) {
    mpCreateBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        await createMultiplayerGame();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const mpJoinBtn = app.querySelector("#mp-join-btn");
  if (mpJoinBtn) {
    mpJoinBtn.addEventListener("click", async () => {
      playButtonSound();
      const input = app.querySelector("#mp-join-id");
      try {
        await joinMultiplayerGameById(input?.value || "");
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const mpDrawBtn = app.querySelector("#mp-draw-btn");
  if (mpDrawBtn) {
    mpDrawBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        const payload = await api("/multiplayer/draw/request", {
          method: "POST",
          body: { gameId, playerId }
        });
        gameState = payload.state;
        await loadState();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const mpSurrenderBtn = app.querySelector("#mp-surrender-btn");
  if (mpSurrenderBtn) {
    mpSurrenderBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        const payload = await api("/multiplayer/surrender", {
          method: "POST",
          body: { gameId, playerId }
        });
        gameState = payload.state;
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const mpDrawAcceptBtn = app.querySelector("#mp-draw-accept-btn");
  if (mpDrawAcceptBtn) {
    mpDrawAcceptBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        const payload = await api("/multiplayer/draw/respond", {
          method: "POST",
          body: { gameId, playerId, accept: true }
        });
        gameState = payload.state;
        await loadState();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const mpDrawDeclineBtn = app.querySelector("#mp-draw-decline-btn");
  if (mpDrawDeclineBtn) {
    mpDrawDeclineBtn.addEventListener("click", async () => {
      playButtonSound();
      try {
        const payload = await api("/multiplayer/draw/respond", {
          method: "POST",
          body: { gameId, playerId, accept: false }
        });
        gameState = payload.state;
        await loadState();
        render();
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const resultCloseBtn = app.querySelector("#result-close-btn");
  if (resultCloseBtn) {
    resultCloseBtn.addEventListener("click", () => {
      playButtonSound();
      if (outcomeModal?.signature) {
        dismissedOutcomeSignatures.add(outcomeModal.signature);
      }
      const pageKey = currentPageKey();
      if (pageKey === "multiplayer" && gameState?.result?.status && gameState.result.status !== "ongoing") {
        clearMultiplayerSession();
      }
      outcomeModal = null;
      render();
    });
  }

  app.querySelectorAll(".mini-opening-board").forEach((board) => {
    board.addEventListener("click", async () => {
      playButtonSound();
      const moves = board.dataset.moves;
      const opening = OPENINGS.find(o => o.moves === moves);
      selectedOpening = opening;
      currentMoveIndex = 0;
      try {
        await startGame();
        // Apply moves up to currentMoveIndex (0 initially)
        const game = localGames[gameId];
        const moveList = moves.split(" ");
        for (let i = 0; i < currentMoveIndex; i++) {
          game.engine.move(moveList[i]);
        }
        gameState = toState(game);
        render();
      } catch (error) {
        alert(`Failed to load opening: ${error.message}`);
      }
    });
  });

  const prevBtn = app.querySelector("#prev-move");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      playButtonSound();
      if (selectedOpening && currentMoveIndex > 0) {
        const game = localGames[gameId];
        game.engine.undo();
        currentMoveIndex--;
        gameState = toState(game);
        render();
      }
    });
  }

  const nextBtn = app.querySelector("#next-move");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      playButtonSound();
      if (selectedOpening) {
        const moveList = selectedOpening.moves.split(" ");
        if (currentMoveIndex < moveList.length) {
          const game = localGames[gameId];
          game.engine.move(moveList[currentMoveIndex]);
          currentMoveIndex++;
          gameState = toState(game);
          render();
        }
      }
    });
  }

  app.querySelectorAll(".nav-button").forEach((button) => {
    button.addEventListener("click", () => {
      playButtonSound();
      window.location.hash = button.dataset.route;
    });
  });
}

loadThemePreferences();
loadGameIds();
playerId = getOrCreatePlayerId();

if (!window.location.hash) {
  window.location.hash = PAGE_ROUTES.local.hash;
}

window.addEventListener("hashchange", () => {
  if (multiplayerPollTimer) {
    clearInterval(multiplayerPollTimer);
    multiplayerPollTimer = null;
  }
  if (currentPageKey() === "multiplayer") {
    multiplayerPollTimer = setInterval(() => {
      if (currentPageKey() !== "multiplayer" || !gameId) return;
      loadState()
        .then(() => render())
        .catch(() => {});
    }, 1500);
  }
  ensurePageGame().catch((error) => {
    app.innerHTML = `<p style="color:#fca5a5;">Failed to load page game: ${error.message}</p>`;
  });
});

ensurePageGame().catch((error) => {
  app.innerHTML = `<p style="color:#fca5a5;">Failed to start game: ${error.message}</p>`;
});

if (currentPageKey() === "multiplayer") {
  multiplayerPollTimer = setInterval(() => {
    if (currentPageKey() !== "multiplayer" || !gameId) return;
    loadState()
      .then(() => render())
      .catch(() => {});
  }, 1500);
}
