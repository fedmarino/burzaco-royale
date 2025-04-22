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

// Configuración de rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de 100 peticiones por ventana
    message: "Demasiadas peticiones, por favor intenta más tarde",
    skip: (req) => {
        // No aplicar rate limiting a las rutas de login y ranking
        return req.path === '/api/login' || req.path === '/api/ranking';
    }
});

// Aplicar rate limiting a todas las rutas excepto las estáticas
app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
        limiter(req, res, next);
    } else {
        next();
    }
});

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

// Función para normalizar nombres
function normalizarNombre(nombre) {
    return nombre
        .toLowerCase() // Convertir a minúsculas
        .normalize('NFD') // Separar caracteres acentuados
        .replace(/[\u0300-\u036f]/g, '') // Eliminar diacríticos
        .replace(/[^a-z0-9]/g, '') // Eliminar todo excepto letras y números
        .trim(); // Eliminar espacios al inicio y final
}

// Función para validar contraseña
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

// Crear un nuevo jugador (GET)
app.get("/create-player", async(req, res) => {
    const userId = uuidv4();
    const newPlayer = {
        userId,
        nombre: "Jugador misterioso",
        nombreNormalizado: normalizarNombre("Jugador misterioso"),
        respeto: 0,
        partidas: 0,
        creadoEn: new Date(),
        password: null,
        intentosLogin: 0,
        bloqueadoHasta: null
    };

    await playersCollection.insertOne(newPlayer);
    console.log("🚀 Nuevo jugador creado con userId:", userId);

    res.json({ id: userId });
});

// Login (POST)
app.post("/api/login", async(req, res) => {
    console.log("[Server] Intento de login:", { nombre: req.body.nombre, userId: req.body.userId });
    const { nombre, password, userId } = req.body;

    // Si se proporciona userId, intentar login directo
    if (userId) {
        console.log("[Server] Intentando login con userId:", userId);
        const jugador = await playersCollection.findOne({ userId });
        if (!jugador) {
            console.log("[Server] Usuario no encontrado con userId:", userId);
            return res.status(401).json({ error: "Usuario no encontrado" });
        }

        // Obtener el ranking del jugador
        const ranking = await playersCollection
            .find({ respeto: { $gt: 0 } })
            .sort({ respeto: -1 })
            .toArray();

        const posicionRanking = ranking.findIndex(j => j.userId === jugador.userId) + 1;

        console.log("[Server] Login exitoso con userId:", userId);
        return res.json({
            userId: jugador.userId,
            nombre: jugador.nombre,
            respeto: jugador.respeto,
            partidas: jugador.partidas,
            ranking: posicionRanking
        });
    }

    // Login normal con nombre y contraseña
    if (!nombre || !password) {
        console.log("[Server] Faltan datos para login");
        return res.status(400).json({ error: "Faltan datos" });
    }

    const nombreNormalizado = normalizarNombre(nombre);
    console.log("[Server] Buscando jugador con nombre normalizado:", nombreNormalizado);
    let jugador = await playersCollection.findOne({ nombreNormalizado });

    // Si el jugador no existe, lo creamos
    if (!jugador) {
        console.log("[Server] Jugador no encontrado, creando nuevo");
        const validacion = validarContrasena(password);
        if (!validacion.valido) {
            console.log("[Server] Contraseña inválida:", validacion.error);
            return res.status(400).json({ error: validacion.error });
        }

        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 10);

        jugador = {
            userId,
            nombre,
            nombreNormalizado,
            respeto: 0,
            partidas: 0,
            creadoEn: new Date(),
            password: hashedPassword,
            intentosLogin: 0,
            bloqueadoHasta: null
        };

        await playersCollection.insertOne(jugador);
        console.log("[Server] Nuevo jugador creado:", nombre);
    } else {
        console.log("[Server] Jugador encontrado, verificando contraseña");
        // Verificar si la cuenta está bloqueada
        if (jugador.bloqueadoHasta && jugador.bloqueadoHasta > new Date()) {
            const minutosRestantes = Math.ceil((jugador.bloqueadoHasta - new Date()) / 60000);
            console.log("[Server] Cuenta bloqueada, minutos restantes:", minutosRestantes);
            return res.status(403).json({
                error: `Cuenta bloqueada. Intenta nuevamente en ${minutosRestantes} minutos`
            });
        }

        // Verificar contraseña
        const contrasenaValida = await bcrypt.compare(password, jugador.password);
        console.log("[Server] Resultado de comparación de contraseña:", contrasenaValida);
        if (!contrasenaValida) {
            // Incrementar intentos fallidos
            await playersCollection.updateOne({ userId: jugador.userId }, { $inc: { intentosLogin: 1 } });

            // Bloquear cuenta después de 5 intentos fallidos
            if (jugador.intentosLogin + 1 >= 5) {
                const bloqueadoHasta = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
                await playersCollection.updateOne({ userId: jugador.userId }, { $set: { bloqueadoHasta } });
                console.log("[Server] Cuenta bloqueada por demasiados intentos");
                return res.status(403).json({
                    error: "Demasiados intentos fallidos. Cuenta bloqueada por 15 minutos"
                });
            }

            console.log("[Server] Contraseña incorrecta");
            return res.status(401).json({ error: "Contraseña incorrecta" });
        }

        // Resetear intentos fallidos y bloqueo
        await playersCollection.updateOne({ userId: jugador.userId }, {
            $set: {
                intentosLogin: 0,
                bloqueadoHasta: null
            }
        });
    }

    // Obtener el ranking del jugador
    const ranking = await playersCollection
        .find({ respeto: { $gt: 0 } })
        .sort({ respeto: -1 })
        .toArray();

    const posicionRanking = ranking.findIndex(j => j.userId === jugador.userId) + 1;

    console.log("[Server] Login exitoso para:", jugador.nombre);
    res.json({
        userId: jugador.userId,
        nombre: jugador.nombre,
        respeto: jugador.respeto,
        partidas: jugador.partidas,
        ranking: posicionRanking
    });
});

// Cambiar el nombre del jugador (POST)
app.post("/api/cambiar-nombre", async(req, res) => {
    const { userId, nombre, password } = req.body;
    if (!userId || !nombre || !password) return res.status(400).json({ error: "Faltan datos" });

    if (!validarContrasena(password)) {
        return res.status(400).json({
            error: "La contraseña debe tener al menos 8 caracteres, incluyendo letras y números"
        });
    }

    const nombreNormalizado = normalizarNombre(nombre);

    // Verificar si ya existe un jugador con ese nombre normalizado
    const jugadorExistente = await playersCollection.findOne({
        nombreNormalizado,
        userId: { $ne: userId }
    });

    if (jugadorExistente) {
        return res.status(400).json({ error: "Ya existe un jugador con ese nombre" });
    }

    // Hash de la contraseña
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

// Mostrar ranking global (GET)
app.get("/api/ranking", async(req, res) => {
    try {
        const ranking = await playersCollection
            .find({ respeto: { $gt: 0 } }, { projection: { _id: 0, nombre: 1, respeto: 1, partidas: 1 } })
            .sort({ respeto: -1 })
            .limit(10)
            .toArray();

        res.json(ranking);
    } catch (err) {
        console.error("❌ Error obteniendo ranking:", err);
        res.status(500).send("Error interno al obtener ranking.");
    }
});

// =======================================
//           SOCKET.IO
// =======================================
let jugadoresEnEspera = [];
let jugadoresEnJuego = new Map(); // Almacena los toques de cada jugador
let partidasEnProceso = new Set(); // Nuevo: para controlar partidas ya procesadas

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
        console.log("[Server] Recibido finJuego de", playerId, "con", toques, "toques");

        // Verificar si esta partida ya fue procesada
        const partidaId = `${socket.id}-${Date.now()}`;
        if (partidasEnProceso.has(partidaId)) {
            console.log("[Server] Partida ya procesada, ignorando");
            return;
        }
        partidasEnProceso.add(partidaId);

        jugadoresEnJuego.set(socket.id, toques);

        // Verificar si ambos jugadores han terminado
        const jugadores = Array.from(jugadoresEnJuego.entries());
        if (jugadores.length === 2) {
            const [jugador1, toques1] = jugadores[0];
            const [jugador2, toques2] = jugadores[1];

            console.log("[Server] Ambos jugadores terminaron:", {
                jugador1: { id: io.sockets.sockets.get(jugador1).handshake.query.playerId, toques: toques1 },
                jugador2: { id: io.sockets.sockets.get(jugador2).handshake.query.playerId, toques: toques2 }
            });

            // Si ambos jugadores tienen 0 toques, es un empate
            if (toques1 === 0 && toques2 === 0) {
                try {
                    // Actualizar partidas jugadas de ambos jugadores
                    const jugador1Id = io.sockets.sockets.get(jugador1).handshake.query.playerId;
                    const jugador2Id = io.sockets.sockets.get(jugador2).handshake.query.playerId;

                    console.log("[Server] Actualizando empate para jugadores:", jugador1Id, "y", jugador2Id);

                    const resultado1 = await playersCollection.findOneAndUpdate({ userId: jugador1Id }, { $inc: { partidas: 1 } }, { returnDocument: 'after' });

                    const resultado2 = await playersCollection.findOneAndUpdate({ userId: jugador2Id }, { $inc: { partidas: 1 } }, { returnDocument: 'after' });

                    // Notificar a los jugadores
                    io.to(jugador1).emit('empate');
                    io.to(jugador2).emit('empate');

                    // Enviar actualización de puntaje
                    io.to(jugador1).emit('actualizarPuntaje', {
                        respeto: resultado1.value.respeto,
                        partidas: resultado1.value.partidas
                    });

                    io.to(jugador2).emit('actualizarPuntaje', {
                        respeto: resultado2.value.respeto,
                        partidas: resultado2.value.partidas
                    });

                    console.log(`[Server] Empate procesado entre ${jugador1Id} y ${jugador2Id}`);
                } catch (err) {
                    console.error('[Server] Error actualizando puntuaciones:', err);
                    io.to(jugador1).emit('error', 'Error al actualizar puntuación');
                    io.to(jugador2).emit('error', 'Error al actualizar puntuación');
                }
            } else {
                // Determinar ganador y perdedor
                let ganador, perdedor;
                if (toques1 === 0) {
                    ganador = jugador2;
                    perdedor = jugador1;
                } else if (toques2 === 0) {
                    ganador = jugador1;
                    perdedor = jugador2;
                } else {
                    ganador = toques1 > toques2 ? jugador1 : jugador2;
                    perdedor = toques1 > toques2 ? jugador2 : jugador1;
                }

                try {
                    // Actualizar el respeto del ganador y partidas jugadas
                    const ganadorId = io.sockets.sockets.get(ganador).handshake.query.playerId;
                    const perdedorId = io.sockets.sockets.get(perdedor).handshake.query.playerId;

                    console.log("[Server] Actualizando victoria/derrota para jugadores:", ganadorId, "y", perdedorId);

                    const resultadoGanador = await playersCollection.findOneAndUpdate({ userId: ganadorId }, { $inc: { respeto: 1, partidas: 1 } }, { returnDocument: 'after' });

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

                    console.log(`[Server] Victoria procesada para ${ganadorId} con ${Math.max(toques1, toques2)} toques`);
                } catch (err) {
                    console.error('[Server] Error actualizando puntuaciones:', err);
                    io.to(ganador).emit('error', 'Error al actualizar puntuación');
                    io.to(perdedor).emit('error', 'Error al actualizar puntuación');
                }
            }

            // Limpiar estado del juego
            jugadoresEnJuego.clear();
            // Limpiar la partida procesada después de un tiempo
            setTimeout(() => partidasEnProceso.delete(partidaId), 10000);
        }
    });

    socket.on('disconnect', () => {
        console.log('Jugador desconectado:', socket.id);
        jugadoresEnEspera = jugadoresEnEspera.filter(id => id !== socket.id);
        jugadoresEnJuego.delete(socket.id);
    });
});