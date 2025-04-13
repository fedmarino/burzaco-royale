require("dotenv").config();
const { MongoClient } = require("mongodb");

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = "burzaco-royale";  // Nombre de la base de datos que estás usando

async function testConnection() {
  try {
    const client = await MongoClient.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✔️ Conexión exitosa a MongoDB");

    // Conectarse a la base de datos
    const db = client.db(DB_NAME);
    console.log(`✔️ Conectado a la base de datos: ${DB_NAME}`);

    // Intentamos leer una colección (puede ser cualquier colección que ya exista)
    const collection = db.collection("players");
    const players = await collection.find().limit(5).toArray();
    console.log("✔️ Jugadores encontrados:", players);

    client.close();
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
  }
}

testConnection();
