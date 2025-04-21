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

        if (!res.ok) {
            const error = await res.json();
            alert(error.error);
            return;
        }

        const data = await res.json();
        playerId = data.userId;
        localStorage.setItem("playerId", playerId);
        isLoggedIn = true;

        // Actualizar UI
        document.getElementById("nombre").textContent = data.nombre;
        document.getElementById("respeto").textContent = data.respeto;
        document.getElementById("partidas").textContent = data.partidas;
        document.getElementById("ranking").textContent = data.ranking > 0 ? `#${data.ranking}` : "";

        mostrarJuego();
        inicializarSocket();
    } catch (error) {
        console.error("Error en login:", error);
        alert("Error al intentar login");
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
    // Intentar login automático
    const nombre = localStorage.getItem("lastUsername");
    if (nombre) {
        document.getElementById("loginNombre").value = nombre;
        document.getElementById("loginBtn").click();
    } else {
        // Si no hay nombre guardado pero sí playerId, intentar login con el ID
        fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: playerId })
            })
            .then(res => {
                if (!res.ok) throw new Error("Error en login automático");
                return res.json();
            })
            .then(data => {
                playerId = data.userId;
                isLoggedIn = true;
                localStorage.setItem("lastUsername", data.nombre);

                // Actualizar UI
                document.getElementById("nombre").textContent = data.nombre;
                document.getElementById("respeto").textContent = data.respeto;
                document.getElementById("partidas").textContent = data.partidas;
                document.getElementById("ranking").textContent = data.ranking > 0 ? `#${data.ranking}` : "";

                mostrarJuego();
                inicializarSocket();
            })
            .catch(() => {
                mostrarLogin();
            });
    }
}

/************************************************************/
/*  5) Socket.io y actualizaciones                          */
/************************************************************/
function inicializarSocket() {
    if (!isLoggedIn) return;

    const socket = io({
        query: { playerId }
    });

    const respetoDisplay = document.getElementById("respeto");
    const partidasDisplay = document.getElementById("partidas");
    const nombreDisplay = document.getElementById("nombre");
    const cambiarNombreDiv = document.getElementById("cambiarNombre");
    const editarNombreBtn = document.getElementById("editarNombre");

    socket.on("bienvenida", (data) => {
        console.log("👋 Bienvenido de nuevo!");
        respetoDisplay.textContent = data.respeto;
        partidasDisplay.textContent = data.partidas;

        if (data.nombre && data.nombre !== "Jugador misterioso") {
            nombreDisplay.textContent = data.nombre;
            editarNombreBtn.style.display = "inline-block";
        } else {
            cambiarNombreDiv.style.display = "block";
            editarNombreBtn.style.display = "none";
        }
    });

    socket.on("actualizarPuntaje", (data) => {
        respetoDisplay.textContent = data.respeto;
        partidasDisplay.textContent = data.partidas;
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

        if (!res.ok) {
            const error = await res.json();
            alert(error.error);
            return;
        }

        document.getElementById("nombre").textContent = nuevoNombre;
        document.getElementById("nombreInput").value = "";
        document.getElementById("passwordInput").value = "";
        document.getElementById("cambiarNombre").style.display = "none";
        document.getElementById("editarNombre").style.display = "inline-block";

        // Guardar nombre para login automático
        localStorage.setItem("lastUsername", nuevoNombre);
    } catch (error) {
        console.error("Error en la solicitud:", error);
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

// Cargar ranking inicial
cargarRanking();

// Actualizar ranking cada 30 segundos
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
/************************************************************/