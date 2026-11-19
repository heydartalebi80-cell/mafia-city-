
import { createServer } from "http";
import { randomUUID, randomInt } from "crypto";
import { WebSocket, WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 3000);

type Player = {
  id: string;
  name: string;
  socket: WebSocket;
};

type Room = {
  code: string;
  capacity: 6 | 8 | 10;
  players: Player[];
};

const rooms = new Map<string, Room>();

const httpServer = createServer();
const wss = new WebSocketServer({ server: httpServer });

function send(socket: WebSocket, data: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function broadcast(room: Room, data: unknown) {
  for (const player of room.players) {
    send(player.socket, data);
  }
}

function createRoom(
  socket: WebSocket,
  name: string,
  capacity: 6 | 8 | 10
) {
  let code = "";

  do {
    code = randomInt(100000, 1000000).toString();
  } while (rooms.has(code));

  const room: Room = {
    code,
    capacity,
    players: []
  };

  rooms.set(code, room);
  joinRoom(socket, name, code);
}

function joinRoom(
  socket: WebSocket,
  name: string,
  code: string
) {
  const room = rooms.get(code);

  if (!room) {
    return send(socket, { type: "error", message: "Room not found" });
  }

  if (room.players.length >= room.capacity) {
    return send(socket, { type: "error", message: "Room is full" });
  }

  if (room.players.some(p => p.socket === socket)) {
    return send(socket, { type: "error", message: "Already in a room" });
  }

  const player: Player = {
    id: randomUUID(),
    name: name.slice(0, 20),
    socket
  };

  room.players.push(player);

  send(socket, {
    type: "joined",
    roomCode: room.code,
    playerId: player.id,
    capacity: room.capacity
  });

  broadcast(room, {
    type: "room_update",
    roomCode: room.code,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name
    })),
    capacity: room.capacity
  });
}

function removePlayer(socket: WebSocket) {
  for (const [code, room] of rooms) {
    room.players = room.players.filter(p => p.socket !== socket);

    if (room.players.length === 0) {
      rooms.delete(code);
    } else {
      broadcast(room, {
        type: "room_update",
        roomCode: code,
        players: room.players.map(p => ({
          id: p.id,
          name: p.name
        })),
        capacity: room.capacity
      });
    }
  }
}

wss.on("connection", socket => {
  send(socket, { type: "connected", message: "Welcome to Mafia City" });

  socket.on("message", raw => {
    try {
      const data = JSON.parse(raw.toString());

      if (typeof data.name !== "string" ||
          data.name.trim().length === 0) {
        return send(socket, { type: "error", message: "Invalid name" });
      }

      if (data.type === "create_room") {
        if (![6, 8, 10].includes(data.capacity)) {
          return send(socket, { type: "error", message: "Invalid room size" });
        }

        createRoom(socket, data.name.trim(), data.capacity);
      } else if (data.type === "join_room") {
        if (typeof data.roomCode !== "string" ||
            !/^\d{6}$/.test(data.roomCode)) {
          return send(socket, { type: "error", message: "Invalid room code" });
        }

        joinRoom(socket, data.name.trim(), data.roomCode);
      } else {
        send(socket, { type: "error", message: "Unknown command" });
      }
    } catch {
      send(socket, { type: "error", message: "Invalid message" });
    }
  });

  socket.on("close", () => removePlayer(socket));
});

httpServer.listen(PORT, () => {
  console.log(\`Mafia City server running on port \${PORT}\`);
});
