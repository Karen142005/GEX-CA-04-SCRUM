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
      li.textContent = '#' + s.id + ' ' + s.titulo + ' (' + s.estado + ', ' + s.propietario + ', agente: ' + (s.agente || 'sin asignar') + ') ';
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
      btn.onclick = () => { guardarPrioridad(s.id, sel.value); };
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
      li.appendChild(btn);
      li.appendChild(selAg);
      li.appendChild(btnAsig);
      li.appendChild(btnHis);
      li.appendChild(sub);
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}

// guarda la prioridad nueva y vuelve a cargar la lista
async function guardarPrioridad(id, prioridad) {
  const msg = document.getElementById('msg-coord');
  try {
    const res = await fetch('/api/solicitudes/' + id + '/prioridad', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prioridad })
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
      li.textContent = h.campo + ': ' + h.valor_anterior + ' pasa a ' + h.valor_nuevo + ' (por ' + h.usuario + ', ' + new Date(h.fecha).toLocaleString() + ')';
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
      li.textContent = '#' + s.id + ' ' + s.titulo + ' (' + s.estado + ', prioridad ' + s.prioridad + ', asignada por ' + s.asignado_por + ' el ' + new Date(s.fecha_asignacion).toLocaleString() + ')';
      ul.appendChild(li);
    });
  } catch (e) {
    ul.innerHTML = '<li>Error al cargar.</li>';
  }
}
