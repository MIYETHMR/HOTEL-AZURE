# Hotel Booking System - Full Stack

Este proyecto es una aplicación web integral (Full Stack) de reservas hoteleras, diseñada para operar en red local de forma dinámica. Cuenta con autenticación de usuarios, pasarela de pago simulada, gestión de base de datos relacional y un panel administrativo para cada perfil de huésped.

## Arquitectura General
El proyecto ha sido desacoplado para operar mediante dos micro-entornos comunicados a través de peticiones HTTP:
- **Frontend (Cliente)**: SPA enriquecida con múltiples vistas, construida con HTML5, CSS3, y Vanilla JavaScript.
- **Backend (Servidor API)**: Construido en Node.js utilizando Express.js (Corre inherentemente en el puerto `3001`).
- **Base de Datos**: Motor SQLite embebido, contenido en el archivo `hotel.db`.

## Estructura de Directorios
```text
/hotel_landing_page
  ├── README.md                # Documentación del Proyecto
  │
  ├── /frontend/               # Interfaz de Usuario
  │   ├── index.html           # Landing page principal y buscador de fechas
  │   ├── login.html           # Formulario de inicio de sesión
  │   ├── register.html        # Creación de cuenta y perfil iterativo
  │   ├── checkout.html        # Pasarela de pagos enriquecida (2 Col) con selectores (Efectivo/Tarjeta/Bancos)
  │   ├── dashboard.html       # Panel de control del huésped para leer, editar y cancelar
  │   ├── script.js            # Lógica central del catálogo (Home)
  │   ├── style.css            # Sistema de estilos globales (UI Premium)
  │   └── /imgs/               # Fotografías de alta resolución almacenadas localmente
  │
  └── /backend/                # Lógica de Negocio y Data
      ├── server.js            # Servidor API Express + Queries de Base de datos
      ├── package.json         # Dependencias (express, cors, sqlite3)
      └── hotel.db             # Base de datos relacional (Autogenerada al arrancar)
```

## Base de Datos (Diseño Entidad-Relación)
El backend utiliza las siguientes 3 tablas transaccionales:

1. **`usuarios`**
   - `id`: INTEGER (PK, Autoincremental)
   - `nombre`: TEXT
   - `email`: TEXT (UNIQUE Constraint)
   - `password`: TEXT
2. **`habitaciones`** (Inventario poblado al arrancar por primera vez)
   - `id`: INTEGER (PK)
   - `tipo`: TEXT
   - `desc`: TEXT
   - `precio`: INTEGER (Valor numérico base por noche)
   - `img`: TEXT (Referencia visual)
3. **`reservas`** (Tabla Transaccional principal)
   - `id`: INTEGER (PK)
   - `usuario_id`: INTEGER (Foreign Key -> usuarios.id)
   - `habitacion_id`: INTEGER (Foreign Key -> habitaciones.id)
   - `fecha_entrada`: TEXT (YYYY-MM-DD)
   - `fecha_salida`: TEXT (YYYY-MM-DD)

## Colección de Endpoints de la API (`:3001`)

### 🔐 Autenticación
- `POST /api/register` | Body: `{nombre, email, password}` | Registra permanentemente.
- `POST /api/login` | Body: `{email, password}` | Valida identidad y estampa sesión.

### 🏨 Habitaciones (Consultas)
- `GET /api/habitaciones-disponibles`
  - *Query Params*: `?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD`
  - *Lógica*: Filtra usando sub-queries SQL para excluir las habitaciones en uso estricto temporal.
- `GET /api/habitaciones/:id`
  - Devuelve toda la data singular de una alcoba (Nutre la interfaz visual del Checkout).

### 🛒 Reservas (CRUD Completo)
- `POST /api/reservas` | Crea el comprobante definitivo al "Pagar" satisfactoriamente.
- `GET /api/reservas/usuario/:id` | Recupera el historial dinámico vinculado a ese huésped *(Dashboard)*.
- `PUT /api/reservas/:id` | Permite actualizar `checkIn` y `checkOut`. El backend verifica que en esas nuevas fechas haya lugar antes de aceptar la mutación.
- `DELETE /api/reservas/:id` | Destruye el registro revocando la reserva.

## Instalación e Instrucciones de Uso

### Paso 1: Encender el Servidor API
Abre una terminal de comandos posicionada en la carpeta de tu servidor `/backend`.
```bash
# Solo ejecutar 'npm install' si el proyecto es clónico virgen
npm install
# Iniciar motor Node
node server.js
```
*Debe salir:* `BD Conectada.` y `Servidor corriendo en el puerto 3001`.

### Paso 2: Ejecutar la Interfaz Gráfica
Abre otra pestaña de terminal alojada en la raíz de la carpeta `/frontend`. Necesitas despacharlo usando un servidor web liviano para aprovechar la estructura de red:
```bash
npx serve
```
*(Alternativa manual: Clic derecho a index.html > Open With Live Server)*

### Anotaciones Multi-Dispositivo (Smart Fetching)
Los archivos frontend han sido diseñados con el atajo ``http://${window.location.hostname}:3001``. 
Si navegas en el proyecto a través del celular usando la IPv4 local de tu PC base (ej. `http://192.168.1.15:5500`), el script inteligente redirigirá cada petición AJAX apuntando de regreso al host de donde provino la página, ignorando el *localhost*, previniendo caídas.
