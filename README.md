# ChessWeb

Full-stack chess website starter with:

- Local play mode
- Multiplayer mode
- Openings tab (studying openings, right now 6 openings exist and could be learned)
- Improve tab (still under development and does not contain anything right now.)

## Run

1. Install Node.js 20+.
2. Install dependencies:
   - `npm install`
3. Start backend + frontend together:
   - `npm run dev`
4. Open:
   - [http://localhost:5173](http://localhost:5173)
### OR
Join the github pages on the web at https://shaharak1.github.io/ChessWeb/#/local


## API (current)

- `POST /api/game/new` - create a local game
- `POST /api/game/state` - get state by game id
- `POST /api/game/move` - submit a chess move
- `GET /api/health` - service health

