require("dotenv").config();

const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = "burzaco-royale";

let db, playersCollection;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json()); // 👉 necesario para leer JSON de los POST

// Conexión a Mongo
MongoClient.connect(MONGO_URL)
  .then((client) => {
    db = client.db(DB_NAME);
    playersCollection = db.collection("players");
    server.listen(PORT, () => console.log(`🎮 Servidor en puerto ${PORT}`));
  })
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err));

// API para cambiar el nombre del jugador
app.post("/api/cambiar-nombre", async (req, res) => {
  const { userId, nombre } = req.body;
  if (!userId || !nombre) return res.status(400).send("Faltan datos");

  await playersCollection.updateOne(
    { userId },
    { $set: { nombre } }
  );

  res.send("Nombre actualizado");
});

// API para mostrar ranking global
app.get("/api/ranking", async (req, res) => {
  const ranking = await playersCollection
    .find({}, { projection: { _id: 0, nombre: 1, respeto: 1 } })
    .sort({ respeto: -1 })
    .limit(10)
    .toArray();

  res.json(ranking);
});

// 🔥 PvP y lógica en tiempo real con sockets
let cola = [];

io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;
  if (!userId) return;

  let player = await playersCollection.findOne({ userId });

  if (!player) {
    player = {
      userId,
      nombre: "Jugador misterioso",
      respeto: 0,
      partidas: 0,
      creadoEn: new Date()
    };
    await playersCollection.insertOne(player);
  }

  socket.emit("bienvenida", {
    respeto: player.respeto,
    partidas: player.partidas,
    nombre: player.nombre
  });

  if (cola.length > 0) {
    const rivalSocket = cola.shift();

    rivalSocket.emit("startGame");
    socket.emit("startGame");

    rivalSocket.once("tap", async () => {
      await playersCollection.updateOne(
        { userId: rivalSocket.handshake.query.userId },
        { $inc: { respeto: 1, partidas: 1 } }
      );
      await playersCollection.updateOne(
        { userId },
        { $inc: { partidas: 1 } }
      );

      rivalSocket.emit("victoria");
      socket.emit("derrota");
    });

    socket.once("tap", async () => {
      await playersCollection.updateOne(
        { userId },
        { $inc: { respeto: 1, partidas: 1 } }
      );
      await playersCollection.updateOne(
        { userId: rivalSocket.handshake.query.userId },
        { $inc: { partidas: 1 } }
      );

      socket.emit("victoria");
      rivalSocket.emit("derrota");
    });
  } else {
    cola.push(socket);
  }

  socket.on("disconnect", () => {
    cola = cola.filter((s) => s !== socket);
  });
});