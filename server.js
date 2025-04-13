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

// Middleware para archivos estáticos y JSON
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Conexión a MongoDB
MongoClient.connect(MONGO_URL)
  .then((client) => {
    db = client.db(DB_NAME);
    playersCollection = db.collection("players");
    server.listen(PORT, () => console.log(`🎮 Servidor en puerto ${PORT}`));
  })
  .catch((err) => console.error("❌ Error conectando a MongoDB:", err));

// =======================================
//           RUTAS HTTP
// =======================================

// Crear un nuevo jugador (GET)
app.get("/create-player", async (req, res) => {
  const userId = uuidv4();
  const newPlayer = {
    userId,
    nombre: "Jugador misterioso",
    respeto: 0,
    partidas: 0,
    creadoEn: new Date()
  };

  await playersCollection.insertOne(newPlayer);
  console.log("🚀 Nuevo jugador creado con userId:", userId);

  res.json({ id: userId });
});

// Cambiar el nombre del jugador (POST)
app.post("/api/cambiar-nombre", async (req, res) => {
  const { userId, nombre } = req.body;
  if (!userId || !nombre) return res.status(400).send("Faltan datos");

  await playersCollection.updateOne(
    { userId },
    { $set: { nombre } }
  );

  res.send("Nombre actualizado");
});

// Mostrar ranking global (GET)
app.get("/api/ranking", async (req, res) => {
  try {
    const ranking = await playersCollection
      .find({}, { projection: { _id: 0, nombre: 1, respeto: 1 } })
      .sort({ respeto: -1 })
      .limit(10)
      .toArray();

    res.json(ranking);
  } catch (err) {
    console.error("❌ Error obteniendo ranking:", err);
    res.status(500).send("Error interno al obtener ranking.");
  }
});
