const socket = io();

const statusEl = document.getElementById("status");
const tapBtn = document.getElementById("tapBtn");
const scoreEl = document.getElementById("score");

let score = 0;
let opponentScore = 0;
let gameId = null;

socket.on("waiting", (msg) => {
  statusEl.textContent = msg;
});

socket.on("game-start", (data) => {
  gameId = data.gameId;
  score = 0;
  opponentScore = 0;
  statusEl.textContent = "¡Encontraste rival! A tocar se ha dicho.";
  tapBtn.style.display = "inline-block";
  scoreEl.textContent = "Tu respeto: 0 | Rival: 0";

  // Juego dura 10 segundos
  setTimeout(() => {
    tapBtn.style.display = "none";
    let result = "";

    if (score > opponentScore) result = "¡Ganaste respeto del barrio!";
    else if (score < opponentScore) result = "Te pasó el bondi... perdiste.";
    else result = "Empate, nos vimos en la esquina.";

    statusEl.textContent = result;

    socket.emit("game-over", { score, opponentScore });
  }, 10000);
});

tapBtn.addEventListener("click", () => {
  score++;
  scoreEl.textContent = `Tu respeto: ${score} | Rival: ${opponentScore}`;
  socket.emit("action", { score });
});

socket.on("opponent-action", (data) => {
  opponentScore = data.score;
  scoreEl.textContent = `Tu respeto: ${score} | Rival: ${opponentScore}`;
});

socket.on("game-over", (data) => {
  if (!tapBtn.disabled) {
    tapBtn.style.display = "none";
    statusEl.textContent = "Partida terminada.";
    scoreEl.textContent = `Tu respeto: ${score} | Rival: ${opponentScore}`;
  }
});
