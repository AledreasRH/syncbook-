/* SyncBook · admin.js */
let negocioActual  = null;
let todasCitas     = [];
let todosServicios = [];
let citaSel        = null;
let servEditId     = null;
let mapaAdmin, marcadorAdmin;

window.addEventListener('DOMContentLoaded', async () => {
  if (!window.sb) { mostrarGuard('Sin conexión a Supabase.'); return; }

  const { data:{ session } } = await window.sb.auth.getSession();
  if (!session) { window.location.href = 'login.html'; return; }

  let rol = session.user.user_metadata?.rol;
  if (!rol) {
    const { data: usuario } = await window.sb.from('usuarios').select('rol').eq('id', session.user.id).single();
    if (usuario) rol = usuario.rol;
  }
  if (rol && !['admin','dueno'].includes(rol)) {
    window.location.href = 'mis-citas.html'; return;
  }

  // VALIDACIÓN ESTRICTA EN TIEMPO REAL (Letras vs Números) en el Admin
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', function() {
      if (this.dataset.tipo === 'letras') {
        this.value = this.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');
      } else if (this.dataset.tipo === 'telefono' || this.dataset.tipo === 'numeros') {
        this.value = this.value.replace(/[^0-9+\- ]/g, '');
      }
    });
  });

  const { data: listNegocios } = await window.sb
    .from('negocios').select('*').eq('owner_id', session.user.id).limit(1);
    
  let negocio = null;
  if (listNegocios && listNegocios.length > 0) {
      negocio = listNegocios[0];
  }

  document.getElementById('panel-guard').classList.add('hidden');
  document.getElementById('panel-dashboard').classList.remove('hidden');

  const nombre = session.user.user_metadata?.nombre_completo || session.user.email;
  document.getElementById('adm-nombre').textContent = nombre;
  document.getElementById('adm-avatar').textContent = nombre.charAt(0).toUpperCase();

  const fechaEl = document.getElementById('dash-fecha');
  if (fechaEl) fechaEl.textContent = new Date().toLocaleDateString('es-AR',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  const mapDiv = document.getElementById('mapa-negocio');
  let latInicial = -0.2298;
  let lngInicial = -78.5249; 

  if (negocio) {
    negocioActual = negocio;
    latInicial = negocio.latitud || latInicial;
    lngInicial = negocio.longitud || lngInicial;

    const linkUrl = `${window.location.origin}${window.location.pathname.replace('admin.html','')}barberia.html?id=${negocio.id}`;
    document.getElementById('adm-link-url').textContent = linkUrl;
    const linkVer = document.getElementById('adm-link-ver');
    if (linkVer) { linkVer.href = linkUrl; linkVer.style.display = ''; }
    window._linkNegocio = linkUrl;

    await Promise.all([cargarCitas(), cargarServicios()]);
    llenarFormNegocio(negocio);
  } else {
    negocioActual = null;
    document.getElementById('adm-link-url').textContent = '⚠️ Crea tu barbería en la pestaña "Mi negocio" primero.';
    const linkVer = document.getElementById('adm-link-ver');
    if (linkVer) linkVer.style.display = 'none';
    actualizarStats([]);
    renderProximas([]);
    renderServicios([]);
  }

  // === LEAFLET — selector de ubicación en admin (sin API key) ===
  if (mapDiv) {
    document.getElementById('edit-lat').value = latInicial;
    document.getElementById('edit-lng').value = lngInicial;

    // Destruir mapa previo si existe
    if (mapaAdmin) { mapaAdmin.remove(); mapaAdmin = null; marcadorAdmin = null; }

    mapaAdmin = L.map(mapDiv).setView([latInicial, lngInicial], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapaAdmin);

    marcadorAdmin = L.marker([latInicial, lngInicial], { draggable: true })
      .addTo(mapaAdmin)
      .bindPopup('Arrastrá para mover la ubicación')
      .openPopup();

    // Arrastrar marcador → actualizar inputs
    marcadorAdmin.on('dragend', () => {
      const pos = marcadorAdmin.getLatLng();
      document.getElementById('edit-lat').value = pos.lat;
      document.getElementById('edit-lng').value = pos.lng;
    });

    // Click en el mapa → mover marcador
    mapaAdmin.on('click', (e) => {
      marcadorAdmin.setLatLng(e.latlng);
      document.getElementById('edit-lat').value = e.latlng.lat;
      document.getElementById('edit-lng').value = e.latlng.lng;
    });

    // Abrir pestaña Mi negocio → refrescar mapa (Leaflet necesita invalidateSize)
    document.getElementById('nav-btn-negocio')?.addEventListener('click', () => {
      setTimeout(() => { if (mapaAdmin) mapaAdmin.invalidateSize(); }, 200);
    });

    // Botón "📍 Ubicación actual"
    document.getElementById('btn-ubicacion-admin')?.addEventListener('click', () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition((position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (marcadorAdmin) marcadorAdmin.setLatLng([lat, lng]);
        if (mapaAdmin) mapaAdmin.setView([lat, lng], 16);
        document.getElementById('edit-lat').value = lat;
        document.getElementById('edit-lng').value = lng;
      }, () => showToast('No se pudo obtener la ubicación.', 'error'));
    });
  }
  // ======================================================

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await window.sb.auth.signOut(); window.location.href = 'login.html';
  });

  document.getElementById('btn-refrescar')?.addEventListener('click', async () => {
    await Promise.all([cargarCitas(), cargarServicios()]);
  });
  document.getElementById('btn-exportar')?.addEventListener('click', exportarCSV);
  document.getElementById('btn-exportar-citas')?.addEventListener('click', exportarCSV);

  document.getElementById('filtro-buscar')?.addEventListener('input', filtrarCitas);
  document.getElementById('filtro-estado')?.addEventListener('change', filtrarCitas);
  document.getElementById('filtro-fecha')?.addEventListener('change', filtrarCitas);
  document.getElementById('btn-limpiar')?.addEventListener('click', limpiarFiltros);

  document.getElementById('modal-cerrar')?.addEventListener('click', cerrarModalCita);
  document.getElementById('modal-cerrar2')?.addEventListener('click', cerrarModalCita);
  document.getElementById('modal-confirmar')?.addEventListener('click', () => cambiarEstado('confirmada'));
  document.getElementById('modal-cancelar-btn')?.addEventListener('click', () => cambiarEstado('cancelada'));
  document.getElementById('modal-cita')?.addEventListener('click', e => { if(e.target.id==='modal-cita') cerrarModalCita(); });

  document.getElementById('modal-eliminar-btn')?.addEventListener('click', async () => {
    if (!citaSel) return;
    const confirmacion = confirm('¿Estás seguro de que deseas eliminar esta cita permanentemente? Esta acción no se puede deshacer.');
    if (!confirmacion) return;

    try {
      const { error } = await window.sb.from('citas').delete().eq('id', citaSel.id);
      if (error) throw error;
      
      showToast('✓ Cita eliminada de la base de datos.', 'success');
      todasCitas = todasCitas.filter(c => c.id !== citaSel.id);
      actualizarStats(todasCitas);
      filtrarCitas();
      renderProximas(todasCitas);
      cerrarModalCita();
    } catch(err) { showToast(`Error al eliminar: ${err.message}`, 'error'); }
  });

  document.getElementById('btn-nuevo-serv')?.addEventListener('click', () => abrirModalServ(null));
  document.getElementById('modal-serv-cerrar')?.addEventListener('click', cerrarModalServ);
  document.getElementById('modal-serv-cancelar')?.addEventListener('click', cerrarModalServ);
  document.getElementById('modal-serv')?.addEventListener('click', e => { if(e.target.id==='modal-serv') cerrarModalServ(); });
  document.getElementById('modal-serv-guardar')?.addEventListener('click', guardarServicio);
  document.getElementById('form-negocio-edit')?.addEventListener('submit', guardarNegocio);
});

function mostrarGuard(msg) {
  document.getElementById('panel-guard').innerHTML = `<div style="text-align:center;color:var(--gray-500);padding:2rem">${msg}</div>`;
}

function cambiarPanel(panel, btn) {
  document.querySelectorAll('.adm-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.adm-nav-item').forEach(b => b.classList.remove('active'));
  document.getElementById(`panel-${panel}`)?.classList.remove('hidden');
  if (btn) btn.classList.add('active');
  else document.querySelector(`[data-panel="${panel}"]`)?.classList.add('active');
}

async function cargarCitas() {
  if (!negocioActual) return;
  const tbody = document.getElementById('tbody-citas');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="adm-table-loading"><span class="spinner spinner-dark"></span>Cargando...</td></tr>`;

  try {
    const { data, error } = await window.sb
      .from('citas')
      .select('id,fecha,hora_inicio,hora_fin,estado,cliente_nombre,cliente_telefono,notas,fecha_creacion,servicios(nombre,precio)')
      .eq('negocio_id', negocioActual.id)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: true });

    if (error) throw error;
    todasCitas = data || [];
    actualizarStats(todasCitas);
    filtrarCitas();
    renderProximas(todasCitas);
  } catch(err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#B42318;padding:2rem">⚠️ ${err.message}</td></tr>`;
  }
}

function actualizarStats(citas) {
  const hoy = fechaHoy();
  document.getElementById('stat-hoy').textContent        = citas ? citas.filter(c => c.fecha === hoy).length : 0;
  document.getElementById('stat-pendientes').textContent = citas ? citas.filter(c => c.estado === 'pendiente').length : 0;
  document.getElementById('stat-confirmadas').textContent= citas ? citas.filter(c => c.estado === 'confirmada').length : 0;
  document.getElementById('stat-total').textContent      = citas ? citas.length : 0;
}

function renderProximas(citas) {
  const wrap = document.getElementById('dash-proximas');
  if (!wrap) return;
  if (!citas || !citas.length) {
    wrap.innerHTML = '<p style="padding:1.25rem 1.5rem;color:var(--gray-400);font-size:.9rem">No hay citas próximas.</p>';
    return;
  }
  const hoy      = fechaHoy();
  const proximas = citas.filter(c => c.fecha >= hoy && c.estado !== 'cancelada').slice(0, 5);
  wrap.innerHTML = `<table class="adm-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Cliente</th><th>Servicio</th><th>Estado</th><th>Acción</th></tr></thead><tbody>
    ${proximas.map(c=>`<tr>
      <td><strong>${formatearFecha(c.fecha)}</strong></td>
      <td style="font-family:monospace">${c.hora_inicio}</td>
      <td>${c.cliente_nombre}</td>
      <td>${c.servicios?.nombre||'—'}</td>
      <td><span class="chip-estado chip-${c.estado}">${c.estado}</span></td>
      <td><div class="adm-acts">
        ${c.estado==='pendiente'?`<button class="adm-btn adm-btn-ok" onclick="accionRapida('${c.id}','confirmada')">✓</button><button class="adm-btn adm-btn-cancel" onclick="accionRapida('${c.id}','cancelada')">✕</button>`:''}
      </div></td>
    </tr>`).join('')}
  </tbody></table>`;
}

function filtrarCitas() {
  const buscar = (document.getElementById('filtro-buscar')?.value || '').toLowerCase();
  const estado = document.getElementById('filtro-estado')?.value || '';
  const fecha  = document.getElementById('filtro-fecha')?.value  || '';
  let f = [...todasCitas];
  if (buscar) f = f.filter(c => c.cliente_nombre.toLowerCase().includes(buscar) || c.cliente_telefono.includes(buscar) || (c.servicios?.nombre||'').toLowerCase().includes(buscar));
  if (estado) f = f.filter(c => c.estado === estado);
  if (fecha)  f = f.filter(c => c.fecha  === fecha);
  renderTabla(f);
}

function limpiarFiltros() {
  ['filtro-buscar','filtro-fecha'].forEach(id => { const e=document.getElementById(id); if(e) e.value=''; });
  document.getElementById('filtro-estado').value = '';
  filtrarCitas();
}

function renderTabla(citas) {
  const tbody = document.getElementById('tbody-citas');
  const empty = document.getElementById('citas-vacias');
  if (!citas || !citas.length) { if(tbody) tbody.innerHTML=''; empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');
  tbody.innerHTML = citas.map(c => `<tr>
    <td><strong>${formatearFecha(c.fecha)}</strong></td>
    <td style="font-family:monospace;font-size:.85rem">${c.hora_inicio} – ${c.hora_fin}</td>
    <td>${c.cliente_nombre}</td>
    <td>${c.cliente_telefono}</td>
    <td>${c.servicios?.nombre||'—'}</td>
    <td><span class="chip-estado chip-${c.estado}">${c.estado}</span></td>
    <td><div class="adm-acts">
      <button class="adm-btn" onclick="abrirModalCita('${c.id}')">👁 Ver</button>
      ${c.estado==='pendiente'?`<button class="adm-btn adm-btn-ok" onclick="accionRapida('${c.id}','confirmada')">✓</button><button class="adm-btn adm-btn-cancel" onclick="accionRapida('${c.id}','cancelada')">✕</button>`:''}
    </div></td>
  </tr>`).join('');
}

function abrirModalCita(id) {
  const c = todasCitas.find(x => x.id === id);
  if (!c) return;
  citaSel = c;
  document.getElementById('modal-cita-body').innerHTML = `
    <div style="display:flex;flex-direction:column">
      ${mfila('Servicio',  c.servicios?.nombre || '—')}
      ${mfila('Precio',    c.servicios?.precio ? `$${c.servicios.precio}` : '—')}
      ${mfila('Fecha',     formatearFecha(c.fecha))}
      ${mfila('Horario',   `${c.hora_inicio} – ${c.hora_fin} hs`)}
      ${mfila('Cliente',   c.cliente_nombre)}
      ${mfila('Teléfono',  c.cliente_telefono)}
      ${mfila('Estado',    `<span class="chip-estado chip-${c.estado}">${c.estado}</span>`)}
      ${c.notas ? mfila('Notas', c.notas) : ''}
      ${c.fecha_creacion ? mfila('Registrada', new Date(c.fecha_creacion).toLocaleString('es-AR')) : ''}
    </div>`;
  document.getElementById('modal-confirmar').style.display    = c.estado === 'pendiente' ? '' : 'none';
  document.getElementById('modal-cancelar-btn').style.display = c.estado !== 'cancelada' ? '' : 'none';
  document.getElementById('modal-cita').classList.remove('hidden');
}

function cerrarModalCita() { document.getElementById('modal-cita').classList.add('hidden'); citaSel = null; }

function mfila(l, v) {
  return `<div class="adm-modal-row"><span class="adm-modal-lbl">${l}</span><span class="adm-modal-val">${v}</span></div>`;
}

async function cambiarEstado(estado) {
  if (!citaSel) return;
  await actualizarCita(citaSel.id, estado);
  cerrarModalCita();
}

async function accionRapida(id, estado) { await actualizarCita(id, estado); }

async function actualizarCita(id, estado) {
  try {
    const { error } = await window.sb.from('citas').update({ estado }).eq('id', id);
    if (error) throw error;
    showToast(estado === 'confirmada' ? '✓ Cita confirmada.' : '✕ Cita cancelada.', estado === 'confirmada' ? 'success' : 'error');
    const idx = todasCitas.findIndex(c => c.id === id);
    if (idx !== -1) todasCitas[idx].estado = estado;
    actualizarStats(todasCitas);
    filtrarCitas();
    renderProximas(todasCitas);
  } catch(err) { showToast(`Error: ${err.message}`, 'error'); }
}

function exportarCSV() {
  if (!todasCitas || !todasCitas.length) { showToast('No hay citas para exportar.', 'info'); return; }
  const h = ['Fecha','Hora inicio','Hora fin','Cliente','Teléfono','Servicio','Precio','Estado','Notas'];
  const rows = todasCitas.map(c => [
    c.fecha, c.hora_inicio, c.hora_fin,
    c.cliente_nombre, c.cliente_telefono,
    c.servicios?.nombre||'', c.servicios?.precio||'',
    c.estado, c.notas||''
  ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','));
  const csv = [h.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8;' }));
  a.download = `syncbook-citas-${negocioActual ? negocioActual.nombre.replace(/\s/g,'-') : 'barberia'}-${fechaHoy()}.csv`;
  a.click();
  showToast('✓ CSV descargado.', 'success');
}

async function cargarServicios() {
  if (!negocioActual) return;
  const grid = document.getElementById('servicios-grid');
  try {
    const { data, error } = await window.sb
      .from('servicios').select('*')
      .eq('negocio_id', negocioActual.id).order('nombre');
    if (error) throw error;
    todosServicios = data || [];
    renderServicios(todosServicios);
  } catch(err) {
    if (grid) grid.innerHTML = `<p style="color:#B42318">Error: ${err.message}</p>`;
  }
}

function renderServicios(lista) {
  const grid = document.getElementById('servicios-grid');
  if (!grid) return;
  if (!lista || !lista.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--gray-500)">
      <div style="font-size:2.5rem;margin-bottom:.75rem">✂</div>
      <p>No tenés servicios configurados. Agregá el primero.</p>
    </div>`;
    return;
  }
  grid.innerHTML = lista.map(s => `
    <div class="adm-serv-card${!s.activo?' adm-serv-inactive':''}">
      <div class="adm-serv-nombre">${s.nombre}</div>
      ${s.descripcion ? `<p class="adm-serv-desc">${s.descripcion}</p>` : ''}
      <div class="adm-serv-meta">
        <span class="badge badge-purple">⏱ ${s.duracion_minutos} min</span>
        <span class="badge badge-gray">$${s.precio}</span>
        ${!s.activo ? '<span class="badge" style="background:var(--red-pale);color:#B42318">Inactivo</span>' : ''}
      </div>
      <div class="adm-serv-actions">
        <button class="adm-btn adm-btn-edit" onclick="abrirModalServ('${s.id}')">✏ Editar</button>
        <button class="adm-btn ${s.activo?'adm-btn-cancel':'adm-btn-ok'}" onclick="toggleServicio('${s.id}',${!s.activo})">
          ${s.activo ? '⏸ Desactivar' : '▶ Activar'}
        </button>
      </div>
    </div>`).join('');
}

async function toggleServicio(id, nuevoEstado) {
  try {
    const { error } = await window.sb.from('servicios').update({ activo: nuevoEstado }).eq('id', id);
    if (error) throw error;
    showToast(nuevoEstado ? 'Servicio activado.' : 'Servicio desactivado.', 'info');
    await cargarServicios();
  } catch(err) { showToast(err.message, 'error'); }
}

function abrirModalServ(id) {
  servEditId = id;
  const serv = id ? todosServicios.find(s => s.id === id) : null;
  document.getElementById('modal-serv-title').textContent = serv ? 'Editar servicio' : 'Nuevo servicio';
  document.getElementById('serv-modal-id').value          = serv?.id || '';
  document.getElementById('serv-modal-nombre').value      = serv?.nombre || '';
  document.getElementById('serv-modal-desc').value        = serv?.descripcion || '';
  document.getElementById('serv-modal-dur').value         = serv?.duracion_minutos || 30;
  document.getElementById('serv-modal-precio').value      = serv?.precio || 0;
  document.getElementById('err-serv-nombre').textContent  = '';
  document.getElementById('modal-serv').classList.remove('hidden');
}

function cerrarModalServ() { document.getElementById('modal-serv').classList.add('hidden'); servEditId = null; }

async function guardarServicio() {
  if (!negocioActual || !negocioActual.id) {
    document.getElementById('err-serv-nombre').textContent = '⚠️ Primero ve a la pestaña "Mi negocio" y crea tu barbería.';
    return;
  }

  const nombre  = document.getElementById('serv-modal-nombre').value.trim();
  const desc    = document.getElementById('serv-modal-desc').value.trim();
  const dur     = parseInt(document.getElementById('serv-modal-dur').value) || 30;
  const precio  = parseFloat(document.getElementById('serv-modal-precio').value) || 0;

  document.getElementById('err-serv-nombre').textContent = '';
  
  // === NUEVAS VALIDACIONES ESTRICTAS PARA SERVICIOS ===
  if (!nombre) { document.getElementById('err-serv-nombre').textContent = 'El nombre es obligatorio.'; return; }
  if (dur < 5) { document.getElementById('err-serv-nombre').textContent = 'La duración debe ser al menos 5 min.'; return; }
  if (precio < 0) { document.getElementById('err-serv-nombre').textContent = 'El precio no puede ser negativo.'; return; }
  // ====================================================

  setBtnState('modal-serv-guardar', true, '');
  try {
    if (servEditId) {
      const { error } = await window.sb.from('servicios')
        .update({ nombre, descripcion: desc||null, duracion_minutos: dur, precio }).eq('id', servEditId);
      if (error) throw error;
      showToast('✓ Servicio actualizado.', 'success');
    } else {
      const { error } = await window.sb.from('servicios').insert([{
        negocio_id: negocioActual.id, 
        nombre,
        descripcion: desc||null, duracion_minutos: dur, precio, activo: true
      }]);
      if (error) throw error;
      showToast('✓ Servicio creado.', 'success');
    }
    cerrarModalServ();
    await cargarServicios();
  } catch(err) { showToast(err.message, 'error'); }
  finally { setBtnState('modal-serv-guardar', false); }
}

function llenarFormNegocio(n) {
  if (!n) return;
  document.getElementById('edit-nombre').value = n.nombre || '';
  document.getElementById('edit-desc').value   = n.descripcion || '';
  document.getElementById('edit-ciudad').value = n.ciudad || '';
  document.getElementById('edit-tel').value    = n.telefono || '';
  document.getElementById('edit-dir').value    = n.direccion || '';
  document.getElementById('edit-h1').value     = n.horario_inicio || '09:00';
  document.getElementById('edit-h2').value     = n.horario_fin    || '20:00';
  
  document.getElementById('edit-lat').value    = n.latitud || '';
  document.getElementById('edit-lng').value    = n.longitud || '';
  
  // Actualizar mapa Leaflet con la posición guardada
  if (n.latitud && n.longitud) {
    if (marcadorAdmin) marcadorAdmin.setLatLng([n.latitud, n.longitud]);
    if (mapaAdmin) mapaAdmin.setView([n.latitud, n.longitud], 15);
  }
}

async function guardarNegocio(e) {
  e.preventDefault();
  setBtnState('btn-guardar-negocio', true, 'Guardando...');
  setMsgNegocio('', '');
  try {
    const updates = {
      nombre:         document.getElementById('edit-nombre').value.trim(),
      descripcion:    document.getElementById('edit-desc').value.trim() || null,
      ciudad:         document.getElementById('edit-ciudad').value.trim() || null,
      telefono:       document.getElementById('edit-tel').value.trim() || null,
      direccion:      document.getElementById('edit-dir').value.trim() || null,
      latitud:        parseFloat(document.getElementById('edit-lat').value) || null,
      longitud:       parseFloat(document.getElementById('edit-lng').value) || null,
      horario_inicio: document.getElementById('edit-h1').value || null,
      horario_fin:    document.getElementById('edit-h2').value || null,
    };

    const { data: { session } } = await window.sb.auth.getSession();

    if (negocioActual && negocioActual.id) {
      const { error } = await window.sb.from('negocios').update(updates).eq('id', negocioActual.id);
      if (error) throw error;
      Object.assign(negocioActual, updates);
      setMsgNegocio('✅ Negocio actualizado correctamente.', 'success');
    } else {
      updates.owner_id = session.user.id;
      updates.activo = true;

      const { data, error } = await window.sb.from('negocios').insert([updates]).select().single();
      if (error) throw error;

      negocioActual = data;
      setMsgNegocio('✅ Negocio creado correctamente desde tu panel.', 'success');

      const linkUrl = `${window.location.origin}${window.location.pathname.replace('admin.html','')}barberia.html?id=${negocioActual.id}`;
      document.getElementById('adm-link-url').textContent = linkUrl;
      const linkVer = document.getElementById('adm-link-ver');
      if (linkVer) { linkVer.href = linkUrl; linkVer.style.display = ''; }
      window._linkNegocio = linkUrl;
      
      await Promise.all([cargarCitas(), cargarServicios()]);
    }
    showToast('✓ Cambios guardados.', 'success');
  } catch(err) { setMsgNegocio(err.message, 'error'); }
  finally { setBtnState('btn-guardar-negocio', false); }
}

function setMsgNegocio(texto, tipo) {
  const el = document.getElementById('msg-negocio');
  if (!el) return;
  el.textContent = texto; el.className = `auth-msg ${tipo}`;
  el.style.display = texto ? 'block' : 'none';
}

function copiarLinkNegocio() {
  navigator.clipboard.writeText(window._linkNegocio || '')
    .then(() => showToast('¡Link copiado!', 'success'));
}

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