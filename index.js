/* SyncBook · index.js */
let todosNegocios = [];

window.addEventListener('DOMContentLoaded', () => {
  initNavbar('index.html');
  cargarNegocios();
  document.getElementById('filtro-negocio')?.addEventListener('input', filtrarNegocios);
  document.getElementById('hero-buscar')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('negocios').scrollIntoView({ behavior: 'smooth' });
  });
});

async function cargarNegocios() {
  const grid = document.getElementById('lista-negocios');
  if (!window.sb) { grid.innerHTML = '<p style="color:var(--gray-500);grid-column:1/-1;text-align:center">No se pudo conectar con Supabase.</p>'; return; }
  try {
    const { data, error } = await window.sb
      .from('negocios')
      .select('id, nombre, descripcion, ciudad, logo_url, slug')
      .eq('activo', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    todosNegocios = data || [];
    renderNegocios(todosNegocios);
  } catch (err) {
    document.getElementById('lista-negocios').innerHTML = `<p style="color:var(--gray-500);grid-column:1/-1;text-align:center">Error al cargar barberías: ${err.message}</p>`;
  }
}

function renderNegocios(lista) {
  const grid  = document.getElementById('lista-negocios');
  const empty = document.getElementById('negocios-vacio');
  grid.innerHTML = '';
  if (!lista.length) { empty?.classList.remove('hidden'); return; }
  empty?.classList.add('hidden');
  lista.forEach((n, i) => {
    const card = document.createElement('a');
    card.className = 'neg-card';
    card.href = `barberia.html?id=${n.id}`;
    card.style.animationDelay = `${i * 80}ms`;
    card.innerHTML = `
      <div class="neg-card-cover">
        ${n.logo_url ? `<img src="${n.logo_url}" style="width:100%;height:100%;object-fit:cover" alt="${n.nombre}">` : '💈'}
      </div>
      <div class="neg-card-body">
        <div class="neg-nombre">${n.nombre}</div>
        <div class="neg-ciudad">📍 ${n.ciudad || 'Sin ubicación'}</div>
        <div class="neg-meta">
          <span class="neg-servicios-count">${n.descripcion ? n.descripcion.slice(0,60)+'...' : 'Reservá tu turno online'}</span>
          <span class="badge badge-green">Activa</span>
        </div>
      </div>`;
    grid.appendChild(card);
  });
}

function filtrarNegocios() {
  const q = document.getElementById('filtro-negocio').value.toLowerCase();
  const filtrados = todosNegocios.filter(n =>
    n.nombre.toLowerCase().includes(q) || (n.ciudad || '').toLowerCase().includes(q)
  );
  renderNegocios(filtrados);
}
