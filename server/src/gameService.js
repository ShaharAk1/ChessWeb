import { Chess } from "chess.js";
import { randomUUID } from "node:crypto";

function randomGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

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
    isStalemate: chess.isStalemate(),
    isDraw: chess.isDraw(),
    result,
    hasActiveDrawOffer
  };
}

export class GameService {
  constructor() {
    this.games = new Map();
  }

  createLocalGame() {
    const id = randomUUID();
    const game = {
      id,
      mode: "local",
      players: {
        white: null,
        black: null
      },
      result: { status: "ongoing", winner: null, reason: null },
      drawOffer: null,
      engine: new Chess()
    };
    this.games.set(id, game);
    return toState(game);
  }

  createMultiplayerGame({ ownerPlayerId }) {
    if (!ownerPlayerId) return { error: "ownerPlayerId is required" };

    let id = randomGameCode();
    while (this.games.has(id)) id = randomGameCode();

    const ownerColor = Math.random() < 0.5 ? "w" : "b";
    const game = {
      id,
      mode: "multiplayer",
      players: {
        white: ownerColor === "w" ? ownerPlayerId : null,
        black: ownerColor === "b" ? ownerPlayerId : null
      },
      result: { status: "ongoing", winner: null, reason: null },
      drawOffer: null,
      engine: new Chess()
    };
    this.games.set(id, game);

    return {
      gameId: id,
      assignedColor: ownerColor,
      state: toState(game)
    };
  }

  joinMultiplayerGame({ gameId, playerId }) {
    if (!gameId || !playerId) {
      return { error: "gameId and playerId are required" };
    }
    const game = this.games.get(String(gameId).trim().toUpperCase());
    if (!game) return { error: "Game not found" };
    if (game.mode !== "multiplayer") return { error: "Not a multiplayer game" };

    if (game.players.white === playerId) {
      return { gameId: game.id, assignedColor: "w", state: toState(game) };
    }
    if (game.players.black === playerId) {
      return { gameId: game.id, assignedColor: "b", state: toState(game) };
    }

    if (!game.players.white) {
      game.players.white = playerId;
      return { gameId: game.id, assignedColor: "w", state: toState(game) };
    }
    if (!game.players.black) {
      game.players.black = playerId;
      return { gameId: game.id, assignedColor: "b", state: toState(game) };
    }

    return { error: "Game is full" };
  }

  getState(gameId) {
    const game = this.games.get(gameId);
    if (!game) return null;
    return toState(game);
  }

  getMultiplayerSession({ gameId, playerId }) {
    if (!gameId || !playerId) return { error: "gameId and playerId are required" };
    const game = this.games.get(String(gameId).trim().toUpperCase());
    if (!game) return { error: "Game not found" };
    if (game.mode !== "multiplayer") return { error: "Not a multiplayer game" };

    let assignedColor = null;
    if (game.players.white === playerId) assignedColor = "w";
    if (game.players.black === playerId) assignedColor = "b";
    if (!assignedColor) return { error: "You are not part of this game" };

    this.clearExpiredDrawOffer(game);

    const offer = game.drawOffer;
    const pendingDrawRequest =
      offer && offer.toColor === assignedColor
        ? {
            fromColor: offer.fromColor,
            expiresAt: offer.expiresAt
          }
        : null;

    return {
      gameId: game.id,
      assignedColor,
      players: {
        whiteJoined: Boolean(game.players.white),
        blackJoined: Boolean(game.players.black)
      },
      pendingDrawRequest,
      state: toState(game)
    };
  }

  applyMove({ gameId, from, to, promotion = "q", playerColor = null }) {
    const game = this.games.get(gameId);
    if (!game) return { error: "Game not found" };
    if (game.result?.status !== "ongoing") return { error: "Game is already finished" };
    if (playerColor && game.engine.turn() !== playerColor) {
      return { error: "It is not your turn" };
    }

    const move = game.engine.move({ from, to, promotion });
    if (!move) return { error: "Illegal move" };

    game.drawOffer = null;
    this.syncResultFromEngine(game);
    return { state: toState(game), move };
  }

  clearExpiredDrawOffer(game) {
    if (!game?.drawOffer) return;
    if (Date.now() > game.drawOffer.expiresAt) {
      game.drawOffer = null;
    }
  }

  syncResultFromEngine(game) {
    if (game.engine.isCheckmate()) {
      game.result = {
        status: "win",
        winner: game.engine.turn() === "w" ? "b" : "w",
        reason: "checkmate"
      };
      return;
    }
    if (game.engine.isDraw() || game.engine.isStalemate()) {
      game.result = { status: "draw", winner: null, reason: "draw" };
      return;
    }
    game.result = { status: "ongoing", winner: null, reason: null };
  }

  surrenderMultiplayerGame({ gameId, playerId }) {
    const session = this.getMultiplayerSession({ gameId, playerId });
    if (session.error) return session;
    const game = this.games.get(session.gameId);
    if (game.result?.status !== "ongoing") return { error: "Game is already finished" };

    const winner = session.assignedColor === "w" ? "b" : "w";
    game.result = { status: "win", winner, reason: "surrender" };
    game.drawOffer = null;
    return { state: toState(game), winner };
  }

  requestDraw({ gameId, playerId }) {
    const session = this.getMultiplayerSession({ gameId, playerId });
    if (session.error) return session;
    const game = this.games.get(session.gameId);
    if (game.result?.status !== "ongoing") return { error: "Game is already finished" };

    this.clearExpiredDrawOffer(game);
    if (game.drawOffer) return { error: "A draw request is already pending" };

    const fromColor = session.assignedColor;
    const toColor = fromColor === "w" ? "b" : "w";
    game.drawOffer = {
      fromColor,
      toColor,
      expiresAt: Date.now() + 60_000
    };

    return { state: toState(game) };
  }

  respondDraw({ gameId, playerId, accept }) {
    const session = this.getMultiplayerSession({ gameId, playerId });
    if (session.error) return session;
    const game = this.games.get(session.gameId);
    if (game.result?.status !== "ongoing") return { error: "Game is already finished" };

    this.clearExpiredDrawOffer(game);
    if (!game.drawOffer) return { error: "No draw request pending" };
    if (game.drawOffer.toColor !== session.assignedColor) {
      return { error: "Only the receiving player can answer draw requests" };
    }

    if (accept) {
      game.result = { status: "draw", winner: null, reason: "agreed-draw" };
    }
    game.drawOffer = null;
    return { state: toState(game), accepted: Boolean(accept) };
  }
}
