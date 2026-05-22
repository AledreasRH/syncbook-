/* shared.js - Funciones globales y validación */

// 1. Inicializar Navbar (Evita el error de función no definida)
function initNavbar(page) {
  // Puedes dejar esto vacío si no tienes lógica de navbar compleja
}

// 2. Utilidades de fecha y alertas
function fechaHoy() {
  return new Date().toISOString().split('T')[0];
}

function formatearFecha(f) {
  return new Date(f + 'T00:00:00').toLocaleDateString('es-ES', { day:'numeric', month:'long' });
}

function showToast(msg, type) {
  alert(msg); // Usamos alert para tu presentación, es lo más seguro ahora
}

// 3. VALIDACIÓN GLOBAL: Bloquea letras, números o caracteres de teléfono según el atributo 'data-tipo'
document.addEventListener('input', (e) => {
  const tipo = e.target.dataset.tipo;
  if (!tipo) return;

  if (tipo === 'letras') {
    e.target.value = e.target.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
  }
  if (tipo === 'numeros') {
    e.target.value = e.target.value.replace(/[^0-9]/g, '');
  }
  if (tipo === 'telefono') {
    e.target.value = e.target.value.replace(/[^0-9+\s()\-]/g, '');
  }
});