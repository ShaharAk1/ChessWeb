/**
 * Future multiplayer gateway.
 * Socket plumbing exists now so the transition to real-time games is smooth later.
 */
export function registerMultiplayerGateway(io, gameService) {
  io.on("connection", (socket) => {
    socket.emit("multiplayer:status", {
      enabled: false,
      message: "Multiplayer is not enabled yet. Local mode only for now."
    });

    // Example future events:
    // socket.on("match:create", () => {});
    // socket.on("match:join", ({ gameId }) => {});
    // socket.on("move:submit", ({ gameId, from, to }) => {});
    // Use gameService to validate and apply moves.
    void gameService;
  });
}
