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
  document.getElementById('cl-fecha')?.addEventListener('change', () => {
    poblarSelectHoras();
  });
  await cargarNegocio(negocioId);

  document.getElementById('form-reserva')?.addEventListener('submit', enviarReserva);
  document.getElementById('btn-cambiar-serv')?.addEventListener('click', limpiarServicio);
  document.getElementById('btn-otra')?.addEventListener('click', () => {
    document.getElementById('modal-exito').classList.add('hidden');
    limpiarServicio();
    document.getElementById('form-reserva').reset();
    document.getElementById('cl-fecha').min = fechaHoy();
    poblarSelectHoras();
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
    poblarSelectHoras(); // Generar horarios con los datos reales del negocio
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

if (n.latitud && n.longitud) {
    const mapDiv = document.getElementById('mapa-cliente');
    if (mapDiv) {
      // Mostrar el div ANTES de inicializar Leaflet
      mapDiv.style.display = 'block';

      // Botón "Cómo llegar"
      const btnLlegar = document.getElementById('btn-como-llegar');
      if (btnLlegar) {
        btnLlegar.href = `https://www.google.com/maps/dir/?api=1&destination=${n.latitud},${n.longitud}`;
        btnLlegar.style.display = '';
      }

      // Delay para que el navegador pinte el div antes de inicializar el mapa
      setTimeout(() => {
        const mapaCli = L.map(mapDiv, { zoomControl: true }).setView([n.latitud, n.longitud], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19
        }).addTo(mapaCli);

        L.marker([n.latitud, n.longitud])
          .addTo(mapaCli)
          .bindPopup(`<div style="font-family:sans-serif;font-size:.9rem"><b>${n.nombre}</b><br>${n.direccion || n.ciudad || ''}</div>`)
          .openPopup();

        // Forzar recalculo de tamaño por si el layout tardó en renderizarse
        setTimeout(() => mapaCli.invalidateSize(), 300);
      }, 50);
    }
  }
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

function poblarSelectHoras() {
  const sel = document.getElementById('cl-hora');
  if (!sel) return;

  const abre  = (negocio?.horario_inicio || '08:00');
  const cierra = (negocio?.horario_fin   || '20:00');
  const fechaVal = document.getElementById('cl-fecha')?.value;
  const ahora = new Date();

  // Parsear límites
  const [hA, mA] = abre.split(':').map(Number);
  const [hC, mC] = cierra.split(':').map(Number);
  const minAbre   = hA * 60 + mA;
  const minCierra = hC * 60 + mC;

  sel.innerHTML = '<option value="">Elegí un horario</option>';

  for (let min = minAbre; min < minCierra; min += 30) {
    const hh = String(Math.floor(min / 60)).padStart(2, '0');
    const mm = String(min % 60).padStart(2, '0');
    const valor = `${hh}:${mm}`;

    // Si la fecha elegida es hoy, ocultar horas que ya pasaron
    if (fechaVal === fechaHoy()) {
      const slotDate = new Date();
      slotDate.setHours(Math.floor(min / 60), min % 60, 0, 0);
      if (slotDate <= ahora) continue;
    }

    const opt = document.createElement('option');
    opt.value = valor;
    opt.textContent = `${valor} hs`;
    sel.appendChild(opt);
  }
}

function calcularHoraFin(horaStr, min) {
  const [h, m] = horaStr.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2,'0')}:${String(t % 60).padStart(2,'0')}`;
}