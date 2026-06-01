/* SyncBook · barberia.js */
let negocio       = null;
let servicioActivo = null;
let usuarioSesion  = null;

window.addEventListener('DOMContentLoaded', async () => {
  initNavbar('');
  
  // === VALIDACIÓN ESTRICTA EN TIEMPO REAL PARA EL CLIENTE ===
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
      if (this.dataset.tipo === 'letras') {
        // Bloquea cualquier número o símbolo, solo permite letras y espacios
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
      } else if (this.dataset.tipo === 'telefono' || this.dataset.tipo === 'numeros') {
        // Bloquea letras, solo permite números, el signo + y guiones
        this.value = this.value.replace(/[^0-9+\- ]/g, '');
      }
    });
  });
  // ==========================================================

  const params    = new URLSearchParams(window.location.search);
  const negocioId = params.get('id');

  if (!negocioId || !window.sb) { mostrar404(); return; }

  // Verificar sesión
  const { data:{ session } } = await window.sb.auth.getSession();
  if (session) {
    usuarioSesion = session.user;
    document.querySelector('.btn-ingresar')?.style.setProperty('display','none');
    autocompletar(session.user);
  }

  document.getElementById('cl-fecha').min = fechaHoy();
  await cargarNegocio(negocioId);

  document.getElementById('form-reserva')?.addEventListener('submit', enviarReserva);
  document.getElementById('btn-cambiar-serv')?.addEventListener('click', limpiarServicio);
  document.getElementById('btn-otra')?.addEventListener('click', () => {
    document.getElementById('modal-exito').classList.add('hidden');
    limpiarServicio();
    document.getElementById('form-reserva').reset();
    document.getElementById('cl-fecha').min = fechaHoy();
    if (usuarioSesion) autocompletar(usuarioSesion);
  });
  document.getElementById('modal-exito')?.addEventListener('click', e => {
    if (e.target.id === 'modal-exito') document.getElementById('modal-exito').classList.add('hidden');
  });
});

function mostrar404() {
  document.getElementById('vista-loading')?.classList.add('hidden');
  document.getElementById('vista-404')?.classList.remove('hidden');
}

async function cargarNegocio(id) {
  try {
    const { data, error } = await window.sb
      .from('negocios').select('*').eq('id', id).eq('activo', true).single();
    if (error || !data) { mostrar404(); return; }
    negocio = data;
    poblarNegocio(data);
    await cargarServicios(id);
    document.getElementById('vista-loading')?.classList.add('hidden');
    document.getElementById('vista-barberia')?.classList.remove('hidden');
    document.title = `${data.nombre} · SyncBook`;
  } catch { mostrar404(); }
}

function poblarNegocio(n) {
  document.getElementById('barb-nombre').textContent  = n.nombre;
  document.getElementById('barb-ciudad').textContent  = n.ciudad ? `📍 ${n.ciudad}` : '';
  document.getElementById('barb-horario').textContent = n.horario_inicio && n.horario_fin
    ? `🕐 ${n.horario_inicio} – ${n.horario_fin}` : '';
  document.getElementById('barb-desc').textContent    = n.descripcion || '';
  
  const dirTexto = document.getElementById('barb-direccion-texto');
  if (dirTexto && n.direccion) dirTexto.textContent = n.direccion;

  if (n.logo_url) {
    document.getElementById('barb-logo').innerHTML = `<img src="${n.logo_url}" alt="${n.nombre}">`;
    document.getElementById('barb-cover').innerHTML = `<img src="${n.logo_url}" alt="${n.nombre}" style="width:100%;height:100%;object-fit:cover;filter:blur(8px) brightness(.5)">`;
  }
  
  if (n.telefono) {
    const link = document.getElementById('barb-tel-link');
    if (link) { link.href = `tel:${n.telefono}`; link.style.display = ''; }
  }

  // === MAPA + DIRECCIONES con SerpApi Google Maps Directions API ===
  if (n.latitud && n.longitud) {
    const contenedor = document.getElementById('contenedor-mapa');
    const iframe     = document.getElementById('google-map-iframe');
    const dirLabel   = document.getElementById('mapa-texto-direccion');

    if (contenedor) {
      if (dirLabel) dirLabel.textContent = n.direccion || n.ciudad || '';

      // Embed estático de Google Maps (no requiere key para vista básica)
      if (iframe) {
        const q = encodeURIComponent(n.direccion ? `${n.direccion}, ${n.ciudad || ''}` : `${n.latitud},${n.longitud}`);
        iframe.src = `https://maps.google.com/maps?q=${q}&z=16&output=embed&hl=es`;
      }

      contenedor.classList.remove('hidden');

      // Botón "Cómo llegar" → abre Google Maps Directions en nueva pestaña
      const btnDir = document.getElementById('btn-como-llegar');
      if (btnDir) {
        const destCoords = `${n.latitud},${n.longitud}`;
        btnDir.href = `https://www.google.com/maps/dir/?api=1&destination=${destCoords}&travelmode=driving`;
        btnDir.style.display = '';
      }

      // Cargar direcciones con SerpApi si hay coordenadas del negocio
      cargarDirecciones(n);
    }
  }
  // =================================================================
}

async function cargarServicios(negocioId) {
  const grid = document.getElementById('barb-servicios');
  try {
    const { data, error } = await window.sb
      .from('servicios').select('*')
      .eq('negocio_id', negocioId).eq('activo', true).order('nombre');
    if (error) throw error;
    grid.innerHTML = '';
    if (!data || !data.length) {
      grid.innerHTML = '<p style="color:var(--gray-500);grid-column:1/-1">Esta barbería aún no tiene servicios configurados.</p>';
      return;
    }
    data.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'barb-serv-card';
      card.style.animationDelay = `${i*70}ms`;
      card.innerHTML = `
        <div class="barb-serv-nombre">${s.nombre}</div>
        ${s.descripcion ? `<p class="barb-serv-desc">${s.descripcion}</p>` : ''}
        <div class="barb-serv-meta">
          <span class="badge badge-purple">⏱ ${s.duracion_minutos} min</span>
          <span class="badge badge-gray">$${s.precio}</span>
        </div>
        <button class="barb-serv-btn" type="button">Reservar este servicio →</button>`;
      card.querySelector('.barb-serv-btn').addEventListener('click', () => seleccionarServicio(s, card));
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:var(--gray-500);grid-column:1/-1">Error al cargar servicios: ${err.message}</p>`;
  }
}

function seleccionarServicio(s, card) {
  servicioActivo = s;
  document.querySelectorAll('.barb-serv-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  document.getElementById('aside-serv-nombre').textContent = s.nombre;
  document.getElementById('aside-serv-dur').textContent    = `⏱ ${s.duracion_minutos} min`;
  document.getElementById('aside-serv-precio').textContent = `$${s.precio}`;
  document.getElementById('aside-empty').classList.add('hidden');
  document.getElementById('aside-form').classList.remove('hidden');
  setMsg('','');
  if (window.innerWidth <= 900) {
    document.getElementById('barb-aside')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }
}

function limpiarServicio() {
  servicioActivo = null;
  document.querySelectorAll('.barb-serv-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('aside-empty').classList.remove('hidden');
  document.getElementById('aside-form').classList.add('hidden');
}

function autocompletar(user) {
  const nombre = user.user_metadata?.nombre_completo || '';
  const tel    = user.user_metadata?.telefono        || '';
  const ni = document.getElementById('cl-nombre');
  const ti = document.getElementById('cl-tel');
  
  if (ni && nombre) { 
    ni.value = nombre.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, ''); 
  }
  if (ti && tel) { 
    ti.value = tel.replace(/[^0-9+\- ]/g, ''); 
  }
  
  const badge = document.getElementById('sesion-badge');
  if (badge) { 
    badge.innerHTML = `✓ Sesión activa como <strong>${nombre || user.email}</strong>. Puedes modificar los datos si reservas para otra persona.`; 
    badge.classList.remove('hidden'); 
  }
}

async function enviarReserva(e) {
  e.preventDefault();
  if (!servicioActivo || !negocio) return;

  const nombre = document.getElementById('cl-nombre').value.trim();
  const tel    = document.getElementById('cl-tel').value.trim();
  const fecha  = document.getElementById('cl-fecha').value;
  const hora   = document.getElementById('cl-hora').value;
  const notas  = document.getElementById('cl-notas').value.trim();

  // Validaciones visuales mejoradas
  ['err-cl-nombre','err-cl-tel','err-cl-fecha','err-cl-hora'].forEach(id => { const e=document.getElementById(id); if(e) e.textContent=''; });
  let ok = true;
  if (!nombre || nombre.length < 3) { document.getElementById('err-cl-nombre').textContent='Ingresa un nombre válido (mínimo 3 letras).'; ok=false; }
  if (!tel || tel.replace(/\D/g,'').length < 7) { document.getElementById('err-cl-tel').textContent='Teléfono inválido (mínimo 7 números).'; ok=false; }
  if (!fecha || fecha < fechaHoy()) { document.getElementById('err-cl-fecha').textContent='La fecha no puede estar en el pasado.'; ok=false; }
  if (!hora) { document.getElementById('err-cl-hora').textContent='Elegí una hora.'; ok=false; }
  if (!ok) return;

  if (negocio.horario_inicio && hora < negocio.horario_inicio) {
    document.getElementById('err-cl-hora').textContent = `El negocio abre a las ${negocio.horario_inicio}.`;
    return;
  }
  if (negocio.horario_fin && hora > negocio.horario_fin) {
    document.getElementById('err-cl-hora').textContent = `El negocio cierra a las ${negocio.horario_fin}.`;
    return;
  }

  setBtnLoading(true); setMsg('','');
  try {
    const { data:conf } = await window.sb.from('citas')
      .select('id').eq('negocio_id', negocio.id)
      .eq('servicio_id', servicioActivo.id)
      .eq('fecha', fecha).eq('hora_inicio', hora)
      .not('estado','eq','cancelada').limit(1);
    if (conf && conf.length) { setMsg('⚠️ Ese horario ya está ocupado. Elegí otro.','error'); return; }

    const horaFin = calcularHoraFin(hora, servicioActivo.duracion_minutos);
    const nuevaCita = {
      negocio_id:       negocio.id,
      servicio_id:      servicioActivo.id,
      cliente_nombre:   nombre,
      cliente_telefono: tel,
      fecha, hora_inicio: hora, hora_fin: horaFin,
      estado: 'pendiente',
      notas:  notas || null
    };
    if (usuarioSesion) nuevaCita.cliente_id = usuarioSesion.id;

    const { error } = await window.sb.from('citas').insert([nuevaCita]);
    if (error) throw error;

    sessionStorage.setItem('syncbook_conf', JSON.stringify({
      negocio: negocio.nombre, servicio: servicioActivo.nombre,
      duracion: servicioActivo.duracion_minutos, precio: servicioActivo.precio,
      nombre, tel, fecha, hora, horaFin, notas
    }));

    document.getElementById('modal-detalle').textContent =
      `${nombre}, tu turno para "${servicioActivo.nombre}" en ${negocio.nombre} el ${formatearFecha(fecha)} a las ${hora}h fue registrado.`;
    const mc = document.getElementById('modal-mis-citas');
    if (mc) mc.style.display = usuarioSesion ? '' : 'none';
    document.getElementById('modal-exito').classList.remove('hidden');
  } catch(err) { setMsg(`❌ ${err.message}`,'error'); }
  finally { setBtnLoading(false); }
}

function setMsg(texto, tipo='') {
  const el = document.getElementById('msg-reserva');
  if(!el) return; el.textContent=texto; el.className=`reserva-msg ${tipo}`;
}
function setBtnLoading(loading) {
  const btn=document.getElementById('btn-reservar');
  btn?.querySelector('.btn-text')?.classList.toggle('hidden',loading);
  btn?.querySelector('.btn-loader')?.classList.toggle('hidden',!loading);
  if(btn) btn.disabled=loading;
}

function calcularHoraFin(horaStr, min) {
  const [h, m] = horaStr.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`;
}

// ============================================================
// SERPAPI — Google Maps Directions
// Reemplaza 'YOUR_SERPAPI_KEY' con tu clave real de serpapi.com
// ============================================================
const SERPAPI_KEY = 'YOUR_SERPAPI_KEY';

const MODO_ICONO = { Driving:'🚗', Walking:'🚶', Cycling:'🚲', Transit:'🚌', Flight:'✈️' };
const MODO_ES    = { Driving:'En auto', Walking:'Caminando', Cycling:'En bici', Transit:'Transporte', Flight:'Vuelo' };

async function cargarDirecciones(n) {
  const wrapper = document.getElementById('direcciones-wrapper');
  if (!wrapper) return;

  // Pedir ubicación al usuario
  if (!navigator.geolocation) {
    wrapper.innerHTML = `<p class="dir-nota">Tu navegador no soporta geolocalización. <a href="https://www.google.com/maps/dir/?api=1&destination=${n.latitud},${n.longitud}" target="_blank" class="dir-link">Abrir en Google Maps →</a></p>`;
    return;
  }

  wrapper.innerHTML = `<div class="dir-loading"><span class="spinner spinner-dark" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:.5rem"></span> Obteniendo tu ubicación...</div>`;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      wrapper.innerHTML = `<div class="dir-loading"><span class="spinner spinner-dark" style="width:18px;height:18px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:.5rem"></span> Calculando rutas...</div>`;

      try {
        // SerpApi no admite llamadas directas desde el browser por CORS.
        // Se usa un proxy público de CORS solo para demostración.
        // En producción, hacer esta llamada desde tu propio backend/edge function.
        const endCoords  = `${n.latitud},${n.longitud}`;
        const startCoords = `${lat},${lng}`;
        const url = `https://serpapi.com/search.json?engine=google_maps_directions&start_coords=${startCoords}&end_coords=${endCoords}&hl=es&gl=ec&distance_unit=0&api_key=${SERPAPI_KEY}`;

        // Proxy CORS para llamadas desde el browser (solo desarrollo)
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;

        const res  = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.directions || !data.directions.length) {
          wrapper.innerHTML = `<p class="dir-nota">No se encontraron rutas. <a href="https://www.google.com/maps/dir/${lat},${lng}/${endCoords}" target="_blank" class="dir-link">Ver en Google Maps →</a></p>`;
          return;
        }

        // Renderizar tarjetas de rutas
        const tarjetas = data.directions.slice(0, 4).map(d => {
          const modo  = d.travel_mode || '';
          const icono = MODO_ICONO[modo] || '📍';
          const label = MODO_ES[modo]   || modo;
          const via   = d.via ? `<span class="dir-via">vía ${d.via}</span>` : '';
          const exts  = (d.extensions || []).map(e => `<span class="dir-ext">${e}</span>`).join('');
          return `
            <div class="dir-card">
              <div class="dir-card-top">
                <span class="dir-modo-icon">${icono}</span>
                <div class="dir-card-info">
                  <span class="dir-modo-label">${label}</span>
                  ${via}
                </div>
                <div class="dir-card-tiempo">
                  <strong>${d.formatted_duration || '—'}</strong>
                  <span>${d.formatted_distance || ''}</span>
                </div>
              </div>
              ${exts ? `<div class="dir-exts">${exts}</div>` : ''}
            </div>`;
        }).join('');

        const gmapsLink = `https://www.google.com/maps/dir/${lat},${lng}/${n.latitud},${n.longitud}`;

        wrapper.innerHTML = `
          <div class="dir-header">
            <span class="dir-desde">Desde tu ubicación actual</span>
            <a href="${gmapsLink}" target="_blank" rel="noopener" class="dir-link">Abrir en Google Maps →</a>
          </div>
          <div class="dir-cards">${tarjetas}</div>`;

      } catch (err) {
        console.warn('SerpApi directions error:', err);
        // Fallback graceful: solo mostrar link a Google Maps
        const gmapsLink = `https://www.google.com/maps/dir/${lat},${lng}/${n.latitud},${n.longitud}`;
        wrapper.innerHTML = `
          <div class="dir-header">
            <span class="dir-desde">Desde tu ubicación actual</span>
            <a href="${gmapsLink}" target="_blank" rel="noopener" class="dir-link">Ver cómo llegar en Google Maps →</a>
          </div>`;
      }
    },
    () => {
      // Usuario denegó geolocalización — mostrar link genérico
      const gmapsLink = `https://www.google.com/maps/dir/?api=1&destination=${n.latitud},${n.longitud}&travelmode=driving`;
      wrapper.innerHTML = `<p class="dir-nota">Activa la ubicación para ver rutas. <a href="${gmapsLink}" target="_blank" rel="noopener" class="dir-link">Abrir en Google Maps →</a></p>`;
    },
    { timeout: 8000, maximumAge: 60000 }
  );
}