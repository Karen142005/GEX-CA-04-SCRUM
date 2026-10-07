// esto pide los datos al servidor y los pone en el html

async function cargarPagina(clave) {
  try {
    const res = await fetch(`/api/pagina/${clave}`);
    const data = await res.json();
    document.getElementById('titulo').textContent = data.titulo;
    document.getElementById('descripcion').textContent = data.descripcion;
    document.title = `MAR-Z | ${data.titulo}`;
  } catch (e) {
    document.getElementById('titulo').textContent = 'Error al cargar';
  }
}

// arma los botones de roles en el inicio
async function cargarRoles() {
  const cont = document.getElementById('roles');
  if (!cont) return;
  try {
    const res = await fetch('/api/roles');
    const roles = await res.json();
    cont.innerHTML = '';
    roles.forEach(r => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-rol';
      btn.textContent = r.nombre;
      btn.onclick = () => { window.location.href = `/roles/${r.id}`; };
      cont.appendChild(btn);
    });
  } catch (e) {
    cont.innerHTML = '<p>Error al cargar roles</p>';
  }
}

// pagina del rol, solo lo muestra y los botones llevan al login o registro de ese rol
async function initRolPage() {
  const partes = window.location.pathname.split('/');
  const id = partes[partes.length - 1];
  try {
    const res = await fetch(`/api/roles/${id}`);
    if (!res.ok) throw new Error('no encontrado');
    const r = await res.json();
    document.getElementById('titulo').textContent = r.nombre;
    document.getElementById('descripcion').textContent = r.descripcion || '';
    document.title = `MAR-Z | ${r.nombre}`;
  } catch (e) {
    document.getElementById('titulo').textContent = 'Rol no encontrado';
    return;
  }

  document.getElementById('btn-login').onclick = () => {
    window.location.href = `/roles/${id}/login`;
  };
  document.getElementById('btn-registro').onclick = () => {
    window.location.href = `/roles/${id}/registro`;
  };
}

// paginas /roles/:id/login y /roles/:id/registro, mandan el form con su rol
async function initAuthPage() {
  const partes = window.location.pathname.split('/');
  const id = partes[partes.length - 2];
  const accion = partes[partes.length - 1];
  const endpoint = accion === 'registro' ? '/api/registro' : '/api/login';
  try {
    const res = await fetch(`/api/roles/${id}`);
    if (!res.ok) throw new Error('no encontrado');
    const r = await res.json();
    const nombres = document.querySelectorAll('.rol-nombre');
    nombres.forEach(el => { el.textContent = r.nombre; });
    document.querySelector('input[name="rolId"]').value = r.id;
    document.title = `MAR-Z | ${r.nombre}`;
  } catch (e) {
    document.getElementById('titulo').textContent = 'Rol no encontrado';
    return;
  }

  document.getElementById('form-auth').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg-auth');
    const form = new FormData(e.target);
    const data = {};
    form.forEach((v, k) => { data[k] = v; });
    let texto = '';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const out = await res.json();
      if (!res.ok) {
        texto = `Error: ${out.error}`;
      } else if (accion === 'registro') {
        texto = `Cuenta creada: ${out.usuario} (${out.rol}). Ya puedes iniciar sesión.`;
      } else {
        // cada rol va a su pagina, si no tiene va a la pagina del rol
        let destino = '/roles/' + out.rolId;
        if (out.rolId === 1) destino = '/solicitante';
        if (out.rolId === 2) destino = '/agente';
        if (out.rolId === 3) destino = '/coordinador';
        if (out.rolId === 4) destino = '/auditor';
        window.location.href = destino;
        return;
      }
      msg.textContent = texto;
    } catch (err) {
      msg.textContent = 'Error de red.';
    }
  });
}

// pagina del solicitante, revisa la sesion y que sea rol 1, si no manda al inicio
async function initSolicitante() {
  try {
    const res = await fetch('/api/yo');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }
    const yo = await res.json();
    if (yo.rolId !== 1) {
      window.location.href = '/';
      return;
    }
    document.getElementById('nombre').textContent = yo.usuario;
  } catch (e) {
    window.location.href = '/';
    return;
  }

  document.getElementById('btn-salir').onclick = async () => {
    await fetch('/api/salir', { method: 'POST' });
    window.location.href = '/';
  };

  // cambio 1: si elige Alta aparecen justificacion y fecha objetivo
  const selPri = document.getElementById('sol-prioridad');
  selPri.onchange = () => { document.getElementById('campos-alta').hidden = selPri.value !== 'Alta'; };

  // el boton muestra o esconde el formulario
  const formWrap = document.getElementById('form-solicitud-wrap');
  document.getElementById('btn-crear').onclick = () => {
    formWrap.hidden = !formWrap.hidden;
  };

  // manda la solicitud, el id la fecha y el estado los pone el servidor
  document.getElementById('form-solicitud').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('msg-sol');
    const form = new FormData(e.target);
    const data = {};
    form.forEach((v, k) => { data[k] = v; });
    try {
      const res = await fetch('/api/solicitudes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const out = await res.json();
      if (!res.ok) {
        msg.textContent = 'Error: ' + out.error;
      } else {
        msg.textContent = 'Solicitud #' + out.id + ' creada con estado Nuevo.';
        e.target.reset();
        document.getElementById('campos-alta').hidden = true;
        // si el historial esta abierto se vuelve a cargar para que salga la nueva
        if (!document.getElementById('lista-sol-wrap').hidden) cargarHistorial();
      }
    } catch (err) {
      msg.textContent = 'Error de red.';
    }
  });

  // el boton de historial muestra la lista de las mias
  document.getElementById('btn-historial').onclick = () => {
    const wrap = document.getElementById('lista-sol-wrap');
    wrap.hidden = !wrap.hidden;
    // se esconde el detalle para que no se mezclen
    document.getElementById('detalle-sol-wrap').hidden = true;
    if (!wrap.hidden) cargarHistorial();
  };

  document.getElementById('btn-cerrar-det').onclick = () => {
    document.getElementById('detalle-sol-wrap').hidden = true;
  };

  // HU08: confirmar o reabrir la solicitud que esta abierta en el detalle
  document.getElementById('btn-confirmar').onclick = () => { cierre('confirmar'); };
  document.getElementById('btn-reabrir').onclick = () => { cierre('reabrir'); };

  cargarAvisos();
}

let detalleId = null;

// HU08: manda la confirmacion o la reapertura con su motivo
async function cierre(accion) {
  // el mensaje sale dentro del detalle, para que se vea aunque el formulario este cerrado
  const msg = document.getElementById('msg-det');
  const motivo = document.getElementById('motivo-reabrir').value;
  try {
    const res = await fetch('/api/solicitudes/' + detalleId + '/cierre', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, motivo })
    });
    const out = await res.json();
    if (!res.ok) {
      msg.textContent = 'Error: ' + out.error;
    } else {
      msg.textContent = 'Solicitud #' + detalleId + ' quedó ' + out.estado + '.';
      document.getElementById('motivo-reabrir').value = '';
      verDetalle(detalleId);
      if (!document.getElementById('lista-sol-wrap').hidden) cargarHistorial();
    }
  } catch (e) {
    msg.textContent = 'Error de red.';
  }
}

// trae solo mis solicitudes y a cada una le pone su boton de ver
async function cargarHistorial() {
  const ul = document.getElementById('lista-sol');
  try {
    const res = await fetch('/api/solicitudes');
    if (!res.ok) throw new Error();
    const lista = await res.json();
    ul.innerHTML = '';
    if (lista.length === 0) {
      ul.innerHTML = '<li>No tienes solicitudes todavía.</li>';
      return;
    }
    lista.forEach(s => {
      const li = document.createElement('li');
      li.textContent = '#' + s.id + ' ' + s.titulo + ' (' + s.estado + ') ';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Ver';
      btn.onclick = () => { verDetalle(s.id); };
      li.appendChild(btn);
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// abre el detalle de una solicitud con su estado y fechas
async function verDetalle(id) {
  if (id !== detalleId) document.getElementById('msg-det').textContent = '';
  try {
    const res = await fetch('/api/solicitudes/' + id);
    if (!res.ok) throw new Error();
    const s = await res.json();
    document.getElementById('det-titulo').textContent = s.titulo;
    document.getElementById('det-descripcion').textContent = s.descripcion;
    document.getElementById('det-categoria').textContent = s.categoria;
    document.getElementById('det-estado').textContent = s.estado;
    document.getElementById('det-fecha').textContent = new Date(s.fecha).toLocaleString();
    document.getElementById('det-actualizada').textContent = new Date(s.fecha_actualizacion).toLocaleString();
    document.getElementById('detalle-sol-wrap').hidden = false;
    verComentarios(s.id, document.getElementById('det-comentarios'));
    // HU08: solo se puede confirmar o reabrir si esta Resuelta
    detalleId = s.id;
    document.getElementById('det-cierre').hidden = s.estado !== 'Resuelta';
  } catch (e) {
    document.getElementById('msg-sol').textContent = 'No se pudo abrir el detalle.';
  }
}

// pagina del coordinador, solo entra el rol 3, si no manda al inicio
async function initCoordinador() {
  try {
    const res = await fetch('/api/yo');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }
    const yo = await res.json();
    if (yo.rolId !== 3) {
      window.location.href = '/';
      return;
    }
    document.getElementById('nombre').textContent = yo.usuario;
  } catch (e) {
    window.location.href = '/';
    return;
  }

  document.getElementById('btn-salir').onclick = async () => {
    await fetch('/api/salir', { method: 'POST' });
    window.location.href = '/';
  };

  document.getElementById('orden').onchange = () => { cargarTodas(); };
  // los agentes activos se piden una vez para armar el selector de asignar
  try {
    const r = await fetch('/api/agentes');
    agentesActivos = r.ok ? await r.json() : [];
  } catch (e) {
    agentesActivos = [];
  }
  cargarTodas();
}

let agentesActivos = [];

// trae todas ordenadas como se pida y a cada una le deja cambiar la prioridad
async function cargarTodas() {
  const ul = document.getElementById('lista-todas');
  const orden = document.getElementById('orden').value;
  try {
    const res = await fetch('/api/todas-solicitudes?orden=' + orden);
    if (!res.ok) throw new Error();
    const lista = await res.json();
    ul.innerHTML = '';
    if (lista.length === 0) {
      ul.innerHTML = '<li>No hay solicitudes.</li>';
      return;
    }
    lista.forEach(s => {
      const li = document.createElement('li');
      let texto = '#' + s.id + ' ' + s.titulo + ' (' + s.estado + ', ' + s.propietario + ', agente: ' + (s.agente || 'sin asignar');
      if (s.prioridad === 'Alta' && s.fecha_objetivo) {
        texto += ', objetivo: ' + s.fecha_objetivo + ', motivo: ' + s.justificacion;
      }
      li.textContent = texto + ') ';
      const sel = document.createElement('select');
      ['Alta', 'Media', 'Baja'].forEach(p => {
        const op = document.createElement('option');
        op.value = p;
        op.textContent = p;
        if (p === s.prioridad) op.selected = true;
        sel.appendChild(op);
      });
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'Guardar';
      // cambio 1: campos para la prioridad Alta, solo se muestran si se elige Alta
      const just = document.createElement('input');
      just.type = 'text';
      just.placeholder = 'Justificación';
      const fec = document.createElement('input');
      fec.type = 'date';
      const camposAlta = document.createElement('span');
      camposAlta.appendChild(just);
      camposAlta.appendChild(fec);
      camposAlta.hidden = true;
      sel.onchange = () => { camposAlta.hidden = sel.value !== 'Alta'; };
      btn.onclick = () => { guardarPrioridad(s.id, sel.value, just.value, fec.value); };
      const btnHis = document.createElement('button');
      btnHis.type = 'button';
      btnHis.textContent = 'Historial';
      const sub = document.createElement('ul');
      sub.hidden = true;
      btnHis.onclick = () => {
        sub.hidden = !sub.hidden;
        if (!sub.hidden) verHistorial(s.id, sub);
      };
      // HU05: selector de agente activo y boton para asignar
      const selAg = document.createElement('select');
      const vacio = document.createElement('option');
      vacio.value = '';
      vacio.textContent = 'Agente...';
      selAg.appendChild(vacio);
      agentesActivos.forEach(a => {
        const op = document.createElement('option');
        op.value = a;
        op.textContent = a;
        if (a === s.agente) op.selected = true;
        selAg.appendChild(op);
      });
      const btnAsig = document.createElement('button');
      btnAsig.type = 'button';
      btnAsig.textContent = 'Asignar';
      btnAsig.onclick = () => { asignar(s.id, selAg.value); };
      li.appendChild(sel);
      li.appendChild(camposAlta);
      li.appendChild(btn);
      li.appendChild(selAg);
      li.appendChild(btnAsig);
      li.appendChild(btnHis);
      // HU06: el coordinador puede leer los comentarios
      const btnCom = document.createElement('button');
      btnCom.type = 'button';
      btnCom.textContent = 'Comentarios';
      const subCom = document.createElement('ul');
      subCom.hidden = true;
      btnCom.onclick = () => {
        subCom.hidden = !subCom.hidden;
        if (!subCom.hidden) verComentarios(s.id, subCom);
      };
      li.appendChild(btnCom);
      li.appendChild(sub);
      li.appendChild(subCom);
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// guarda la prioridad nueva y vuelve a cargar la lista
async function guardarPrioridad(id, prioridad, justificacion, fecha_objetivo) {
  const msg = document.getElementById('msg-coord');
  try {
    const res = await fetch('/api/solicitudes/' + id + '/prioridad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prioridad, justificacion, fecha_objetivo })
    });
    const out = await res.json();
    if (!res.ok) {
      msg.textContent = 'Error: ' + out.error;
    } else {
      msg.textContent = 'Solicitud #' + id + ' ahora es ' + out.nueva + ' (antes ' + out.anterior + ').';
      cargarTodas();
    }
  } catch (e) {
    msg.textContent = 'Error de red.';
  }
}

// muestra los cambios que tuvo una solicitud
async function verHistorial(id, ul) {
  try {
    const res = await fetch('/api/solicitudes/' + id + '/historial');
    if (!res.ok) throw new Error();
    const lista = await res.json();
    ul.innerHTML = '';
    if (lista.length === 0) {
      ul.innerHTML = '<li>Sin cambios todavía.</li>';
      return;
    }
    lista.forEach(h => {
      const li = document.createElement('li');
      li.textContent = h.campo + ': ' + (h.valor_anterior || '-') + ' pasa a ' + h.valor_nuevo + ' (por ' + h.usuario + ', ' + new Date(h.fecha).toLocaleString() + ')';
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// HU05: asigna la solicitud al agente elegido
async function asignar(id, agente) {
  const msg = document.getElementById('msg-coord');
  if (!agente) {
    msg.textContent = 'Error: elige un agente.';
    return;
  }
  try {
    const res = await fetch('/api/solicitudes/' + id + '/asignar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agente })
    });
    const out = await res.json();
    if (!res.ok) {
      msg.textContent = 'Error: ' + out.error;
    } else {
      msg.textContent = 'Solicitud #' + id + ' asignada a ' + out.agente + ' (antes ' + out.anterior + ').';
      cargarTodas();
    }
  } catch (e) {
    msg.textContent = 'Error de red.';
  }
}

// pagina del agente, solo entra el rol 2, si no manda al inicio
async function initAgente() {
  try {
    const res = await fetch('/api/yo');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }
    const yo = await res.json();
    if (yo.rolId !== 2) {
      window.location.href = '/';
      return;
    }
    document.getElementById('nombre').textContent = yo.usuario;
  } catch (e) {
    window.location.href = '/';
    return;
  }

  document.getElementById('btn-salir').onclick = async () => {
    await fetch('/api/salir', { method: 'POST' });
    window.location.href = '/';
  };

  cargarAvisos();
  cargarAsignadas();
}

// HU05: avisos dentro de la aplicacion
async function cargarAvisos() {
  const ul = document.getElementById('lista-avisos');
  try {
    const res = await fetch('/api/notificaciones');
    if (!res.ok) throw new Error();
    const lista = await res.json();
    ul.innerHTML = '';
    if (lista.length === 0) {
      ul.innerHTML = '<li>No tienes avisos.</li>';
      return;
    }
    lista.forEach(n => {
      const li = document.createElement('li');
      li.textContent = (n.leida ? '' : '(nuevo) ') + n.mensaje + ' - ' + new Date(n.fecha).toLocaleString();
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// HU05: solicitudes asignadas al agente
async function cargarAsignadas() {
  const ul = document.getElementById('lista-asignadas');
  try {
    const res = await fetch('/api/asignadas');
    if (!res.ok) throw new Error();
    const lista = await res.json();
    ul.innerHTML = '';
    if (lista.length === 0) {
      ul.innerHTML = '<li>No tienes solicitudes asignadas.</li>';
      return;
    }
    lista.forEach(s => {
      const li = document.createElement('li');
      li.textContent = '#' + s.id + ' ' + s.titulo + ' (' + s.estado + ', prioridad ' + s.prioridad + ', asignada por ' + s.asignado_por + ' el ' + new Date(s.fecha_asignacion).toLocaleString() + ') ';
      // HU06: comentarios de trabajo
      const btnCom = document.createElement('button');
      btnCom.type = 'button';
      btnCom.textContent = 'Comentarios';
      const caja = document.createElement('div');
      caja.hidden = true;
      const subCom = document.createElement('ul');
      const txt = document.createElement('textarea');
      txt.placeholder = 'Escribe el avance...';
      const btnEnviar = document.createElement('button');
      btnEnviar.type = 'button';
      btnEnviar.textContent = 'Comentar';
      btnEnviar.onclick = () => { comentar(s.id, txt, subCom); };
      caja.appendChild(subCom);
      caja.appendChild(txt);
      caja.appendChild(btnEnviar);
      btnCom.onclick = () => {
        caja.hidden = !caja.hidden;
        if (!caja.hidden) verComentarios(s.id, subCom);
      };
      // HU07: solo se ofrecen los estados permitidos desde el estado actual
      if (s.siguientes.length > 0) {
        const selEst = document.createElement('select');
        s.siguientes.forEach(e => {
          const op = document.createElement('option');
          op.value = e;
          op.textContent = e;
          selEst.appendChild(op);
        });
        const btnEst = document.createElement('button');
        btnEst.type = 'button';
        btnEst.textContent = 'Cambiar estado';
        btnEst.onclick = () => { cambiarEstado(s.id, selEst.value); };
        li.appendChild(selEst);
        li.appendChild(btnEst);
      }
      li.appendChild(btnCom);
      li.appendChild(caja);
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// HU06: muestra los comentarios de una solicitud (autor y fecha los pone el sistema)
async function verComentarios(id, ul) {
  try {
    const res = await fetch('/api/solicitudes/' + id + '/comentarios');
    if (!res.ok) throw new Error();
    const lista = await res.json();
    ul.innerHTML = '';
    if (lista.length === 0) {
      ul.innerHTML = '<li>Sin comentarios todavía.</li>';
      return;
    }
    lista.forEach(c => {
      const li = document.createElement('li');
      li.textContent = c.autor + ' (' + new Date(c.fecha).toLocaleString() + '): ' + c.texto;
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// HU06: el agente guarda un comentario; una vez guardado no se puede editar
async function comentar(id, txt, ul) {
  const msg = document.getElementById('msg-agente');
  try {
    const res = await fetch('/api/solicitudes/' + id + '/comentarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: txt.value })
    });
    const out = await res.json();
    if (!res.ok) {
      msg.textContent = 'Error: ' + out.error;
    } else {
      msg.textContent = 'Comentario guardado en la solicitud #' + id + '.';
      txt.value = '';
      verComentarios(id, ul);
    }
  } catch (e) {
    msg.textContent = 'Error de red.';
  }
}

// HU07: el agente cambia el estado y se recarga su lista
async function cambiarEstado(id, estado) {
  const msg = document.getElementById('msg-agente');
  try {
    const res = await fetch('/api/solicitudes/' + id + '/estado', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    const out = await res.json();
    if (!res.ok) {
      msg.textContent = 'Error: ' + out.error;
    } else {
      msg.textContent = 'Solicitud #' + id + ' pasó de ' + out.anterior + ' a ' + out.nuevo + '.';
      cargarAsignadas();
    }
  } catch (e) {
    msg.textContent = 'Error de red.';
  }
}

// ---------------- Sprint 3 ----------------

// pagina del auditor, solo entra el rol 4, si no manda al inicio
async function initAuditor() {
  try {
    const res = await fetch('/api/yo');
    if (!res.ok) {
      window.location.href = '/';
      return;
    }
    const yo = await res.json();
    if (yo.rolId !== 4) {
      window.location.href = '/';
      return;
    }
    document.getElementById('nombre').textContent = yo.usuario;
  } catch (e) {
    window.location.href = '/';
    return;
  }

  document.getElementById('btn-salir').onclick = async () => {
    await fetch('/api/salir', { method: 'POST' });
    window.location.href = '/';
  };

  document.getElementById('btn-auditar').onclick = cargarAuditoria;
  cargarAuditoria();
}

// HU11: historial de solo lectura, con el actor codificado
async function cargarAuditoria() {
  const cont = document.getElementById('tabla-auditoria');
  const msg = document.getElementById('msg-auditor');
  const id = document.getElementById('aud-solicitud').value.trim();
  msg.textContent = '';
  try {
    const res = await fetch('/api/auditoria' + (id ? '?solicitud=' + encodeURIComponent(id) : ''));
    const d = await res.json();
    if (!res.ok) {
      msg.textContent = 'Error: ' + d.error;
      return;
    }
    cont.innerHTML = '';
    if (d.length === 0) {
      cont.textContent = 'Sin cambios registrados.';
      return;
    }
    const tabla = document.createElement('table');
    tabla.innerHTML = '<tr><th>Solicitud</th><th>Fecha</th><th>Actor</th><th>Campo</th><th>Valor anterior</th><th>Valor nuevo</th></tr>';
    d.forEach(h => {
      const tr = document.createElement('tr');
      [ '#' + h.solicitud_id, new Date(h.fecha).toLocaleString(), h.actor, h.campo, h.valor_anterior || '-', h.valor_nuevo || '-' ]
        .forEach(v => {
          const td = document.createElement('td');
          td.textContent = v;
          tr.appendChild(td);
        });
      tabla.appendChild(tr);
    });
    cont.appendChild(tabla);
  } catch (e) {
    msg.textContent = 'Error de red.';
  }
}
