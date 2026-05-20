// config.js - Archivo de Configuración Marca Blanca
const BrandConfig = {
    name: "Pon tu marca aca", // Nombre del hotel o marca
    phone: "+123 456 7890", // Teléfono de contacto
    email: "contacto@hotelexample.com", // Correo electrónico de contacto
    address: "Avenida Principal 123, Ciudad, País", // Dirección física
    heroTitle: "Tu Mejor Experiencia", // Título principal en la página de inicio
    heroSubtitle: "Confort, estilo y tranquilidad en un solo lugar", // Subtítulo en la página de inicio
    accentColor: "#e0b961" // Color de acento de la marca
};

function mostrarMensaje(mensaje, tipo = "error") {
    // Evitar duplicados
    if (document.getElementById("modal-mensaje")) return;

    const modal = document.createElement("div");
    modal.id = "modal-mensaje";

    let titulo = "Mensaje";
    let colorClass = "info";

    if (tipo === "error") {
        titulo = "Error";
        colorClass = "error";
    } else if (tipo === "exito") {
        titulo = "Éxito";
        colorClass = "exito";
    }

    modal.innerHTML = `
        <div class="overlay"></div>
        <div class="modal" style="display: block;">
            <span class="cerrar">&times;</span>
            <h2 class="${colorClass}">${titulo}</h2>
            <p>${mensaje}</p>
            <button class="btn ${colorClass}">Aceptar</button>
        </div>
    `;

    document.body.appendChild(modal);

    // Eventos
    modal.querySelector(".cerrar").onclick = cerrar;
    modal.querySelector(".btn").onclick = cerrar;
    modal.querySelector(".overlay").onclick = cerrar;

    function cerrar() {
        modal.remove();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Aplicar color de marca si se desea cambiar
    document.documentElement.style.setProperty('--accent-color', BrandConfig.accentColor);

    // Reemplazar textos estáticos por los de la configuración
    document.querySelectorAll('.brand-name').forEach(el => el.innerText = BrandConfig.name);
    document.querySelectorAll('.brand-phone').forEach(el => el.innerText = BrandConfig.phone);
    document.querySelectorAll('.brand-email').forEach(el => el.innerText = BrandConfig.email);
    document.querySelectorAll('.brand-address').forEach(el => el.innerText = BrandConfig.address);
    
    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.innerText = BrandConfig.heroTitle;
    
    const heroSubtitle = document.getElementById('hero-subtitle');
    if (heroSubtitle) heroSubtitle.innerText = BrandConfig.heroSubtitle;

    // Actualizar el título de la página web
    if(document.title.includes('Hotel')) {
        document.title = document.title.replace('Hotel', BrandConfig.name);
    } else {
        document.title = document.title + " - " + BrandConfig.name;
    }
});
