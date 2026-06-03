/* SyncBook · registro-negocio.js */
window.addEventListener('DOMContentLoaded', async () => {
  if (!window.sb) return;
  const { data: { session } } = await window.sb.auth.getSession();
  
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  // === BLOQUEO DE SEGURIDAD PARA CLIENTES ===
  const { data: usuario } = await window.sb.from('usuarios').select('rol').eq('id', session.user.id).single();
  
  if (usuario && usuario.rol === 'cliente') {
    const container = document.querySelector('.registro-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔒</div>
          <h2 style="font-size: 1.5rem; color: var(--gray-900); font-weight: 800; margin-bottom: 0.5rem;">Acceso denegado</h2>
          <p style="color: var(--gray-500); margin-bottom: 1.5rem;">Tu cuenta está configurada como <b>Cliente</b>. No tienes permisos para registrar un negocio.</p>
          <a href="index.html" class="btn btn-purple">Volver al inicio</a>
        </div>
      `;
    }
    return; // Esto detiene el código para que no cargue el mapa ni permita guardar.
  }
  // ==========================================

  // VALIDACIÓN EN TIEMPO REAL (Letras vs Números vs Teléfono)
  document.querySelectorAll('input[data-tipo]').forEach(input => {
    input.addEventListener('input', function() {
      if (this.dataset.tipo === 'letras') {
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
      } else if (this.dataset.tipo === 'numeros') {
        this.value = this.value.replace(/[^0-9]/g, '');
      } else if (this.dataset.tipo === 'telefono') {
        this.value = this.value.replace(/[^0-9+\s()\-]/g, '');
      }
    });
  });

  // INICIALIZAR MAPA MODERNO (CartoDB)
  const mapDiv = document.getElementById('mapa-registro');
  let mapaReg, marcadorReg;
  
  if (mapDiv) {
    const centro = [-0.2298, -78.5249]; // Quito
    mapaReg = L.map('mapa-registro').setView(centro, 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap, &copy; CARTO'
    }).addTo(mapaReg);

    marcadorReg = L.marker(centro, { draggable: true }).addTo(mapaReg);

    document.getElementById('reg-lat').value = centro[0];
    document.getElementById('reg-lng').value = centro[1];

    marcadorReg.on('dragend', function() {
      const pos = marcadorReg.getLatLng();
      document.getElementById('reg-lat').value = pos.lat;
      document.getElementById('reg-lng').value = pos.lng;
    });

    document.getElementById('btn-ubicacion')?.addEventListener('click', () => {
      if (navigator.geolocation) {
        document.getElementById('btn-ubicacion').textContent = "Ubicando...";
        navigator.geolocation.getCurrentPosition((position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const nuevaPos = [lat, lng];
          
          marcadorReg.setLatLng(nuevaPos);
          mapaReg.setView(nuevaPos, 16);
          document.getElementById('reg-lat').value = lat;
          document.getElementById('reg-lng').value = lng;
          document.getElementById('btn-ubicacion').textContent = "📍 Ubicación obtenida";
        }, () => {
          alert('No se pudo obtener la ubicación. Comprueba los permisos de tu navegador.');
          document.getElementById('btn-ubicacion').textContent = "📍 Usar mi ubicación actual";
        });
      } else {
        alert('Tu navegador no soporta geolocalización.');
      }
    });
  }

  // ENVÍO DEL FORMULARIO
  document.getElementById('form-registro')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    setBtnState('btn-registrar', true, 'Creando...');
    const msgEl = document.getElementById('msg-registro');
    msgEl.style.display = 'none';

    try {
      const nombre = document.getElementById('reg-nombre').value.trim();
      if (!nombre) throw new Error('El nombre del negocio es obligatorio.');

      const nuevoNegocio = {
        owner_id: session.user.id,
        nombre: nombre,
        descripcion: document.getElementById('reg-desc').value.trim() || null,
        ciudad: document.getElementById('reg-ciudad').value.trim() || null,
        telefono: document.getElementById('reg-tel').value.trim() || null,
        direccion: document.getElementById('reg-dir').value.trim() || null,
        latitud: parseFloat(document.getElementById('reg-lat').value) || null,
        longitud: parseFloat(document.getElementById('reg-lng').value) || null,
        horario_inicio: document.getElementById('reg-h1').value || null,
        horario_fin: document.getElementById('reg-h2').value || null,
        activo: true
      };

      const { error } = await window.sb.from('negocios').insert([nuevoNegocio]);
      if (error) throw error; 

      window.location.href = 'admin.html';

    } catch (err) {
      msgEl.textContent = err.message;
      msgEl.className = 'auth-msg error';
      msgEl.style.display = 'block';
    } finally {
      setBtnState('btn-registrar', false);
    }
  });
});

function setBtnState(id, loading, text = '') {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('.btn-text')?.classList.toggle('hidden', loading);
  btn.querySelector('.btn-loader')?.classList.toggle('hidden', !loading);
  if (loading && text) {
    const loaderText = btn.querySelector('.btn-loader');
    if (loaderText) loaderText.innerHTML = `<span class="spinner"></span> ${text}`;
  }
}