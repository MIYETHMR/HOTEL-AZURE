const container = document.getElementById('rooms-container');
const btnSearch = document.getElementById('btn-search');
const checkInInput = document.getElementById('check-in');
const checkOutInput = document.getElementById('check-out');
const authLinks = document.getElementById('auth-links');
// Para datetime-local necesitamos el formato YYYY-MM-DDTHH:MM
const now = new Date();
now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
const hoy = now.toISOString().slice(0, 16);
checkInInput.min = hoy;
checkOutInput.min = hoy;

// Auth UI (Navbar)
const user = JSON.parse(localStorage.getItem('user'));
if (authLinks && user) {
    authLinks.innerHTML = `
        <a href="dashboard.html" style="color: var(--accent-color); font-weight:bold;">Tus Reservas (${user.nombre})</a>
        <a href="#" onclick="logout()" class="btn-outline" style="color:#000; border-color:#000; padding: 6px 15px;">Salir</a>
    `;
} else if (authLinks) {
    authLinks.innerHTML = `
        <a href="login.html">Login</a>
        <a href="register.html" class="btn-primary" style="padding: 6px 15px;">Registro</a>
    `;
}

// Función global en caso de ser inyectada al DOM
window.logout = function () {
    localStorage.removeItem('user');
    window.location.reload();
};

async function loadRooms(checkIn = '', checkOut = '') {
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1 / -1;">Cargando habitaciones...</p>';

    try {
        let url = `http://${window.location.hostname}:3001/api/habitaciones-disponibles`;
        if (checkIn && checkOut) {
            url += `?checkIn=${checkIn}&checkOut=${checkOut}`;
        }

        const res = await fetch(url);
        const rooms = await res.json();

        renderRooms(rooms, checkIn, checkOut);
    } catch (e) {
        container.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1 / -1; color: red;">Error conectando a BD local. Asegúrate de encender el Backend.</p>';
    }
}

function renderRooms(rooms, checkIn = '', checkOut = '') {
    container.innerHTML = '';
    if (rooms.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%; grid-column: 1 / -1;">No hay habitaciones disponibles en estas fechas.</p>';
        return;
    }

    rooms.forEach(room => {
        const precioHora = Math.round(room.precio / 24);
        const roomCard = `
            <div class="room-card">
                <img id="img-room${room.id}" src="${room.img}" alt="${room.tipo}">
                <div class="room-info">
                    <h3>${room.tipo}</h3>
                    <p class="room-desc">${room.desc}</p>
                    <p class="room-details" style="font-size: 0.9em; color: #555; margin-bottom: 10px;">
                        <i class="fas fa-bed"></i> Camas Cómodas | <i class="fas fa-wifi"></i> Wifi | <i class="fas fa-tv"></i> TV
                    </p>
                    <div class="room-footer">
                        <span class="price">$${precioHora.toLocaleString()} <span>/ hora</span></span>
                        <button class="btn-dark btn-sm" onclick="bookRoom(${room.id}, '${checkIn}', '${checkOut}')">Reservar</button>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += roomCard;
    });
}

// La función mostrarMensaje ha sido movida a config.js para la marca blanca
// Lógica redirigida a Login si no está authenticado
window.bookRoom = function (roomId, checkIn, checkOut) {
    if (!checkIn || !checkOut) {
        mostrarMensaje('Para reservar, primero debes seleccionar tus fechas en el buscador de la página principal.', 'info');
        document.querySelector('.booking-bar').scrollIntoView({ behavior: 'smooth' });
        return;
    }

    // Guardar intención para retomarla después de pagar o loguearse
    localStorage.setItem('pendingBooking', JSON.stringify({
        habitacion_id: roomId, checkIn, checkOut
    }));

    if (!user) {
        mostrarMensaje('Para realizar una reserva debes tener cuenta. ¡Serás redirigido al registro!', 'info');
        window.location.href = 'register.html';
    } else {
        window.location.href = 'checkout.html';
    }
};

if (btnSearch) {
    btnSearch.addEventListener('click', () => {
        const checkIn = checkInInput.value;
        const checkOut = checkOutInput.value;

        if (!checkIn || !checkOut) {
            mostrarMensaje("Por favor selecciona las fechas de entrada y salida.", 'error');
            return;
        }

        if (new Date(checkOut) <= new Date(checkIn)) {
            mostrarMensaje('La fecha de salida debe ser posterior a la de entrada.', 'error');
            return;
        }

        loadRooms(checkIn, checkOut);
    });
}

// Carga inicial
loadRooms();
