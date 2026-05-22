/* SyncBook · login.js */
let tipoSeleccionado = 'cliente';

window.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión → redirigir
  if (window.sb) {
    window.sb.auth.getSession().then(({ data }) => {
      if (data.session) redirigirSegunRol(data.session.user);
    });
  }
  initTipoBtns();
  document.getElementById('feat-admin')?.classList.add('hidden');
  initPassEyes();
  initFieldValidation();
  document.getElementById('form-login')?.addEventListener('submit', handleLogin);
  document.getElementById('form-registro')?.addEventListener('submit', handleRegistro);
});

function cambiarTab(tab) {
  const esLogin = tab === 'login';
  document.getElementById('panel-login').classList.toggle('hidden', !esLogin);
  document.getElementById('panel-registro').classList.toggle('hidden', esLogin);
  document.getElementById('tab-login').classList.toggle('active', esLogin);
  document.getElementById('tab-registro').classList.toggle('active', !esLogin);
  document.getElementById('auth-title').textContent = esLogin ? 'Bienvenido de vuelta 👋' : 'Crear cuenta gratis';
  document.getElementById('auth-subtitle').textContent = esLogin ? 'Ingresá a tu cuenta para continuar.' : 'Empezá hoy, sin tarjeta de crédito.';
  ['msg-login','msg-registro'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.style.display='none'; el.textContent=''; }
  });
}

function initTipoBtns() {
  document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      tipoSeleccionado = btn.dataset.tipo;
      const esDueno = tipoSeleccionado === 'dueno';
      const badge = document.getElementById('tipo-badge');
      document.getElementById('tipo-badge-ico').textContent = esDueno ? '💈' : '👤';
      document.getElementById('tipo-badge-txt').textContent = esDueno ? 'Barbero / Dueño de negocio' : 'Cliente';
      badge.className = `tipo-badge tipo-${tipoSeleccionado}`;
      document.getElementById('feat-admin')?.classList.toggle('hidden', !esDueno);
    });
  });
}

function initPassEyes() {
  document.querySelectorAll('.pass-eye').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = document.getElementById(btn.dataset.target);
      if (!inp) return;
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });
}

function initFieldValidation() {
  document.querySelectorAll('input[data-tipo]').forEach(input => {
    input.addEventListener('input', () => validarInputSegunTipo(input));
    input.addEventListener('keydown', e => {
      if (e.key.length === 1 && !permitirCaracterSegunTipo(e.key, input.dataset.tipo)) {
        e.preventDefault();
      }
    });
  });
}

function validarInputSegunTipo(input) {
  if (!input.dataset.tipo) return;
  const valor = input.value;
  let limpio = valor;
  if (input.dataset.tipo === 'letras') {
    limpio = valor.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, '');
  } else if (input.dataset.tipo === 'telefono') {
    limpio = valor.replace(/[^0-9+\s()\-]/g, '');
  }
  if (limpio !== valor) input.value = limpio;
}

function permitirCaracterSegunTipo(char, tipo) {
  if (!tipo) return true;
  if (tipo === 'letras') return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]$/.test(char);
  if (tipo === 'telefono') return /^[0-9+\s()\-]$/.test(char);
  return true;
}

function permitirTextoSegunTipo(texto, tipo) {
  if (!tipo) return true;
  if (tipo === 'letras') return /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]*$/.test(texto);
  if (tipo === 'telefono') return /^[0-9+\s()\-]*$/.test(texto);
  return true;
}

/* ── LOGIN ── */
async function handleLogin(e) {
  e.preventDefault();
  if (!window.sb) return;
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  document.getElementById('err-l-email').textContent = '';
  document.getElementById('err-l-pass').textContent  = '';
  if (!email) { document.getElementById('err-l-email').textContent = 'Ingresá tu email.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { document.getElementById('err-l-email').textContent = 'Email inválido.'; return; }
  if (!pass)  { document.getElementById('err-l-pass').textContent  = 'Ingresá tu contraseña.'; return; }

  setBtnState('btn-login', true, 'Verificando...');
  setMsg('msg-login', '', '');
  try {
    const { data, error } = await window.sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    setMsg('msg-login', '✅ ¡Bienvenido! Redirigiendo...', 'success');
    setTimeout(() => redirigirSegunRol(data.user), 800);
  } catch (err) {
    const m = (err.message?.includes('Invalid') || err.message?.includes('invalid'))
      ? 'Email o contraseña incorrectos.' : err.message || 'Error al ingresar.';
    setMsg('msg-login', m, 'error');
  } finally { setBtnState('btn-login', false); }
}

/* ── REGISTRO ── */
async function handleRegistro(e) {
  e.preventDefault();
  if (!window.sb) return;
  const nombre   = document.getElementById('r-nombre').value.trim();
  const apellido = document.getElementById('r-apellido').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const tel      = document.getElementById('r-tel').value.trim();
  const pass     = document.getElementById('r-pass').value;

  ['err-r-nombre','err-r-apellido','err-r-email','err-r-tel','err-r-pass'].forEach(id => document.getElementById(id).textContent = '');
  let ok = true;
  if (!nombre || nombre.length < 2 || !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(nombre)) {
    document.getElementById('err-r-nombre').textContent = 'Ingresá un nombre válido. Solo letras y espacios.';
    ok = false;
  }
  if (apellido && !/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/.test(apellido)) {
    document.getElementById('err-r-apellido').textContent = 'Apellido inválido. Solo letras y espacios.';
    ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    document.getElementById('err-r-email').textContent  = 'Email inválido.';
    ok = false;
  }
  if (tel && !/^[0-9+\s()\-]+$/.test(tel)) {
    document.getElementById('err-r-tel').textContent = 'Teléfono inválido. Usá sólo números y símbolos + - ( ).';
    ok = false;
  }
  if (!pass  || pass.length < 6) {
    document.getElementById('err-r-pass').textContent   = 'Mínimo 6 caracteres.';
    ok = false;
  }
  if (!ok) return;

  setBtnState('btn-registro', true, 'Creando cuenta...');
  setMsg('msg-registro', '', '');
  try {
    const nombreCompleto = apellido ? `${nombre} ${apellido}` : nombre;
    const { data, error } = await window.sb.auth.signUp({
      email, password: pass,
      options: { data: { nombre_completo: nombreCompleto, telefono: tel || '', rol: tipoSeleccionado } }
    });
    if (error) throw error;

    // Guardar en tabla usuarios
    if (data.user) {
      try {
        await window.sb.from('usuarios').upsert([{
          id: data.user.id, nombre_completo: nombreCompleto,
          telefono: tel || null, rol: tipoSeleccionado
        }], { onConflict: 'id' });
      } catch (e) { console.warn('tabla usuarios:', e.message); }
    }

    if (data.session) {
      // Sin confirmación de email → redirigir inmediatamente
      setMsg('msg-registro', '✅ Cuenta creada. Redirigiendo...', 'success');
      setTimeout(() => redirigirSegunRol(data.user), 800);
    } else {
      // Con confirmación de email
      setMsg('msg-registro',
        '✅ ¡Cuenta creada! Revisá tu email para confirmar tu cuenta y luego ingresá. (Si no llega, verificá la carpeta de spam.)',
        'success'
      );
      document.getElementById('form-registro').reset();
    }
  } catch (err) {
    let m = err.message || 'Error al crear la cuenta.';
    if (err.message?.includes('already registered')) {
      m = 'Ese email ya está registrado. Intentá ingresar.';
    } else if (err.message?.toLowerCase().includes('rate limit')) {
      m = 'Se superó el límite de envío de correos. Esperá unos minutos o probá con otro email.';
    }
    setMsg('msg-registro', m, 'error');
  } finally { setBtnState('btn-registro', false); }
}

/* ── REDIRECCIÓN ── */
async function redirigirSegunRol(user) {
  // Obtenemos el rol del metadata del usuario
  let rol = user.user_metadata?.rol;

  // Si no está en el metadata, buscamos en la tabla de usuarios (por seguridad)
  if (!rol) {
    const { data: u } = await window.sb.from('usuarios').select('rol').eq('id', user.id).single();
    if (u) rol = u.rol;
  }

  // Lógica de redirección estricta
  const esDueno = rol === 'admin' || rol === 'dueno';
  if (esDueno) {
    window.location.href = 'admin.html';
  } else {
    // Los clientes van a sus citas personales
    window.location.href = 'mis-citas.html';
  }
}

function setMsg(id, texto, tipo) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = texto; el.className = `auth-msg ${tipo}`;
  el.style.display = texto ? 'block' : 'none';
}
