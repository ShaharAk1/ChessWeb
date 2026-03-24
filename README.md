# ChessWeb

Full-stack chess website starter with:

- Local play mode (same player controls both colors)
- Big centered 8x8 board UI
- Node.js backend API for game state and move validation
- Socket.io gateway scaffold for future multiplayer support

## Run

1. Install Node.js 20+.
2. Install dependencies:
   - `npm install`
3. Start backend + frontend together:
   - `npm run dev`
4. Open:
   - [http://localhost:5173](http://localhost:5173)

## API (current)

- `POST /api/game/new` - create a local game
- `POST /api/game/state` - get state by game id
- `POST /api/game/move` - submit a chess move
- `GET /api/health` - service health

## Multiplayer later

The backend already includes:

- `GameService` abstraction (game storage / rules)
- `socket.io` server bootstrap
- `multiplayerGateway.js` event registration placeholder

To add multiplayer later, connect socket events to game creation/join flow and broadcast validated moves from `GameService`.
