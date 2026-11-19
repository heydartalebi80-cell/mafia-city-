
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const PORT = Number(process.env.PORT) || 3000;
const MAX_PLAYERS = 12;

interface Player {
  id: string;
  name: string;
  alive: boolean;
}

interface GameRoom {
  players: Player[];
  started: boolean;
}

const rooms = new Map<string, GameRoom>();

app.get("/", (_req, res) => {
  res.send("Mafia City Server is running!");
});

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("create-room", (roomId: string, playerName: string) => {
    if (typeof roomId !== "string" || typeof playerName !== "string") return;
    if (!roomId.trim() || !playerName.trim()) return;

    if (rooms.has(roomId)) {
      socket.emit("error-message", "Room already exists");
      return;
    }

    rooms.set(roomId, {
      players: [{ id: socket.id, name: playerName.trim().slice(0, 20), alive: true }],
      started: false
    });

    socket.join(roomId);
    socket.data.roomId = roomId;

    socket.emit("room-created", { roomId });
    io.to(roomId).emit("player-list", rooms.get(roomId)!.players);
  });

  socket.on("join-room", (roomId: string, playerName: string) => {
    if (typeof roomId !== "string" || typeof playerName !== "string") return;

    const room = rooms.get(roomId);
    if (!room || room.started || room.players.length >= MAX_PLAYERS) {
      socket.emit("error-message", "Room unavailable");
      return;
    }

    if (!playerName.trim()) return;

    room.players.push({
      id: socket.id,
      name: playerName.trim().slice(0, 20),
      alive: true
    });

    socket.join(roomId);
    socket.data.roomId = roomId;

    io.to(roomId).emit("player-list", room.players);
  });

  socket.on("chat-message", (message: string) => {
    const roomId = socket.data.roomId;
    if (typeof message !== "string" || !roomId) return;

    const room = rooms.get(roomId);
    if (!room || !room.players.some(p => p.id === socket.id)) return;

    io.to(roomId).emit("chat-message", {
      playerId: socket.id,
      message: message.slice(0, 300)
    });
  });

  socket.on("start-game", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.players.length !== MAX_PLAYERS || room.started) return;

    room.started = true;
    io.to(roomId).emit("game-started");
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomId);
    } else {
      io.to(roomId).emit("player-list", room.players);
    }

    console.log("Player disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Mafia City server running on port ${PORT}`);
});
