const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

app.use(express.static("public"));

let waitingPlayer = null;
let gameIdCounter = 0;

io.on("connection", (socket) => {
  console.log(`Jugador conectado: ${socket.id}`);

  if (waitingPlayer) {
    // Armar partida 1v1
    const gameId = `game-${gameIdCounter++}`;
    const player1 = waitingPlayer;
    const player2 = socket;
    waitingPlayer = null;

    player1.join(gameId);
    player2.join(gameId);

    io.to(gameId).emit("game-start", { gameId, players: [player1.id, player2.id] });

    // Escuchar eventos de acción de cada jugador
    socket.on("action", (data) => {
      socket.to(gameId).emit("opponent-action", data);
    });

    player1.on("action", (data) => {
      player1.to(gameId).emit("opponent-action", data);
    });

    // Ganador declarado
    socket.on("game-over", (data) => {
      io.to(gameId).emit("game-over", data);
    });

  } else {
    waitingPlayer = socket;
    socket.emit("waiting", "Esperando a otro jugador...");
  }

  socket.on("disconnect", () => {
    console.log(`Jugador desconectado: ${socket.id}`);
    if (waitingPlayer === socket) {
      waitingPlayer = null;
    }
  });
});

server.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
