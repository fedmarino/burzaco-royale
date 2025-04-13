/************************************************************/
/*   1) Crear jugador si no existe (y guardar en local)     */
/************************************************************/
let playerId = localStorage.getItem("playerId");

async function crearJugador() {
  try {
    const res = await fetch("/create-player");
    const data = await res.json();
    playerId = data.id;
    localStorage.setItem("playerId", playerId);
    console.log("Nuevo jugador creado con ID:", playerId);
  } catch (err) {
    console.error("Error creando jugador:", err);
  }
}

if (!playerId) {
  // No existe playerId, creamos
  crearJugador().then(() => inicializarSocket());
} else {
  // Ya existe playerId, iniciamos socket
  console.log("Jugador reconocido:", playerId);
  inicializarSocket();
}

/************************************************************/
/*   2) Inicializar Socket.io y lógica de PvP               */
/************************************************************/
function inicializarSocket() {
  const socket = io({
    query: { playerId }
  });

  const respetoDisplay = document.getElementById("respeto");
  const partidasDisplay = document.getElementById("partidas");

  // Al conectarse, el server envía "bienvenida"
  socket.on("bienvenida", (data) => {
    console.log("👋 Bienvenido de nuevo!");
    respetoDisplay.textContent = data.respeto;
    partidasDisplay.textContent = data.partidas;

    // Mostrar nombre si ya lo tiene
    document.getElementById("nombre").textContent = data.nombre || "Anónimo";
  });

  // Llamado cuando se arma un match
  socket.on("startGame", () => {
    console.log("💥 ¡Partida encontrada!");
    // Acá podrías cambiar de pantalla o mostrar "En combate..."
  });

  // Si no hay rival
  socket.on("esperandoRival", () => {
    console.log("🕖 Esperando rival...");
  });

  // Victoria/derrota
  socket.on("victoria", () => {
    alert("🔥 ¡Ganaste respeto!");
    // Sumamos 1 respeto y 1 partida a mano en la UI
    respetoDisplay.textContent = parseInt(respetoDisplay.textContent) + 1;
    partidasDisplay.textContent = parseInt(partidasDisplay.textContent) + 1;
  });

  socket.on("derrota", () => {
    alert("💀 Fuiste vencido...");
    // Sumamos 1 partida a mano en la UI
    partidasDisplay.textContent = parseInt(partidasDisplay.textContent) + 1;
  });

  // Botón "GANAR RESPETO" emite "buscarCombate"
  const ganarBtn = document.getElementById("ganarRespetoBtn");
  ganarBtn.addEventListener("click", () => {
    console.log("Buscando combate...");
    socket.emit("buscarCombate");
  });

  // Cuando el usuario quiera "tapar" (golpear), podrías hacer:
  // socket.emit("tap");
  // Por ahora, hazlo manual, o como gustes integrarlo.
}

/************************************************************/
/*   3) Guardar nombre en MongoDB (endpoint /api/cambiar-nombre) */
/************************************************************/
document.getElementById("guardarNombre").addEventListener("click", async () => {
  const nuevoNombre = document.getElementById("nombreInput").value;

  if (!nuevoNombre) {
    console.log("No se ingresó nombre");
    return;
  }

  if (!playerId) {
    console.log("No existe playerId en localStorage");
    return;
  }

  try {
    const res = await fetch("/api/cambiar-nombre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: playerId, nombre: nuevoNombre })
    });

    if (!res.ok) {
      const msg = await res.text();
      console.error("Error al cambiar nombre:", msg);
    } else {
      console.log("Nombre actualizado con éxito!");
      document.getElementById("nombre").textContent = nuevoNombre;
      document.getElementById("nombreInput").value = "";
    }
  } catch (error) {
    console.error("Error en la solicitud:", error);
  }
});

/************************************************************/
/*   4) Ranking global                                       */
/************************************************************/
async function cargarRanking() {
  try {
    const res = await fetch("/api/ranking");
    const ranking = await res.json();

    const lista = document.getElementById("ranking");
    lista.innerHTML = "";
    ranking.forEach((jugador, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${jugador.nombre} (${jugador.respeto} Respeto)`;
      lista.appendChild(li);
    });
  } catch (err) {
    console.error("Error cargando ranking:", err);
  }
}

// Cargar ranking al iniciar
cargarRanking();
