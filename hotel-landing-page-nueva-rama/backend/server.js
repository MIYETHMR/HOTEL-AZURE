const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // Necesario para parsear el body de POST/PUT

// 1. BASE DE DATOS
const db = new sqlite3.Database('./hotel.db', (err) => {
    if (err) console.error("Error conectando a BD:", err);
    else console.log("BD Conectada.");
});

// Inicializar Tablas
db.serialize(() => {
    // Tabla Usuarios
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);

    // Tabla Habitaciones
    db.run(`CREATE TABLE IF NOT EXISTS habitaciones (
        id INTEGER PRIMARY KEY,
        tipo TEXT,
        desc TEXT,
        precio INTEGER,
        img TEXT
    )`);

    // Tabla Reservas
    db.run(`CREATE TABLE IF NOT EXISTS reservas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER,
        habitacion_id INTEGER,
        fecha_entrada TEXT,
        fecha_salida TEXT,
        FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
        FOREIGN KEY(habitacion_id) REFERENCES habitaciones(id)
    )`);

    // Insertar Habitaciones Demo si no existen
    db.get("SELECT COUNT(*) AS count FROM habitaciones", (err, row) => {
        if (!err && row.count === 0) {
            const stmt = db.prepare("INSERT INTO habitaciones (id, tipo, desc, precio, img) VALUES (?, ?, ?, ?, ?)");
            stmt.run(1, 'Habitación Sencilla', 'Una cama, un baño, ideal para una persona.', 80000, './imgs/room_single.jpg');
            stmt.run(2, 'Habitación Doble', 'Dos camas, un baño, ideal para dos personas.', 120000, './imgs/room_double.jpg');
            stmt.run(3, 'Habitación Familiar', 'Ideal para familias y grupos de amigos.', 180000, './imgs/room_familiar.jpg');
            stmt.run(4, 'Suite Deluxe', 'Habitación para más de dos personas, sala y baño.', 250000, './imgs/room_suite.jpg');
            stmt.run(5, 'Suite Presidencial', 'Increible pent-house VIP con todos los lujos', 350000, './imgs/room_presidential.jpg');
            stmt.finalize();
        }
    });
});

// --- AUTENTICACIÓN ---
// Registro
app.post('/api/register', (req, res) => {
    const { nombre, email, password } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Faltan datos' });

    db.run("INSERT INTO usuarios (nombre, email, password) VALUES (?, ?, ?)", [nombre, email, password], function (err) {
        if (err) {
            if (err.message.includes("UNIQUE")) return res.status(400).json({ error: 'Email ya registrado' });
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, user: { id: this.lastID, nombre, email } });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT id, nombre, email FROM usuarios WHERE email = ? AND password = ?", [email, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
        res.json({ success: true, user });
    });
});

// --- HABITACIONES ---
// GET Habitaciones filtradas
app.get('/api/habitaciones-disponibles', (req, res) => {
    const { checkIn, checkOut } = req.query;

    if (!checkIn || !checkOut) {
        // Retorna todas si no hay filtro estricto
        db.all("SELECT * FROM habitaciones", [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
        return;
    }

    const sqlQuery = `
        SELECT * FROM habitaciones 
        WHERE id NOT IN (
            SELECT habitacion_id FROM reservas 
            WHERE fecha_entrada < ? AND fecha_salida > ?
        )
    `;
    db.all(sqlQuery, [checkOut, checkIn], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/habitaciones/:id', (req, res) => {
    db.get("SELECT * FROM habitaciones WHERE id = ?", [req.params.id], (err, hab) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!hab) return res.status(404).json({ error: 'No encontrada' });
        res.json(hab);
    });
});


// --- RESERVAS ---
// Crear
app.post('/api/reservas', (req, res) => {
    const { usuario_id, habitacion_id, checkIn, checkOut } = req.body;

    // Verificar disponibilidad (Doble check)
    const sqlCheck = `SELECT id FROM reservas WHERE habitacion_id = ? AND fecha_entrada < ? AND fecha_salida > ?`;
    db.get(sqlCheck, [habitacion_id, checkOut, checkIn], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: 'La habitación ya no está disponible en esas fechas' });

        db.run("INSERT INTO reservas (usuario_id, habitacion_id, fecha_entrada, fecha_salida) VALUES (?, ?, ?, ?)",
            [usuario_id, habitacion_id, checkIn, checkOut], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true, reserva_id: this.lastID });
            });
    });
});

// Leer por usuario
app.get('/api/reservas/usuario/:id', (req, res) => {
    const sql = `
        SELECT r.id, r.habitacion_id, r.fecha_entrada, r.fecha_salida, h.tipo, h.precio, h.img
        FROM reservas r
        JOIN habitaciones h ON r.habitacion_id = h.id
        WHERE r.usuario_id = ?
        ORDER BY r.fecha_entrada ASC
    `;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Actualizar (Fechas)
app.put('/api/reservas/:id', (req, res) => {
    const reservaId = req.params.id;
    const { checkIn, checkOut, habitacion_id } = req.body;

    const sqlCheck = `SELECT id FROM reservas WHERE habitacion_id = ? AND id != ? AND fecha_entrada < ? AND fecha_salida > ?`;
    db.get(sqlCheck, [habitacion_id, reservaId, checkOut, checkIn], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(400).json({ error: 'Las fechas seleccionadas se cruzan con otra reserva' });

        db.run("UPDATE reservas SET fecha_entrada = ?, fecha_salida = ? WHERE id = ?",
            [checkIn, checkOut, reservaId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ success: true });
            });
    });
});

// Eliminar
app.delete('/api/reservas/:id', (req, res) => {
    db.run("DELETE FROM reservas WHERE id = ?", [req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.listen(3001, () => {
    console.log('Servidor corriendo en el puerto 3001');
});
