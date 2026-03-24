import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { GameService } from "./gameService.js";
import { registerMultiplayerGateway } from "./multiplayerGateway.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const gameService = new GameService();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, mode: "local-only" });
});

app.post("/api/game/new", (_req, res) => {
  const state = gameService.createLocalGame();
  res.status(201).json({ gameId: state.id, state });
});

app.post("/api/game/state", (req, res) => {
  const { gameId } = req.body ?? {};
  if (!gameId) return res.status(400).json({ error: "gameId is required" });

  const state = gameService.getState(gameId);
  if (!state) return res.status(404).json({ error: "Game not found" });

  res.json({ state });
});

app.post("/api/game/move", (req, res) => {
  const { gameId, from, to, promotion } = req.body ?? {};
  if (!gameId || !from || !to) {
    return res.status(400).json({ error: "gameId, from, and to are required" });
  }

  const result = gameService.applyMove({ gameId, from, to, promotion });
  if (result.error) return res.status(400).json({ error: result.error });

  res.json({ state: result.state, move: result.move });
});

app.post("/api/multiplayer/create", (req, res) => {
  const { playerId } = req.body ?? {};
  if (!playerId) return res.status(400).json({ error: "playerId is required" });

  const result = gameService.createMultiplayerGame({ ownerPlayerId: playerId });
  if (result.error) return res.status(400).json({ error: result.error });

  res.status(201).json(result);
});

app.post("/api/multiplayer/join", (req, res) => {
  const { gameId, playerId } = req.body ?? {};
  if (!gameId || !playerId) {
    return res.status(400).json({ error: "gameId and playerId are required" });
  }

  const result = gameService.joinMultiplayerGame({ gameId, playerId });
  if (result.error) return res.status(400).json({ error: result.error });

  res.json(result);
});

app.post("/api/multiplayer/state", (req, res) => {
  const { gameId, playerId } = req.body ?? {};
  if (!gameId || !playerId) {
    return res.status(400).json({ error: "gameId and playerId are required" });
  }

  const result = gameService.getMultiplayerSession({ gameId, playerId });
  if (result.error) return res.status(400).json({ error: result.error });

  res.json(result);
});

app.post("/api/multiplayer/move", (req, res) => {
  const { gameId, playerId, from, to, promotion } = req.body ?? {};
  if (!gameId || !playerId || !from || !to) {
    return res.status(400).json({ error: "gameId, playerId, from, and to are required" });
  }

  const session = gameService.getMultiplayerSession({ gameId, playerId });
  if (session.error) return res.status(400).json({ error: session.error });

  const result = gameService.applyMove({
    gameId: session.gameId,
    from,
    to,
    promotion,
    playerColor: session.assignedColor
  });
  if (result.error) return res.status(400).json({ error: result.error });

  res.json({ state: result.state, move: result.move, assignedColor: session.assignedColor });
});

app.post("/api/multiplayer/surrender", (req, res) => {
  const { gameId, playerId } = req.body ?? {};
  if (!gameId || !playerId) {
    return res.status(400).json({ error: "gameId and playerId are required" });
  }
  const result = gameService.surrenderMultiplayerGame({ gameId, playerId });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.post("/api/multiplayer/draw/request", (req, res) => {
  const { gameId, playerId } = req.body ?? {};
  if (!gameId || !playerId) {
    return res.status(400).json({ error: "gameId and playerId are required" });
  }
  const result = gameService.requestDraw({ gameId, playerId });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

app.post("/api/multiplayer/draw/respond", (req, res) => {
  const { gameId, playerId, accept } = req.body ?? {};
  if (!gameId || !playerId || typeof accept !== "boolean") {
    return res
      .status(400)
      .json({ error: "gameId, playerId, and accept(boolean) are required" });
  }
  const result = gameService.respondDraw({ gameId, playerId, accept });
  if (result.error) return res.status(400).json({ error: result.error });
  res.json(result);
});

registerMultiplayerGateway(io, gameService);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chess backend running on http://localhost:${PORT}`);
});
