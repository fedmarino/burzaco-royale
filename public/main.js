/************************************************************/
/*  1) Variables globales y estado                          */
/************************************************************/
let playerId = localStorage.getItem("playerId");
let isLoggedIn = false;

/************************************************************/
/*  2) Funciones de UI                                      */
/************************************************************/
function mostrarLogin() {
    const seccionLogin = document.getElementById("seccionLogin");
    const seccionNombre = document.getElementById("seccionNombre");
    const estadisticas = document.getElementById("estadisticas");
    const ganarRespetoBtn = document.getElementById("ganarRespetoBtn");

    if (seccionLogin) seccionLogin.style.display = "block";
    if (seccionNombre) seccionNombre.style.display = "none";
    if (estadisticas) estadisticas.style.display = "none";
    if (ganarRespetoBtn) ganarRespetoBtn.style.display = "none";
}

function mostrarJuego() {
    const seccionLogin = document.getElementById("seccionLogin");
    const seccionNombre = document.getElementById("seccionNombre");
    const estadisticas = document.getElementById("estadisticas");
    const ganarRespetoBtn = document.getElementById("ganarRespetoBtn");

    if (seccionLogin) seccionLogin.style.display = "none";
    if (seccionNombre) seccionNombre.style.display = "block";
    if (estadisticas) estadisticas.style.display = "block";
    if (ganarRespetoBtn) ganarRespetoBtn.style.display = "inline-block";
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
        console.log("[Main] Intentando login con:", nombre);
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombre, password })
        });

        const data = await res.json();
        console.log("[Main] Respuesta del servidor:", data);

        if (!res.ok) {
            console.error("[Main] Error en login:", data);
            alert(data.error || "Error al intentar login");
            return;
        }

        if (!data.userId) {
            console.error("[Main] No se recibió userId en la respuesta");
            alert("Error: No se recibió el ID del usuario");
            return;
        }

        playerId = data.userId;
        localStorage.setItem("playerId", playerId);
        localStorage.setItem("lastUsername", nombre);
        isLoggedIn = true;

        // Actualizar UI
        const nombreElement = document.getElementById("nombre");
        const respetoElement = document.getElementById("respeto");
        const partidasElement = document.getElementById("partidas");
        const rankingElement = document.getElementById("ranking");

        if (nombreElement) nombreElement.textContent = data.nombre;
        if (respetoElement) respetoElement.textContent = data.respeto;
        if (partidasElement) partidasElement.textContent = data.partidas;
        if (rankingElement) rankingElement.textContent = data.ranking > 0 ? `#${data.ranking}` : "";

        console.log("[Main] Login exitoso, mostrando juego");
        mostrarJuego();
        inicializarSocket();
    } catch (error) {
        console.error("[Main] Error en login:", error);
        alert("Error al intentar login. Por favor intenta nuevamente.");
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
    console.log("[Main] No hay playerId en localStorage, mostrando login");
    mostrarLogin();
} else {
    console.log("[Main] PlayerId encontrado en localStorage:", playerId);
    // Intentar login automático
    const nombre = localStorage.getItem("lastUsername");
    if (nombre) {
        console.log("[Main] Intentando login automático con nombre:", nombre);
        document.getElementById("loginNombre").value = nombre;
        document.getElementById("loginBtn").click();
    } else {
        console.log("[Main] No hay nombre guardado, intentando login con ID");
        // Si no hay nombre guardado pero sí playerId, intentar login con el ID
        fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: playerId })
            })
            .then(res => {
                if (!res.ok) {
                    console.log("[Main] Error en login automático, mostrando login");
                    localStorage.removeItem("playerId"); // Limpiar playerId inválido
                    mostrarLogin();
                    return;
                }
                return res.json();
            })
            .then(data => {
                if (!data) return; // Si no hay data, ya se mostró el login

                playerId = data.userId;
                isLoggedIn = true;
                localStorage.setItem("lastUsername", data.nombre);

                // Actualizar UI
                const nombreElement = document.getElementById("nombre");
                const respetoElement = document.getElementById("respeto");
                const partidasElement = document.getElementById("partidas");
                const rankingElement = document.getElementById("ranking");

                if (nombreElement) nombreElement.textContent = data.nombre;
                if (respetoElement) respetoElement.textContent = data.respeto;
                if (partidasElement) partidasElement.textContent = data.partidas;
                if (rankingElement) rankingElement.textContent = data.ranking > 0 ? `#${data.ranking}` : "";

                mostrarJuego();
                inicializarSocket();
                cargarRanking();
            })
            .catch(error => {
                console.error("[Main] Error en login automático:", error);
                localStorage.removeItem("playerId"); // Limpiar playerId inválido
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
        console.log("[Main] Actualizando puntaje:", data);
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
        console.log("[Main] Cargando ranking...");
        const res = await fetch("/api/ranking");
        if (!res.ok) {
            console.error("[Main] Error en la respuesta del ranking:", res.status);
            return;
        }
        const ranking = await res.json();
        console.log("[Main] Ranking recibido:", ranking);

        const lista = document.getElementById("rankingLista");
        if (!lista) {
            console.error("[Main] No se encontró el elemento rankingLista en el DOM");
            return;
        }

        lista.innerHTML = "";
        ranking.forEach((jugador, i) => {
            const li = document.createElement("li");
            li.textContent = `${i + 1}. ${jugador.nombre} (${jugador.respeto} Respeto)`;
            lista.appendChild(li);
        });
        console.log("[Main] Ranking actualizado en el DOM");
    } catch (err) {
        console.error("[Main] Error cargando ranking:", err);
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