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

let contadorToques = 0;
let tiempoRestante = 5;
let temporizador;
let juegoActivo = false;

// Mostrar el botón de volver desde el inicio
volverBtn.style.display = "inline-block";

// Apenas entrar, emitimos 'buscarCombate'
socket.emit("buscarCombate");

// Esperando rival
socket.on("esperandoRival", () => {
    estadoCombateEl.textContent = "Esperando rival...";
    golpearBtn.style.display = "none";
    reiniciarJuego();
});

// Emparejados => 'startGame'
socket.on("startGame", () => {
    estadoCombateEl.textContent = "¡Pelea iniciada! Toca el botón lo más rápido que puedas por 5 segundos.";
    golpearBtn.style.display = "inline-block";
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

// Botón volver
volverBtn.addEventListener("click", () => {
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