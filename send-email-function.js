/* Función auxiliar para enviar emails de confirmación de citas */
async function enviarEmailConfirmacion(cita) {
  try {
    let emailCliente = cita.cliente_email;
    if (!emailCliente && cita.cliente_id) {
      const { data: usuario } = await window.sb.from('usuarios').select('email').eq('id', cita.cliente_id).single();
      emailCliente = usuario?.email;
    }
    if (!emailCliente) return;
    
    const horaFin = calcularHoraFin(cita.hora_inicio, cita.servicios?.duracion_minutos || 30);
    const emailData = {
      to: emailCliente,
      subject: 'Tu cita está confirmada - ' + negocioActual.nombre,
      cliente: cita.cliente_nombre,
      fecha: formatearFecha(cita.fecha),
      hora: cita.hora_inicio + ' - ' + horaFin,
      servicio: cita.servicios?.nombre || 'Servicio',
      precio: cita.servicios?.precio || '0',
      negocio: negocioActual.nombre,
      direccion: negocioActual.direccion || '',
      ciudad: negocioActual.ciudad || '',
      telefono: negocioActual.telefono || '',
      gmaps: negocioActual.ubicacion_gmaps || ''
    };
    
    // Usar función edge de Supabase (configurar en tu proyecto)
    const { error } = await window.sb.functions.invoke('send-email', { body: emailData });
    if (!error) {
      showToast('Email de confirmación enviado', 'success');
    } else {
      console.warn('Email no enviado:', error.message);
      showToast('Cita confirmada (email no pudo ser enviado)', 'info');
    }
  } catch(err) { 
    console.warn('Error al enviar email:', err.message); 
  }
}
