/* SyncBook · confirmacion.js */
window.addEventListener('DOMContentLoaded', () => {
  initNavbar('');
  const raw = sessionStorage.getItem('syncbook_conf');
  if (!raw) {
    document.getElementById('ticket-wrap')?.classList.add('hidden');
    document.getElementById('sin-datos')?.classList.remove('hidden');
    return;
  }
  let d;
  try { d = JSON.parse(raw); } catch { document.getElementById('sin-datos')?.classList.remove('hidden'); return; }
  set('c-negocio',  d.negocio   || '—');
  set('c-servicio', d.servicio  || '—');
  set('c-duracion', d.duracion  ? `${d.duracion} minutos` : '—');
  set('c-precio',   d.precio    ? `$${d.precio}` : '—');
  set('c-nombre',   d.nombre    || '—');
  set('c-tel',      d.tel       || '—');
  set('c-fecha',    d.fecha     ? formatearFecha(d.fecha) : '—');
  set('c-hora',     (d.hora && d.horaFin) ? `${d.hora} – ${d.horaFin} hs` : d.hora || '—');
  if (d.notas) { set('c-notas', d.notas); const r=document.getElementById('c-notas-row'); if(r) r.style.display='flex'; }
  const bc = document.getElementById('barcode');
  if (bc) [38,22,34,18,38,28,14,38,20,32,38,16,28,38,12,36,24,38,20,30].forEach(h => {
    const b=document.createElement('div'); b.className='barcode-bar'; b.style.height=`${h}px`; bc.appendChild(b);
  });
});
function set(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }
