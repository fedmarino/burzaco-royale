// server.js

require("dotenv").config();
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const { MongoClient } = require("mongodb");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = "burzaco-royale";

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Demasiadas peticiones, por favor intenta más tarde"
});
app.use(limiter);

let db, playersCollection;
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

function normalizarNombre(nombre) {
    return nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
}

function validarContrasena(contrasena) {
    if (contrasena.length < 8) {
        return { valido: false, error: "La contraseña debe tener al menos 8 caracteres" };
    }
    if (!/[A-Za-z]/.test(contrasena)) {
        return { valido: false, error: "La contraseña debe contener al menos una letra" };
    }
    if (!/\d/.test(contrasena)) {
        return { valido: false, error: "La contraseña debe contener al menos un número" };
    }
    return { valido: true };
}

MongoClient.connect(MONGO_URL)
    .then(client => {
        db = client.db(DB_NAME);
        playersCollection = db.collection("players");
        server.listen(PORT, () => console.log(`🎮 Servidor en puerto ${PORT}`));
    })
    .catch(err => console.error("❌ Error conectando a MongoDB:", err));

// ... Otras rutas (create-player, /api/login, /api/ranking) sin cambios ...

app.post("/api/login", async(req, res) => {
    const { nombre, password, userId } = req.body;

    try {
        let jugador;

        if (userId) {
            // Login por userId (para sesiones existentes)
            jugador = await playersCollection.findOne({ userId });
            if (!jugador) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }
        } else {
            // Login por nombre y contraseña
            if (!nombre || !password) {
                return res.status(400).json({ error: "Faltan nombre o contraseña" });
            }

            const nombreNormalizado = normalizarNombre(nombre);
            jugador = await playersCollection.findOne({ nombreNormalizado });

            if (!jugador) {
                return res.status(404).json({ error: "Usuario no encontrado" });
            }

            const passwordValido = await bcrypt.compare(password, jugador.password);
            if (!passwordValido) {
                return res.status(401).json({ error: "Contraseña incorrecta" });
            }
        }

        // Obtener ranking del jugador
        const ranking = await playersCollection
            .find({ respeto: { $gt: 0 } })
            .sort({ respeto: -1 })
            .toArray();
        const posicionRanking = ranking.findIndex(j => j.userId === jugador.userId) + 1;

        res.json({
            userId: jugador.userId,
            nombre: jugador.nombre,
            respeto: jugador.respeto || 0,
            partidas: jugador.partidas || 0,
            ranking: posicionRanking
        });
    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.get("/api/ranking", async(req, res) => {
    try {
        const ranking = await playersCollection
            .find({ respeto: { $gt: 0 } })
            .sort({ respeto: -1 })
            .project({ nombre: 1, respeto: 1, partidas: 1, _id: 0 })
            .toArray();

        res.json(ranking);
    } catch (error) {
        console.error("Error obteniendo ranking:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.post("/api/cambiar-nombre", async(req, res) => {
    const { userId, nombre, password } = req.body;
    if (!userId || !nombre || !password) {
        return res.status(400).json({ error: "Faltan datos" });
    }

    // Validación correcta de contraseña
    const validacion = validarContrasena(password);
    if (!validacion.valido) {
        return res.status(400).json({ error: validacion.error });
    }

    const nombreNormalizado = normalizarNombre(nombre);
    const jugadorExistente = await playersCollection.findOne({
        nombreNormalizado,
        userId: { $ne: userId }
    });
    if (jugadorExistente) {
        return res.status(400).json({ error: "Ya existe un jugador con ese nombre" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await playersCollection.updateOne({ userId }, {
        $set: {
            nombre,
            nombreNormalizado,
            password: hashedPassword,
            intentosLogin: 0,
            bloqueadoHasta: null
        }
    });

    res.json({ mensaje: "Nombre actualizado correctamente" });
});

// =======================================
//           SOCKET.IO
// =======================================
let jugadoresEnEspera = [];
let jugadoresEnJuego = new Map(); // Almacena los toques de cada jugador

io.on('connection', (socket) => {
    console.log('Nuevo jugador conectado:', socket.id);

    socket.on('buscarCombate', () => {
        jugadoresEnEspera.push(socket.id);
        console.log('Jugador buscando combate:', socket.id);

        if (jugadoresEnEspera.length >= 2) {
            const jugador1 = jugadoresEnEspera.shift();
            const jugador2 = jugadoresEnEspera.shift();

            // Inicializar contadores para ambos jugadores
            jugadoresEnJuego.set(jugador1, 0);
            jugadoresEnJuego.set(jugador2, 0);

            // Obtener información de los jugadores
            Promise.all([
                playersCollection.findOne({ userId: io.sockets.sockets.get(jugador1).handshake.query.playerId }),
                playersCollection.findOne({ userId: io.sockets.sockets.get(jugador2).handshake.query.playerId })
            ]).then(async([jugador1Data, jugador2Data]) => {
                // Obtener ranking de ambos jugadores
                const ranking = await playersCollection
                    .find({ respeto: { $gt: 0 } })
                    .sort({ respeto: -1 })
                    .toArray();

                const jugador1Ranking = ranking.findIndex(j => j.userId === jugador1Data.userId) + 1;
                const jugador2Ranking = ranking.findIndex(j => j.userId === jugador2Data.userId) + 1;

                // Enviar información a ambos jugadores
                io.to(jugador1).emit('startGame', {
                    jugador1: {
                        nombre: jugador1Data.nombre,
                        respeto: jugador1Data.respeto,
                        ranking: jugador1Ranking
                    },
                    jugador2: {
                        nombre: jugador2Data.nombre,
                        respeto: jugador2Data.respeto,
                        ranking: jugador2Ranking
                    }
                });

                io.to(jugador2).emit('startGame', {
                    jugador1: {
                        nombre: jugador2Data.nombre,
                        respeto: jugador2Data.respeto,
                        ranking: jugador2Ranking
                    },
                    jugador2: {
                        nombre: jugador1Data.nombre,
                        respeto: jugador1Data.respeto,
                        ranking: jugador1Ranking
                    }
                });

                console.log('Combate iniciado entre:', jugador1Data.nombre, 'y', jugador2Data.nombre);
            });
        } else {
            socket.emit('esperandoRival');
        }
    });

    socket.on('finJuego', async(toques) => {
        const playerId = socket.handshake.query.playerId;
        jugadoresEnJuego.set(socket.id, toques);

        // Verificar si ambos jugadores han terminado
        const jugadores = Array.from(jugadoresEnJuego.entries());
        if (jugadores.length === 2 && jugadores.every(([_, toques]) => toques > 0)) {
            const [jugador1, toques1] = jugadores[0];
            const [jugador2, toques2] = jugadores[1];

            const ganador = toques1 > toques2 ? jugador1 : jugador2;
            const perdedor = toques1 > toques2 ? jugador2 : jugador1;

            try {
                // Actualizar el respeto del ganador
                const ganadorId = io.sockets.sockets.get(ganador).handshake.query.playerId;
                const resultadoGanador = await playersCollection.findOneAndUpdate({ userId: ganadorId }, {
                    $inc: { respeto: 1, partidas: 1 }
                }, { returnDocument: 'after' });

                // Actualizar partidas jugadas del perdedor
                const perdedorId = io.sockets.sockets.get(perdedor).handshake.query.playerId;
                const resultadoPerdedor = await playersCollection.findOneAndUpdate({ userId: perdedorId }, { $inc: { partidas: 1 } }, { returnDocument: 'after' });

                // Notificar a los jugadores
                io.to(ganador).emit('victoria');
                io.to(perdedor).emit('derrota');

                // Enviar actualización de puntaje a ambos jugadores
                io.to(ganador).emit('actualizarPuntaje', {
                    respeto: resultadoGanador.value.respeto,
                    partidas: resultadoGanador.value.partidas
                });

                io.to(perdedor).emit('actualizarPuntaje', {
                    respeto: resultadoPerdedor.value.respeto,
                    partidas: resultadoPerdedor.value.partidas
                });

                console.log(`Jugador ${ganadorId} ganó con ${Math.max(toques1, toques2)} toques`);
            } catch (err) {
                console.error('Error actualizando puntuaciones:', err);
                io.to(ganador).emit('error', 'Error al actualizar puntuación');
                io.to(perdedor).emit('error', 'Error al actualizar puntuación');
            }

            // Limpiar estado del juego
            jugadoresEnJuego.clear();
        }
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        jugadoresEnJuego.delete(socket.id);
    });
});