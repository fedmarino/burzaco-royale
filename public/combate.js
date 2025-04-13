// Recuperar playerId
let playerId = localStorage.getItem("playerId");
if (!playerId) {
  // Si no hay playerId, redirigimos al index
  window.location.href = "index.html";
}

// Conexión a Socket.io
const socket = io({
  query: { playerId }
});

const estadoCombateEl = document.getElementById("estadoCombate");
const golpearBtn = document.getElementById("golpearBtn");
const volverBtn = document.getElementById("volverBtn");

// Apenas carga la página, se emite “buscarCombate”
socket.emit("buscarCombate");

// Si no hay rival, el server manda “esperandoRival”
socket.on("esperandoRival", () => {
  estadoCombateEl.textContent = "Esperando rival...";
});

// Cuando hay un rival, nos mandan “startGame”
socket.on("startGame", () => {
  estadoCombateEl.textContent = "¡Pelea iniciada! Sé el primero en golpear.";
  golpearBtn.style.display = "inline-block";
});

// Al hacer clic en GOLPEAR, emitimos “tap” (un golpe)
golpearBtn.addEventListener("click", () => {
  console.log("Golpe lanzado!");
  socket.emit("tap");

  // Evitamos varios golpes
  golpearBtn.style.display = "none";
});

// Al ganar
socket.on("victoria", () => {
  estadoCombateEl.textContent = "🔥 ¡Ganaste! Respeto actualizado.";
  volverBtn.style.display = "inline-block";
});

// Al perder
socket.on("derrota", () => {
  estadoCombateEl.textContent = "💀 ¡Perdiste! Otro día será.";
  volverBtn.style.display = "inline-block";
});

// Botón para volver al inicio (index.html)
volverBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});

// Al cerrar el navegador, se desconecta el socket
window.addEventListener("beforeunload", () => {
  socket.disconnect();
});

/************************************************************/
