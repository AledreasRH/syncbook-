/* SyncBook · mis-citas.js */
let misCitas=[], citaACancelar=null, usuarioActual=null, _tickTimer=null;
window.addEventListener('DOMContentLoaded', async () => {
  initNavbar('mis-citas.html');
  if (!window.sb) { mostrarSinSesion(); return; }
  const { data:{session} } = await window.sb.auth.getSession();
  if (!session) { mostrarSinSesion(); return; }
  usuarioActual = session.user;
  document.getElementById('nav-email').textContent = session.user.email;
  document.getElementById('btn-logout')?.addEventListener('click', async()=>{ await window.sb.auth.signOut(); window.location.href='login.html'; });
  document.getElementById('vista-sin-sesion').classList.add('hidden');
  document.getElementById('vista-con-sesion').classList.remove('hidden');
  document.querySelectorAll('.mc-tab').forEach(t=>t.addEventListener('click',()=>cambiarTab(t.dataset.panel)));
  document.getElementById('mc-cerrar')?.addEventListener('click', cerrarModal);
  document.getElementById('mc-no')?.addEventListener('click', cerrarModal);
  document.getElementById('mc-si')?.addEventListener('click', confirmarCancelacion);
  document.getElementById('modal-cancelar')?.addEventListener('click',e=>{ if(e.target.id==='modal-cancelar') cerrarModal(); });
  await cargarCitas();
  // Re-distribuir automáticamente cada minuto para mover citas que ya pasaron
  _tickTimer = setInterval(() => distribuir(), 60 * 1000);
});
function mostrarSinSesion(){ document.getElementById('vista-sin-sesion')?.classList.remove('hidden'); document.getElementById('vista-con-sesion')?.classList.add('hidden'); }
async function cargarCitas(){
  try {
    const { data,error } = await window.sb.from('citas')
      .select('id,fecha,hora_inicio,hora_fin,estado,cliente_nombre,notas,servicios(nombre,precio,duracion_minutos),negocios(nombre)')
      .eq('cliente_id',usuarioActual.id).order('fecha',{ascending:false});
    if (error) throw error;
    misCitas = data||[];
    distribuir();
  } catch(err){ console.error(err); misCitas=[]; distribuir(); }
}
function citaYaPaso(c) {
  // Construye un Date comparable: "2025-07-15T18:30" usando hora_fin (o hora_inicio como fallback)
  const horaRef = c.hora_fin || c.hora_inicio || '23:59';
  const dt = new Date(`${c.fecha}T${horaRef}`);
  return dt < new Date();
}
function distribuir(){
  const prox=misCitas.filter(c=>!citaYaPaso(c)&&c.estado!=='cancelada');
  const pas=misCitas.filter(c=>citaYaPaso(c)||c.estado==='cancelada');
  document.getElementById('badge-proximas').textContent=prox.length;
  document.getElementById('badge-pasadas').textContent=pas.length;
  renderCitas('lista-proximas','empty-proximas',prox,true);
  renderCitas('lista-pasadas','empty-pasadas',pas,false);
}
function renderCitas(listaId,emptyId,citas,canCancel){
  const l=document.getElementById(listaId),e=document.getElementById(emptyId);
  l.innerHTML='';
  if(!citas.length){ e?.classList.remove('hidden'); return; }
  e?.classList.add('hidden');
  citas.forEach((c,i)=>{
    const card=document.createElement('div');
    card.className=`mc-card${c.estado==='cancelada'?' cancelada':''}`;
    card.style.animationDelay=`${i*70}ms`;
    const sn=c.servicios?.nombre||'Servicio', neg=c.negocios?.nombre||'';
    const sp=c.servicios?.precio?`$${c.servicios.precio}`:'', sd=c.servicios?.duracion_minutos?`${c.servicios.duracion_minutos} min`:'';
    card.innerHTML=`
      <div class="mc-card-top">
        <div><div class="mc-serv-nombre">${sn}</div>${neg?`<div class="mc-neg-nombre">📍 ${neg}</div>`:''}</div>
        <span class="chip-estado chip-${c.estado}">${c.estado}</span>
      </div>
      <div class="mc-card-body">
        <div class="mc-info-row"><span class="mc-info-icon">📅</span><div><span>${formatearFecha(c.fecha)}</span><span class="mc-info-label">Fecha</span></div></div>
        <div class="mc-info-row"><span class="mc-info-icon">🕐</span><div><span>${c.hora_inicio} – ${c.hora_fin} hs</span><span class="mc-info-label">Horario</span></div></div>
        ${sd?`<div class="mc-info-row"><span class="mc-info-icon">⏱</span><div><span>${sd}</span><span class="mc-info-label">Duración</span></div></div>`:''}
        ${sp?`<div class="mc-info-row"><span class="mc-info-icon">💲</span><div><span>${sp}</span><span class="mc-info-label">Precio</span></div></div>`:''}
      </div>
      ${canCancel&&c.estado==='pendiente'?`<div class="mc-card-foot"><button class="btn btn-white btn-sm" onclick="abrirModalCancelar('${c.id}')">Cancelar cita</button></div>`:''}`;
    l.appendChild(card);
  });
}
function cambiarTab(panel){
  document.querySelectorAll('.mc-tab').forEach(t=>t.classList.toggle('active',t.dataset.panel===panel));
  document.querySelectorAll('.mc-panel').forEach(p=>p.classList.toggle('hidden',p.id!==`panel-${panel}`));
}
function abrirModalCancelar(id){
  citaACancelar=misCitas.find(c=>c.id===id);
  if(!citaACancelar) return;
  document.getElementById('mc-detalle').innerHTML=`<strong>${citaACancelar.servicios?.nombre||'Servicio'}</strong><br>📅 ${formatearFecha(citaACancelar.fecha)} a las ${citaACancelar.hora_inicio} hs`;
  document.getElementById('modal-cancelar').classList.remove('hidden');
}
function cerrarModal(){ document.getElementById('modal-cancelar').classList.add('hidden'); citaACancelar=null; }
async function confirmarCancelacion(){
  if(!citaACancelar) return;
  try {
    const {error}=await window.sb.from('citas').update({estado:'cancelada'}).eq('id',citaACancelar.id);
    if(error) throw error;
    const idx=misCitas.findIndex(c=>c.id===citaACancelar.id);
    if(idx!==-1) misCitas[idx].estado='cancelada';
    cerrarModal(); distribuir(); showToast('Cita cancelada.','info');
  } catch(err){ showToast(err.message,'error'); }
}