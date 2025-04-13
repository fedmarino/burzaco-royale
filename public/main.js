let userId = localStorage.getItem("userId");
if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

const socket = io({
  query: { userId }
});

const tapBtn = document.getElementById("tapBtn");
const respetoDisplay = document.getElementById("respeto");
const partidasDisplay = document.getElementById("partidas");

socket.on("bienvenida", (data) => {
  console.log("👋 Bienvenido de nuevo!");
  respetoDisplay.textContent = data.respeto;
  partidasDisplay.textContent = data.partidas;
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
  partidasDisplay.textContent = parseInt(partidasDisplay.textContent) + 1;
});

// Cargar nombre y mostrar
document.getElementById("guardarNombre").addEventListener("click", async () => {
    const nuevoNombre = document.getElementById("nombreInput").value;
    if (!nuevoNombre) return;
  
    await fetch("/api/cambiar-nombre", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, nombre: nuevoNombre })
    });
  
    document.getElementById("nombre").textContent = nuevoNombre;
    document.getElementById("nombreInput").value = "";
  });
  
  // Mostrar ranking
  async function cargarRanking() {
    const res = await fetch("/api/ranking");
    const ranking = await res.json();
  
    const lista = document.getElementById("ranking");
    lista.innerHTML = "";
    ranking.forEach((jugador, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${jugador.nombre} (${jugador.respeto} Respeto)`;
      lista.appendChild(li);
    });
  }
  
  cargarRanking();
  