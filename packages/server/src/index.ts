import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import { ArenaRoom } from "./rooms/ArenaRoom.js";


const ROOM_NAME = "arena";
const PORT = Number(process.env.PORT ?? 2567);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser tools (no origin) + your client domain
      if (!origin || origin === CLIENT_ORIGIN) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);

app.get("/health", (_req, res) =>  {
    res.json({ok: true, room: ROOM_NAME});
});

const httpServer = createServer(app);
const gameServer = new Server({
    transport: new WebSocketTransport({
        server: httpServer
    })
});

gameServer.define(ROOM_NAME, ArenaRoom);
app.use("/colyseus", monitor()); //sees server info and room list at http://localhost:2567/colyseus
gameServer.listen(PORT);
console.log(`Server running on http://localhost:${PORT}`);
