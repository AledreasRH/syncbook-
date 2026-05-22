/* SyncBook · supabase.js */
const SUPABASE_URL = 'https://unbywwmptsvzqjhntyuy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVuYnl3d21wdHN2enFqaG50eXV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODMyOTYsImV4cCI6MjA5Mjk1OTI5Nn0.ca4JyHmxi5tVnIssOYcvhwpaU4oqzqiueV60uYShyz8';

if (typeof window !== 'undefined') {
  window.sb = (typeof window.supabase !== 'undefined' && window.supabase.createClient)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;
}

/* ── Utilidades globales ──────────────────────────────────────── */
function fechaHoy() { return new Date().toISOString().slice(0,10); }

function formatearFecha(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} de ${meses[parseInt(m,10)-1]} de ${y}`;
}

function calcularHoraFin(horaInicio, minutos) {
  const [hh,mm] = horaInicio.split(':').map(Number);
  const total = hh*60+mm+minutos;
  return `${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
}

function showToast(msg, tipo='info', dur=3500) {
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const t = document.createElement('div');
  t.className=`toast ${tipo}`; t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.animation='toastIn .3s ease reverse'; setTimeout(()=>t.remove(),300); }, dur);
}

function initNavbar(activa) {
  const toggle=document.getElementById('nav-toggle');
  const links=document.getElementById('nav-links');
  const actions=document.getElementById('nav-actions');
  toggle?.addEventListener('click',()=>{
    links?.classList.toggle('open');
    actions?.classList.toggle('open');
    toggle.textContent=links?.classList.contains('open')?'✕':'☰';
  });
  if (activa) {
    document.querySelectorAll('.navbar-links a').forEach(a=>{
      a.classList.remove('active');
      if(a.getAttribute('href')===activa) a.classList.add('active');
    });
  }
}

function setBtnState(btnId, loading, txt='Cargando...') {
  const btn=document.getElementById(btnId);
  const t=btn?.querySelector('.btn-text');
  const l=btn?.querySelector('.btn-loader');
  if(!btn) return;
  btn.disabled=loading;
  t?.classList.toggle('hidden',loading);
  if(l){l.classList.toggle('hidden',!loading);if(loading)l.innerHTML=`<span class="spinner"></span> ${txt}`;}
}

/* Obtener sesión y negocio del usuario actual */
async function getSesionYNegocio() {
  if (!window.sb) return { session:null, negocio:null };
  const { data:{session} } = await window.sb.auth.getSession();
  if (!session) return { session:null, negocio:null };
  const { data:negocio } = await window.sb
    .from('negocios').select('*').eq('owner_id', session.user.id).single();
  return { session, negocio: negocio || null };
}
