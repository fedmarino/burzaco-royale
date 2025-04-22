let playerId = localStorage.getItem("playerId");
if (!playerId) {
    window.location.href = "index.html";
}

const socket = io({ query: { playerId } });

const estadoCombateEl = document.getElementById("estadoCombate");
const golpearBtn = document.getElementById("golpearBtn");
const volverBtn = document.getElementById("volverBtn");
const contadorToquesEl = document.getElementById("contadorToques");
const tiempoRestanteEl = document.getElementById("tiempoRestante");
const infoCombateEl = document.getElementById("infoCombate");

// Elementos de información de jugadores
const jugador1NombreEl = document.getElementById("jugador1Nombre");
const jugador1RespetoEl = document.getElementById("jugador1Respeto");
const jugador1RankingEl = document.getElementById("jugador1Ranking");
const jugador2NombreEl = document.getElementById("jugador2Nombre");
const jugador2RespetoEl = document.getElementById("jugador2Respeto");
const jugador2RankingEl = document.getElementById("jugador2Ranking");

let contadorToques = 0;
let tiempoRestante = 5;
let temporizador;
let juegoActivo = false;

// Cargar ranking inicial
cargarRanking();

// Actualizar ranking cada 30 segundos
setInterval(cargarRanking, 30000);

// Mostrar el botón de volver desde el inicio
volverBtn.style.display = "inline-block";

// Apenas entrar, emitimos 'buscarCombate'
socket.emit("buscarCombate");

// Esperando rival
socket.on("esperandoRival", () => {
    estadoCombateEl.textContent = "Esperando rival...";
    golpearBtn.style.display = "none";
    infoCombateEl.style.display = "none";
    reiniciarJuego();
});

// Emparejados => 'startGame'
socket.on("startGame", (data) => {
    estadoCombateEl.textContent = "¡Pelea iniciada! Toca el botón lo más rápido que puedas por 5 segundos.";
    golpearBtn.style.display = "inline-block";
    infoCombateEl.style.display = "flex";

    // Actualizar información de los jugadores
    jugador1NombreEl.textContent = data.jugador1.nombre;
    jugador1RespetoEl.textContent = data.jugador1.respeto;
    jugador1RankingEl.textContent = data.jugador1.ranking > 0 ? `#${data.jugador1.ranking}` : "#0";

    jugador2NombreEl.textContent = data.jugador2.nombre;
    jugador2RespetoEl.textContent = data.jugador2.respeto;
    jugador2RankingEl.textContent = data.jugador2.ranking > 0 ? `#${data.jugador2.ranking}` : "#0";

    iniciarJuego();
});

function iniciarJuego() {
    juegoActivo = true;
    contadorToques = 0;
    tiempoRestante = 5;
    actualizarContadores();

    temporizador = setInterval(() => {
        tiempoRestante--;
        tiempoRestanteEl.textContent = `Tiempo: ${tiempoRestante}`;

        if (tiempoRestante <= 0) {
            clearInterval(temporizador);
            juegoActivo = false;
            golpearBtn.style.display = "none";
            socket.emit("finJuego", contadorToques);
        }
    }, 1000);
}

function reiniciarJuego() {
    clearInterval(temporizador);
    juegoActivo = false;
    contadorToques = 0;
    tiempoRestante = 5;
    actualizarContadores();
}

function actualizarContadores() {
    contadorToquesEl.textContent = `Toques: ${contadorToques}`;
    tiempoRestanteEl.textContent = `Tiempo: ${tiempoRestante}`;
}

// Al golpear
golpearBtn.addEventListener("click", () => {
    if (juegoActivo) {
        contadorToques++;
        actualizarContadores();
    }
});

// Resultados
socket.on("victoria", () => {
    estadoCombateEl.textContent = "🔥 ¡Ganaste! Respeto actualizado.";
});

socket.on("derrota", () => {
    estadoCombateEl.textContent = "💀 ¡Fuiste vencido...!";
});

socket.on("empate", () => {
    estadoCombateEl.textContent = "🤝 ¡Empate! Nadie ganó respeto.";
});

// Botón volver
volverBtn.addEventListener("click", () => {
    console.log("[Combate] Guardando playerId antes de volver:", playerId);
    localStorage.setItem("playerId", playerId);
    socket.disconnect();
    window.location.href = "index.html";
});

// Manejar desconexión
socket.on("disconnect", () => {
    estadoCombateEl.textContent = "Desconectado del servidor. Volviendo al inicio...";
    setTimeout(() => {
        window.location.href = "index.html";
    }, 2000);
});

// Función para cargar el ranking
async function cargarRanking() {
    try {
        const res = await fetch("/api/ranking");
        const ranking = await res.json();

        const lista = document.getElementById("ranking");
        lista.innerHTML = "";
        ranking.forEach((jugador, i) => {
            const li = document.createElement("li");
            li.textContent = `${i + 1}. ${jugador.nombre} (${jugador.respeto} Respeto - ${jugador.partidas} Partidas)`;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error("Error cargando ranking:", err);
    }
}