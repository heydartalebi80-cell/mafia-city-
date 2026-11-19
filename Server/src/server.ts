
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import {
  createGame,
  getPublicPlayers,
  getPlayerRole,
  submitNightAction,
  resolveNight,
  castVote,
  resolveDayVote,
  type GameState
} from "./game";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 12;

interface LobbyPlayer {
  id: string;
  name: string;
}

interface GameRoom {
  hostId: string;
  players: LobbyPlayer[];
  game: GameState | null;
}

const rooms = new Map<string, GameRoom>();

function validText(value: unknown, max: number): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max;
}

function getRoom(socket: any): GameRoom | undefined {
  const roomId = socket.data.roomId;
  return typeof roomId === "string" ? rooms.get(roomId) : undefined;
}

function broadcastState(roomId: string, room: GameRoom) {
  if (!room.game) return;

  io.to(roomId).emit("game-state", {
    phase: room.game.phase,
    round: room.game.round,
    players: getPublicPlayers(room.game),
    winner: room.game.winner
  });
}

app.get("/", (_req, res) => {
  res.send("Mafia City Server is running!");
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("create-room", (roomId: string, playerName: string) => {
    if (!validText(roomId, 30) || !validText(playerName, 20)) return;

    roomId = roomId.trim();
    playerName = playerName.trim();

    if (rooms.has(roomId)) {
      socket.emit("error-message", "Room already exists");
      return;
    }

    const room: GameRoom = {
      hostId: socket.id,
      players: [{ id: socket.id, name: playerName }],
      game: null
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("room-created", { roomId });
    io.to(roomId).emit("player-list", room.players);
  });

  socket.on("join-room", (roomId: string, playerName: string) => {
    if (!validText(roomId, 30) || !validText(playerName, 20)) return;

    roomId = roomId.trim();
    playerName = playerName.trim();

    const room = rooms.get(roomId);

    if (!room || room.game || room.players.length >= MAX_PLAYERS) {
      socket.emit("error-message", "Room unavailable");
      return;
    }

    if (room.players.some(p => p.name === playerName)) {
      socket.emit("error-message", "Name already taken");
      return;
    }

    room.players.push({ id: socket.id, name: playerName });
    socket.join(roomId);
    socket.data.roomId = roomId;

    io.to(roomId).emit("player-list", room.players);
  });

  socket.on("start-game", () => {
    const roomId = socket.data.roomId;
    const room = getRoom(socket);

    if (!room || !roomId) return;

    if (socket.id !== room.hostId) {
      socket.emit("error-message", "Only host can start");
      return;
    }

    if (room.players.length !== MAX_PLAYERS || room.game) {
      socket.emit("error-message", "12 players are required");
      return;
    }

    room.game = createGame(room.players);

    for (const player of room.game.players) {
      socket.to(player.id).emit("game-started");
      io.to(player.id).emit("your-role", {
        role: player.role
      });
    }

    socket.emit("game-started");

    broadcastState(roomId, room);
  });

  socket.on("chat-message", (message: string) => {
    const roomId = socket.data.roomId;
    const room = getRoom(socket);

    if (!room || !roomId || !validText(message, 300)) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    if (room.game) {
      const gamePlayer = room.game.players.find(
        p => p.id === socket.id
      );
      if (!gamePlayer?.alive) return;
    }

    io.to(roomId).emit("chat-message", {
      playerId: socket.id,
      playerName: player.name,
      message: message.trim()
    });
  });

  socket.on("night-action", (targetId: string) => {
    const roomId = socket.data.roomId;
    const room = getRoom(socket);

    if (!room?.game || !roomId || !validText(targetId, 100)) return;

    const game = room.game;
    const role = getPlayerRole(game, socket.id);

    if (role === "mafia" && game.mafiaTarget) return;
    if (role === "doctor" && game.protectedPlayer) return;
    if (role === "detective" && game.detectiveTarget) return;

    const success = submitNightAction(game, socket.id, targetId);

    if (!success) {
      socket.emit("error-message", "Invalid night action");
      return;
    }

    socket.emit("action-confirmed");
  });

  socket.on("resolve-night", () => {
    const roomId = socket.data.roomId;
    const room = getRoom(socket);

    if (!room?.game || !roomId) return;

    if (socket.id !== room.hostId) return;

    const detective = room.game.players.find(
      p => p.role === "detective" && p.alive
    );

    const result = resolveNight(room.game);

    if (detective && result.detectiveResult !== null) {
      io.to(detective.id).emit("detective-result", {
        isMafia: result.detectiveResult
      });
    }

    io.to(roomId).emit("night-result", {
      eliminated: result.eliminated
    });

    broadcastState(roomId, room);
  });

  socket.on("vote", (targetId: string) => {
    const roomId = socket.data.roomId;
    const room = getRoom(socket);

    if (!room?.game || !roomId || !validText(targetId, 100)) return;

    const success = castVote(room.game, socket.id, targetId);

    if (!success) {
      socket.emit("error-message", "Invalid vote");
      return;
    }

    socket.emit("vote-confirmed");
  });

  socket.on("resolve-vote", () => {
    const roomId = socket.data.roomId;
    const room = getRoom(socket);

    if (!room?.game || !roomId) return;
    if (socket.id !== room.hostId) return;

    const result = resolveDayVote(room.game);

    io.to(roomId).emit("vote-result", result);

    broadcastState(roomId, room);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (!room.game) {
      room.players = room.players.filter(
        p => p.id !== socket.id
      );

      if (room.players.length === 0) {
        rooms.delete(roomId);
        return;
      }

      if (room.hostId === socket.id) {
        room.hostId = room.players[0].id;
      }

      io.to(roomId).emit("player-list", room.players);
    } else {
      io.to(roomId).emit("player-disconnected", {
        playerId: socket.id
      });
    }

    console.log("Disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Mafia City running on port ${PORT}`);
});
