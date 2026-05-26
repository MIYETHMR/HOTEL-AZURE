require('dotenv').config();

const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const bcrypt = require('bcrypt');

const app = express();

app.use(cors());
app.use(express.json());

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    port: 1433,

    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};

const poolPromise = sql.connect(config)
    .then(pool => {

        console.log("Conectado a Azure SQL");

        return pool;

    })
    .catch(err => {

        console.error("Error conectando a Azure SQL:", err);
        throw err;

    });

app.get('/habitaciones', async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .query(`
                SELECT * FROM habitaciones
            `);

    } catch(error) {

        res.status(500).json({
            error: error.message
        });

    }

});


// --- AUTENTICACIÓN ---
app.post('/api/register', async (req, res) => {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
        return res.status(400).json({ error: 'Faltan datos' });
    }

    try {

        const pool = await poolPromise;

        // 🔐 ENCRIPTAR CONTRASEÑA
        const hashPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input('nombre', sql.VarChar, nombre)
            .input('email', sql.VarChar, email)
            .input('password', sql.VarChar, hashPassword)
            .query(`
                INSERT INTO usuarios (nombre, email, password)
                VALUES (@nombre, @email, @password)
            `);

        return res.json({
            success: true,
            user: { nombre, email }
        });

    } catch (error) {

        console.log(error);

        if (error.message?.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email ya registrado' });
        }

        return res.status(500).json({ error: error.message });
    }
});
// login
app.post('/api/login', async (req, res) => {

    const { email, password } = req.body;


    try {

        const pool = await sql.connect(config);

        const result = await pool.request()
            .input('email', sql.VarChar, email)
            .query(`
                SELECT id, nombre, email, password
                FROM usuarios
                WHERE email = @email
            `);

        const user = result.recordset[0];

        if (!user) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // 🔐 comparar contraseña
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        return res.json({
            success: true,
            user: {
                id: user.id,
                nombre: user.nombre,
                email: user.email
            }
        });

    } catch (error) {

        console.log(error);

        return res.status(500).json({
            error: error.message
        });

    }

});
//disponibilidad
app.get('/api/habitaciones-disponibles', async (req, res) => {

    const { checkIn, checkOut } = req.query;

    try {

        const pool = await poolPromise;

        // Si no hay fechas, devolver todas
        if (!checkIn || !checkOut) {

            const result = await pool.request()
                .query(`
                    SELECT * FROM habitaciones
                `);

            return res.json(result.recordset);

        }

        // Convertir fechas
        const fechaEntrada = new Date(checkIn);
        const fechaSalida = new Date(checkOut);

        // Validar fechas
        if (fechaSalida <= fechaEntrada) {

            return res.status(400).json({
                error: 'Fechas inválidas'
            });

        }

        // Filtrar habitaciones disponibles
        const result = await pool.request()
            .input('fechaSalida', sql.Date, fechaSalida)
            .input('fechaEntrada', sql.Date, fechaEntrada)
            .query(`
                SELECT *
                FROM habitaciones
                WHERE id NOT IN (
                    SELECT habitacion_id
                    FROM reservas
                    WHERE fecha_entrada < @fechaSalida
                    AND fecha_salida > @fechaEntrada
                )
            `);

        res.json(result.recordset);

    } catch(error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});

app.get('/api/habitaciones/:id', async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                SELECT *
                FROM habitaciones
                WHERE id = @id
            `);

        const hab = result.recordset[0];

        if (!hab) {

            return res.status(404).json({
                error: 'No encontrada'
            });

        }

        res.json(hab);

    } catch(error) {

        res.status(500).json({
            error: error.message
        });

    }

});


// --- RESERVAS ---
// Crear

app.post('/api/reservas', async (req, res) => {

    const { usuario_id, habitacion_id, checkIn, checkOut } = req.body;

    try {

        const pool = await poolPromise;

        // Validar datos
        if (!usuario_id || !habitacion_id || !checkIn || !checkOut) {

            return res.status(400).json({
                error: 'Faltan datos'
            });

        }

        // Validar fechas
        const fechaEntrada = new Date(checkIn);
        const fechaSalida = new Date(checkOut);

        if (fechaSalida <= fechaEntrada) {

            return res.status(400).json({
                error: 'Fechas inválidas'
            });

        }

        // Verificar disponibilidad
        const checkResult = await pool.request()
            .input('habitacion_id', sql.Int, habitacion_id)
            .input('checkIn', sql.Date, fechaEntrada)
            .input('checkOut', sql.Date, fechaSalida)
            .query(`
                SELECT id
                FROM reservas
                WHERE habitacion_id = @habitacion_id
                AND fecha_entrada < @checkOut
                AND fecha_salida > @checkIn
            `);

        if (checkResult.recordset.length > 0) {

            return res.status(400).json({
                error: 'La habitación ya no está disponible en esas fechas'
            });

        }

        // Crear reserva
        await pool.request()
            .input('usuario_id', sql.Int, usuario_id)
            .input('habitacion_id', sql.Int, habitacion_id)
            .input('fechaEntrada', sql.Date, fechaEntrada)
            .input('fechaSalida', sql.Date, fechaSalida)
            .query(`
                INSERT INTO reservas (
                    usuario_id,
                    habitacion_id,
                    fecha_entrada,
                    fecha_salida
                )
                VALUES (
                    @usuario_id,
                    @habitacion_id,
                    @fechaEntrada,
                    @fechaSalida
                )
            `);

        res.json({
            success: true
        });

    } catch(error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});

// Leer por usuario
// Leer reservas por usuario
app.get('/api/reservas/usuario/:id', async (req, res) => {

    try {

        const pool = await poolPromise;

        const result = await pool.request()
            .input('usuario_id', sql.Int, req.params.id)
            .query(`
                SELECT
                    r.id,
                    r.habitacion_id,
                    r.fecha_entrada,
                    r.fecha_salida,
                    h.tipo,
                    h.precio,
                    h.img
                FROM reservas r
                JOIN habitaciones h
                    ON r.habitacion_id = h.id
                WHERE r.usuario_id = @usuario_id
                ORDER BY r.fecha_entrada ASC
            `);

        res.json(result.recordset);

    } catch(error) {

        res.status(500).json({
            error: error.message
        });

    }

});

// Actualizar reserva
app.put('/api/reservas/:id', async (req, res) => {

    const reservaId = req.params.id;

    const { checkIn, checkOut, habitacion_id } = req.body;

    try {

        const pool = await poolPromise;

        // Validar datos
        if (!checkIn || !checkOut || !habitacion_id) {

            return res.status(400).json({
                error: 'Faltan datos'
            });

        }

        // Convertir fechas
        const fechaEntrada = new Date(checkIn);
        const fechaSalida = new Date(checkOut);

        // Validar fechas
        if (fechaSalida <= fechaEntrada) {

            return res.status(400).json({
                error: 'Fechas inválidas'
            });

        }

        // Verificar cruce de fechas
        const checkResult = await pool.request()
            .input('habitacion_id', sql.Int, habitacion_id)
            .input('reservaId', sql.Int, reservaId)
            .input('checkIn', sql.Date, fechaEntrada)
            .input('checkOut', sql.Date, fechaSalida)
            .query(`
                SELECT id
                FROM reservas
                WHERE habitacion_id = @habitacion_id
                AND id != @reservaId
                AND fecha_entrada < @checkOut
                AND fecha_salida > @checkIn
            `);

        if (checkResult.recordset.length > 0) {

            return res.status(400).json({
                error: 'Las fechas seleccionadas se cruzan con otra reserva'
            });

        }

        // Actualizar reserva
        await pool.request()
            .input('reservaId', sql.Int, reservaId)
            .input('checkIn', sql.Date, fechaEntrada)
            .input('checkOut', sql.Date, fechaSalida)
            .query(`
                UPDATE reservas
                SET
                    fecha_entrada = @checkIn,
                    fecha_salida = @checkOut
                WHERE id = @reservaId
            `);

        res.json({
            success: true
        });

    } catch(error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});

// Eliminar reserva
app.delete('/api/reservas/:id', async (req, res) => {

    try {

        const pool = await poolPromise;

        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`
                DELETE FROM reservas
                WHERE id = @id
            `);

        res.json({
            success: true
        });

    } catch(error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});


// Iniciar servidor
poolPromise.then(() => {

    app.listen(3000, () => {

        console.log("Servidor ejecutándose en puerto 3000");

    });

});