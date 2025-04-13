let playerId = localStorage.getItem("playerId");
if (!playerId) {
  window.location.href = "index.html";
}

const socket = io({ query: { playerId } });

const estadoCombateEl = document.getElementById("estadoCombate");
const golpearBtn = document.getElementById("golpearBtn");
const volverBtn = document.getElementById("volverBtn");

// Apenas entrar, emitimos 'buscarCombate'
socket.emit("buscarCombate");

// Esperando rival
socket.on("esperandoRival", () => {
  estadoCombateEl.textContent = "Esperando rival...";
});

// Emparejados => 'startGame'
socket.on("startGame", () => {
  estadoCombateEl.textContent = "¡Pelea iniciada! Sé el primero en golpear.";
  golpearBtn.style.display = "inline-block";
});

// Al golpear
golpearBtn.addEventListener("click", () => {
  socket.emit("tap");
  golpearBtn.style.display = "none";
});

// Victoria/derrota
socket.on("victoria", () => {
  estadoCombateEl.textContent = "🔥 ¡Ganaste! Respeto actualizado.";
  volverBtn.style.display = "inline-block";
});

socket.on("derrota", () => {
  estadoCombateEl.textContent = "💀 ¡Fuiste vencido...!";
  volverBtn.style.display = "inline-block";
});

// Botón volver
volverBtn.addEventListener("click", () => {
  window.location.href = "index.html";
});
