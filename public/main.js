/************************************************************/
/*  1) Crear jugador si no existe (y guardar en local)      */
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
/*  2) Inicializar Socket.io (para ver respeto, partidas)   */
/************************************************************/
function inicializarSocket() {
  const socket = io({
    query: { playerId }
  });

  const respetoDisplay = document.getElementById("respeto");
  const partidasDisplay = document.getElementById("partidas");

  socket.on("bienvenida", (data) => {
    console.log("👋 Bienvenido de nuevo!");
    respetoDisplay.textContent = data.respeto;
    partidasDisplay.textContent = data.partidas;
    document.getElementById("nombre").textContent = data.nombre || "Anónimo";
  });
}

/************************************************************/
/*  3) Cambiar nombre (POST a /api/cambiar-nombre)          */
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
/*  4) Ranking global                                       */
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
cargarRanking();

/************************************************************/
/*  5) Botón "GANAR RESPETO" => se va a combate.html         */
/************************************************************/
document.getElementById("ganarRespetoBtn").addEventListener("click", () => {
  // Redirigimos a la pantalla de combate
  window.location.href = "combate.html";
});
/************************************************************/