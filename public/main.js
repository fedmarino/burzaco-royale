// public/main.js

/************************************************************/
/*  1) Variables globales y estado                          */
/************************************************************/
let playerId = localStorage.getItem("playerId");
let isLoggedIn = false;

/************************************************************/
/*  2) Funciones de UI                                      */
/************************************************************/
function mostrarLogin() {
    document.getElementById("seccionLogin").style.display = "block";
    document.getElementById("seccionNombre").style.display = "none";
    document.getElementById("estadisticas").style.display = "none";
    document.getElementById("ganarRespetoBtn").style.display = "none";
}

function mostrarJuego() {
    document.getElementById("seccionLogin").style.display = "none";
    document.getElementById("seccionNombre").style.display = "block";
    document.getElementById("estadisticas").style.display = "block";
    document.getElementById("ganarRespetoBtn").style.display = "inline-block";
}

/************************************************************/
/*  3) Login/Logout                                         */
/************************************************************/
document.getElementById("loginBtn").addEventListener("click", async() => {
    const nombre = document.getElementById("loginNombre").value;
    const password = document.getElementById("loginPassword").value;

    if (!nombre || !password) {
        alert("Por favor ingresa nombre y contraseña");
        return;
    }

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, password })
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error || "Error al intentar login");
            return;
        }
        if (!data.userId) {
            alert("Error: No se recibió el ID del usuario");
            return;
        }

        playerId = data.userId;
        localStorage.setItem("playerId", playerId);
        localStorage.setItem("lastUsername", nombre);
        isLoggedIn = true;

        // Actualizar UI
        const nombreElement = document.getElementById("nombre");
        const respetoUsuarioElement = document.getElementById("respetoUsuario");
        const respetoStatsElement = document.getElementById("respetoStats");
        const partidasElement = document.getElementById("partidas");
        const rankingUsuarioElement = document.getElementById("rankingUsuario");

        if (nombreElement) nombreElement.textContent = data.nombre;
        if (respetoUsuarioElement) respetoUsuarioElement.textContent = data.respeto;
        if (respetoStatsElement) respetoStatsElement.textContent = data.respeto;
        if (partidasElement) partidasElement.textContent = data.partidas;
        if (rankingUsuarioElement) rankingUsuarioElement.textContent = data.ranking > 0 ?
            `#${data.ranking}` :
            "#0";

        mostrarJuego();
        inicializarSocket();
    } catch (error) {
        alert("Error al intentar login. Por favor intenta nuevamente.");
        console.error(error);
    }
});

document.getElementById("logoutBtn").addEventListener("click", () => {
    playerId = null;
    localStorage.removeItem("playerId");
    isLoggedIn = false;
    mostrarLogin();
});

/************************************************************/
/*  4) Inicialización                                       */
/************************************************************/
if (!playerId) {
    mostrarLogin();
} else {
    const nombreGuardado = localStorage.getItem("lastUsername");
    if (nombreGuardado) {
        document.getElementById("loginNombre").value = nombreGuardado;
        document.getElementById("loginBtn").click();
    } else {
        fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: playerId })
            })
            .then(res => {
                if (!res.ok) {
                    localStorage.removeItem("playerId");
                    mostrarLogin();
                    return;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return;
                playerId = data.userId;
                isLoggedIn = true;
                localStorage.setItem("lastUsername", data.nombre);

                // Actualizar UI igual que en login
                document.getElementById("nombre").textContent = data.nombre;
                document.getElementById("respetoUsuario").textContent = data.respeto;
                document.getElementById("respetoStats").textContent = data.respeto;
                document.getElementById("partidas").textContent = data.partidas;
                document.getElementById("rankingUsuario").textContent = data.ranking > 0 ?
                    `#${data.ranking}` :
                    "#0";

                mostrarJuego();
                inicializarSocket();
                cargarRanking();
            })
            .catch(err => {
                console.error(err);
                localStorage.removeItem("playerId");
                mostrarLogin();
            });
    }
}

/************************************************************/
/*  5) Socket.io y actualizaciones                          */
/************************************************************/
function inicializarSocket() {
    if (!isLoggedIn) return;

    const socket = io({ query: { playerId } });

    socket.on("bienvenida", (data) => {
        document.getElementById("respetoUsuario").textContent = data.respeto;
        document.getElementById("respetoStats").textContent = data.respeto;
        document.getElementById("partidas").textContent = data.partidas;

        if (data.nombre && data.nombre !== "Jugador misterioso") {
            document.getElementById("nombre").textContent = data.nombre;
            document.getElementById("editarNombre").style.display = "inline-block";
        } else {
            document.getElementById("cambiarNombre").style.display = "block";
            document.getElementById("editarNombre").style.display = "none";
        }
    });

    socket.on("actualizarPuntaje", (data) => {
        document.getElementById("respetoUsuario").textContent = data.respeto;
        document.getElementById("respetoStats").textContent = data.respeto;
        document.getElementById("partidas").textContent = data.partidas;
        cargarRanking();
    });
}

/************************************************************/
/*  6) Cambiar nombre                                       */
/************************************************************/
document.getElementById("guardarNombre").addEventListener("click", async() => {
    const nuevoNombre = document.getElementById("nombreInput").value;
    const password = document.getElementById("passwordInput").value;

    if (!nuevoNombre || !password) {
        alert("Por favor ingresa nombre y contraseña");
        return;
    }

    try {
        const res = await fetch("/api/cambiar-nombre", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: playerId, nombre: nuevoNombre, password })
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error);
            return;
        }

        document.getElementById("nombre").textContent = nuevoNombre;
        document.getElementById("nombreInput").value = "";
        document.getElementById("passwordInput").value = "";
        document.getElementById("cambiarNombre").style.display = "none";
        document.getElementById("editarNombre").style.display = "inline-block";
        localStorage.setItem("lastUsername", nuevoNombre);
    } catch (err) {
        console.error(err);
        alert("Error al cambiar nombre");
    }
});

document.getElementById("editarNombre").addEventListener("click", () => {
    document.getElementById("cambiarNombre").style.display = "block";
    document.getElementById("editarNombre").style.display = "none";
});

/************************************************************/
/*  7) Ranking                                              */
/************************************************************/
async function cargarRanking() {
    try {
        const res = await fetch("/api/ranking");
        const ranking = await res.json();
        const lista = document.getElementById("rankingLista");
        lista.innerHTML = "";
        ranking.forEach((jugador, i) => {
            const li = document.createElement("li");
            li.textContent = `${i+1}. ${jugador.nombre} (${jugador.respeto} Respeto)`;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error(err);
    }
}
cargarRanking();
setInterval(cargarRanking, 30000);

/************************************************************/
/*  8) Combate                                              */
/************************************************************/
document.getElementById("ganarRespetoBtn").addEventListener("click", () => {
    if (!isLoggedIn) {
        alert("Debes estar logueado para jugar");
        return;
    }
    window.location.href = "combate.html";
});