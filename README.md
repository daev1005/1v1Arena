# PvP

2D top-down multiplayer PvP game built in a monorepo with Phaser (client) and Colyseus (server).

## Tech Stack

- Frontend: Phaser 3 + TypeScript + Vite
- Backend: Colyseus + TypeScript + Node.js
- Shared package: common game config/constants used by both client and server

## Workspace Layout

- `packages/client`: Phaser/Vite frontend
- `packages/server`: Colyseus game server
- `packages/shared`: shared TypeScript config/constants

## Current Features (Implemented)

- Multiplayer room connection (`joinOrCreate("arena")`) with 2-player limit.
- Real-time movement syncing between clients and server.
- WASD movement, directional dash, and mouse-based facing.
- Sword combat loop with server-authoritative hit validation.
- Combat state features applied to real players:
  - hit flash feedback
  - invincibility frames after heavy (3rd) combo hit
  - light/heavy knockback
  - combo reset window if follow-up hits are delayed
- HP syncing and round flow:
  - round end on KO
  - delayed round reset
  - round start/end banner messages
- Remote player visual replication:
  - smooth movement interpolation
  - remote facing direction indicator
  - remote sword swing visual replication
- Shared gameplay config through `@pvp/shared` (`arena`, `player`, `dash`, `sword`, `combat`).

## Scripts

- `npm run dev:client` - start client dev server
- `npm run dev:server` - start server dev process
- `npm run build` - build shared, server, and client
- `npm run typecheck` - typecheck shared, server, and client

## Upcoming Features

- Room UX: explicit create/join by code flow on the client.
- Authentication and player identity.
- Combat expansion: bomb and gun (projectile weapons).
- Round/lives system polish (best-of rounds, clearer match UI).
- Better reconnect/disconnect handling and session recovery.
- Gameplay polish and balancing pass.
