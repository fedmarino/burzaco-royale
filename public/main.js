let playerId = localStorage.getItem("playerId");

async function crearJugador() {
  const res = await fetch("/create-player");
  const data = await res.json();
  playerId = data.id;
  localStorage.setItem("playerId", playerId);
}

if (!playerId) {
  crearJugador().then(() => inicializarSocket());
} else {
  console.log("Jugador reconocido:", playerId);
  inicializarSocket();
}

function inicializarSocket() {
  const socket = io({
    query: { playerId }
  });

  const tapBtn = document.getElementById("tapBtn");
  const respetoDisplay = document.getElementById("respeto");
  const partidasDisplay = document.getElementById("partidas");

  socket.on("bienvenida", (data) => {
    console.log("👋 Bienvenido de nuevo!");
    respetoDisplay.textContent = data.respeto;
    partidasDisplay.textContent = data.partidas;
    mostrarNombre(data.nombre);
  });

  socket.on("startGame", () => {
    tapBtn.disabled = false;
  });

  tapBtn.addEventListener("click", () => {
    socket.emit("tap");
    tapBtn.disabled = true;
  });

  socket.on("victoria", () => {
    alert("🔥 ¡Ganaste respeto!");
    respetoDisplay.textContent = parseInt(respetoDisplay.textContent) + 1;
    partidasDisplay.textContent = parseInt(partidasDisplay.textContent) + 1;
  });

  socket.on("derrota", () => {
    alert("💀 Fuiste vencido...");
