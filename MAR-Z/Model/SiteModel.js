// los datos salen de postgres, los textos fijos estan aca mismo
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

// HU07: cambios de estado que puede hacer el agente
// (Nuevo -> Asignada lo hace la asignacion; Resuelta -> Cerrada o Reabierta lo hace el solicitante)
const TRANSICIONES_AGENTE = {
  'Asignada': ['En progreso'],
  'En progreso': ['Resuelta'],
  'Reabierta': ['En progreso']
};

// cambio 1: si la prioridad es Alta se exige justificacion y una fecha objetivo valida (hoy o despues)
function validarAlta(justificacion, fechaObjetivo) {
  const j = (justificacion || '').trim();
  const f = (fechaObjetivo || '').trim();
  if (!j || !f) return { error: 'La prioridad Alta requiere justificacion y fecha objetivo' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f) || isNaN(new Date(f + 'T00:00:00'))) return { error: 'Fecha objetivo invalida' };
  const hoy = new Date();
  const hoyTxt = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
  if (f < hoyTxt) return { error: 'La fecha objetivo no puede estar en el pasado' };
  return { justificacion: j, fechaObjetivo: f };
}

const paginas = {
  inicio: {
    titulo: 'Bienvenido a MAR-Z',
    descripcion: ''
  },
  nosotros: {
    titulo: 'Nosotros',
    descripcion: ''
  },
  iniciar: {
    titulo: 'Iniciar sesión',
    descripcion: ''
  }
};

// los roles estan en la tabla tipos_usuario
async function getServicios() {
  const r = await pool.query(
    'SELECT id_tipo AS id, nombre, prefijo FROM tipos_usuario ORDER BY id_tipo'
  ); 
  return r.rows;
}

async function getServicioById(id) {
  const r = await pool.query(
    'SELECT id_tipo AS id, nombre, prefijo FROM tipos_usuario WHERE id_tipo = $1',
    [Number(id)]
  );
  return r.rows[0];
}

module.exports = {
  getPagina: (clave) => paginas[clave],
  getServicios,
  getServicioById,

  // guarda el usuario con su rol, la clave se guarda con hash
  // el codigo se arma con el prefijo del rol + la hora, ej: S-LZ4X1
  createUser: async ({ usuario, nombre, email, clave, rolId }) => {
    const name = (usuario || nombre || '').trim();
    const mail = (email || '').trim();
    if (!name || !mail || !clave || !rolId) return { error: 'Faltan datos' };
    const rol = await getServicioById(rolId);
    if (!rol) return { error: 'Rol no existe' };
    const hash = await bcrypt.hash(clave, 10);
    const codigo = `${rol.prefijo}-${Date.now().toString(36).toUpperCase()}`;
    try {
      const r = await pool.query(
        'INSERT INTO usuarios (codigo, nombre_usuario, correo_electronico, clave_hash, id_tipo) VALUES ($1, $2, $3, $4, $5) RETURNING nombre_usuario',
        [codigo, name, mail, hash, rol.id]
      );
      return { usuario: r.rows[0].nombre_usuario, rolId: rol.id };
    } catch (e) {
      if (e.code === '23505') return { error: 'Ese usuario o correo ya existe' };
      throw e;
    }
  },

  // revisa que el usuario y la clave sean de ese rol
  validateUser: async ({ usuario, nombre, clave, rolId }) => {
    const name = (usuario || nombre || '').trim();
    if (!name || !clave || !rolId) return { error: 'Faltan datos' };
    const r = await pool.query(
      'SELECT nombre_usuario, clave_hash, id_tipo FROM usuarios WHERE nombre_usuario = $1 AND id_tipo = $2',
      [name, Number(rolId)]
    );
    const u = r.rows[0];
    if (!u) return { error: 'Credenciales invalidas' };
    const ok = await bcrypt.compare(clave, u.clave_hash);
    if (!ok) return { error: 'Credenciales invalidas' };
    const rol = await getServicioById(u.id_tipo);
    return { usuario: u.nombre_usuario, rolId: u.id_tipo, rol: rol ? rol.nombre : '' };
  },

  // guarda la solicitud, el id y la fecha los pone la bd y el estado nace Nuevo
  // cambio 1: se puede elegir prioridad; si es Alta pide justificacion y fecha objetivo
  crearSolicitud: async ({ titulo, descripcion, categoria, propietario, prioridad, justificacion, fecha_objetivo }) => {
    const t = (titulo || '').trim();
    const d = (descripcion || '').trim();
    const c = (categoria || '').trim();
    if (!t || !d || !c || !propietario) return { error: 'Faltan datos' };
    const p = prioridad || 'Media';
    if (!['Alta', 'Media', 'Baja'].includes(p)) return { error: 'Prioridad invalida' };
    let j = null;
    let f = null;
    if (p === 'Alta') {
      const v = validarAlta(justificacion, fecha_objetivo);
      if (v.error) return v;
      j = v.justificacion;
      f = v.fechaObjetivo;
    }
    const r = await pool.query(
      'INSERT INTO solicitudes (titulo, descripcion, categoria, propietario, prioridad, justificacion, fecha_objetivo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, fecha, estado',
      [t, d, c, propietario, p, j, f]
    );
    return r.rows[0];
  },

  // trae solo las solicitudes del usuario que entra, las mas nuevas primero
  misSolicitudes: async (propietario) => {
    const r = await pool.query(
      'SELECT id, titulo, categoria, estado, fecha, fecha_actualizacion FROM solicitudes WHERE propietario = $1 ORDER BY id DESC',
      [propietario]
    );
    return r.rows;
  },

  // trae una sola, pero solo si es del que la pide
  detalleSolicitud: async (id, propietario) => {
    const r = await pool.query(
      'SELECT id, titulo, descripcion, categoria, estado, fecha, fecha_actualizacion, propietario FROM solicitudes WHERE id = $1 AND propietario = $2',
      [Number(id), propietario]
    );
    return r.rows[0];
  },

  // prioridades que se aceptan
  PRIORIDADES: ['Alta', 'Media', 'Baja'],

  // todas las solicitudes ordenadas como pida el coordinador (si el orden no sirve va por prioridad)
  todasSolicitudes: async (orden) => {
    let por = "CASE prioridad WHEN 'Alta' THEN 1 WHEN 'Media' THEN 2 WHEN 'Baja' THEN 3 ELSE 4 END, id DESC";
    if (orden === 'estado') por = 'estado, id DESC';
    if (orden === 'fecha') por = 'fecha DESC';
    const r = await pool.query(
      'SELECT id, titulo, categoria, estado, prioridad, justificacion, to_char(fecha_objetivo, \'YYYY-MM-DD\') AS fecha_objetivo, fecha, fecha_actualizacion, propietario, agente FROM solicitudes ORDER BY ' + por
    );
    return r.rows;
  },

  // cambia la prioridad y lo anota en el historial para que quede trazable
  // cambio 1: si pasa a Alta pide justificacion y fecha objetivo, y tambien quedan en el historial
  // todo va en una transaccion: o se guarda todo o no se guarda nada
  cambiarPrioridad: async (id, prioridad, usuario, justificacion, fechaObjetivo) => {
    if (!['Alta', 'Media', 'Baja'].includes(prioridad)) return { error: 'Prioridad invalida' };
    let v = null;
    if (prioridad === 'Alta') {
      v = validarAlta(justificacion, fechaObjetivo);
      if (v.error) return v;
    }
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const actual = await cli.query('SELECT prioridad FROM solicitudes WHERE id = $1 FOR UPDATE', [Number(id)]);
      if (!actual.rows[0]) { await cli.query('ROLLBACK'); return { error: 'No existe' }; }
      const anterior = actual.rows[0].prioridad;
      if (v) {
        await cli.query(
          'UPDATE solicitudes SET prioridad = $1, justificacion = $2, fecha_objetivo = $3, fecha_actualizacion = NOW() WHERE id = $4',
          [prioridad, v.justificacion, v.fechaObjetivo, Number(id)]
        );
      } else {
        await cli.query(
          'UPDATE solicitudes SET prioridad = $1, fecha_actualizacion = NOW() WHERE id = $2',
          [prioridad, Number(id)]
        );
      }
      await cli.query(
        'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
        [Number(id), 'prioridad', anterior, prioridad, usuario]
      );
      if (v) {
        await cli.query(
          'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
          [Number(id), 'justificacion', null, v.justificacion + ' (fecha objetivo: ' + v.fechaObjetivo + ')', usuario]
        );
      }
      await cli.query('COMMIT');
      return { anterior, nueva: prioridad };
    } catch (e) {
      await cli.query('ROLLBACK');
      throw e;
    } finally {
      cli.release();
    }
  },

  // HU05: agentes que se pueden asignar (rol 2 y activos)
  agentesActivos: async () => {
    const r = await pool.query(
      'SELECT nombre_usuario FROM usuarios WHERE id_tipo = 2 AND activo = TRUE ORDER BY nombre_usuario'
    );
    return r.rows.map(a => a.nombre_usuario);
  },

  // HU05: asigna la solicitud a un agente activo, guarda quien y cuando, y le deja un aviso
  // todo va en una transaccion: o se guarda todo o no se guarda nada
  asignarSolicitud: async (id, agente, coordinador) => {
    const nombre = (agente || '').trim();
    if (!nombre) return { error: 'Falta el agente' };
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const s = await cli.query('SELECT estado, agente FROM solicitudes WHERE id = $1 FOR UPDATE', [Number(id)]);
      if (!s.rows[0]) { await cli.query('ROLLBACK'); return { error: 'No existe' }; }
      const { estado, agente: anterior } = s.rows[0];
      if (['Resuelta', 'Cerrada'].includes(estado)) {
        await cli.query('ROLLBACK');
        return { error: 'No se puede asignar una solicitud ' + estado };
      }
      const a = await cli.query(
        'SELECT 1 FROM usuarios WHERE nombre_usuario = $1 AND id_tipo = 2 AND activo = TRUE', [nombre]
      );
      if (!a.rows[0]) { await cli.query('ROLLBACK'); return { error: 'El agente no existe o no esta activo' }; }
      if (anterior === nombre) { await cli.query('ROLLBACK'); return { error: 'Ya esta asignada a ese agente' }; }
      const nuevoEstado = estado === 'Nuevo' ? 'Asignada' : estado;
      await cli.query(
        'UPDATE solicitudes SET agente = $1, asignado_por = $2, fecha_asignacion = NOW(), estado = $3, fecha_actualizacion = NOW() WHERE id = $4',
        [nombre, coordinador, nuevoEstado, Number(id)]
      );
      await cli.query(
        'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
        [Number(id), 'agente', anterior || 'Sin asignar', nombre, coordinador]
      );
      if (nuevoEstado !== estado) {
        await cli.query(
          'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
          [Number(id), 'estado', estado, nuevoEstado, coordinador]
        );
      }
      await cli.query(
        'INSERT INTO notificaciones (usuario, solicitud_id, mensaje) VALUES ($1, $2, $3)',
        [nombre, Number(id), 'Te asignaron la solicitud #' + Number(id)]
      );
      await cli.query('COMMIT');
      return { agente: nombre, anterior: anterior || 'Sin asignar', estado: nuevoEstado };
    } catch (e) {
      await cli.query('ROLLBACK');
      throw e;
    } finally {
      cli.release();
    }
  },

  // HU05: las solicitudes que tiene asignadas el agente
  misAsignadas: async (agente) => {
    const r = await pool.query(
      'SELECT id, titulo, descripcion, categoria, estado, prioridad, fecha_asignacion, asignado_por FROM solicitudes WHERE agente = $1 ORDER BY id DESC',
      [agente]
    );
    return r.rows.map(x => ({ ...x, siguientes: TRANSICIONES_AGENTE[x.estado] || [] }));
  },

  // HU05: avisos del usuario, los mas nuevos primero; al verlos quedan como leidos
  misNotificaciones: async (usuario) => {
    const r = await pool.query(
      'SELECT id, solicitud_id, mensaje, leida, fecha FROM notificaciones WHERE usuario = $1 ORDER BY id DESC LIMIT 20',
      [usuario]
    );
    await pool.query('UPDATE notificaciones SET leida = TRUE WHERE usuario = $1 AND leida = FALSE', [usuario]);
    return r.rows;
  },

  // HU06: el agente asignado deja un comentario; autor y fecha los pone el sistema
  // queda tambien en el historial para la trazabilidad
  agregarComentario: async (id, texto, agente) => {
    const t = (texto || '').trim();
    if (!t) return { error: 'El comentario no puede estar vacio' };
    const s = await pool.query('SELECT agente FROM solicitudes WHERE id = $1', [Number(id)]);
    if (!s.rows[0]) return { error: 'No existe' };
    if (s.rows[0].agente !== agente) return { error: 'Solo el agente asignado puede comentar' };
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const c = await cli.query(
        'INSERT INTO comentarios (solicitud_id, autor, texto) VALUES ($1, $2, $3) RETURNING id, autor, texto, fecha',
        [Number(id), agente, t]
      );
      await cli.query(
        'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
        [Number(id), 'comentario', null, 'Comentario #' + c.rows[0].id, agente]
      );
      await cli.query('UPDATE solicitudes SET fecha_actualizacion = NOW() WHERE id = $1', [Number(id)]);
      await cli.query('COMMIT');
      return c.rows[0];
    } catch (e) {
      await cli.query('ROLLBACK');
      throw e;
    } finally {
      cli.release();
    }
  },

  // HU06: comentarios de una solicitud; solo los ve quien tiene que ver con ella
  // solicitante: si es suya, agente: si la tiene asignada, coordinador y auditor: todas
  comentariosSolicitud: async (id, usuario, rolId) => {
    const s = await pool.query('SELECT propietario, agente FROM solicitudes WHERE id = $1', [Number(id)]);
    if (!s.rows[0]) return { error: 'No existe' };
    const rol = Number(rolId);
    if (rol === 1 && s.rows[0].propietario !== usuario) return { error: 'No existe' };
    if (rol === 2 && s.rows[0].agente !== usuario) return { error: 'No existe' };
    const r = await pool.query(
      'SELECT id, autor, texto, fecha FROM comentarios WHERE solicitud_id = $1 ORDER BY id',
      [Number(id)]
    );
    return { lista: r.rows };
  },

  // HU07: el agente asignado cambia el estado, solo si la transicion esta permitida
  // queda en el historial y, si se resuelve, se le avisa al solicitante
  cambiarEstado: async (id, nuevo, agente) => {
    const n = (nuevo || '').trim();
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const s = await cli.query('SELECT estado, agente, propietario FROM solicitudes WHERE id = $1 FOR UPDATE', [Number(id)]);
      if (!s.rows[0]) { await cli.query('ROLLBACK'); return { error: 'No existe' }; }
      const { estado, propietario } = s.rows[0];
      if (s.rows[0].agente !== agente) { await cli.query('ROLLBACK'); return { error: 'Solo el agente asignado puede cambiar el estado' }; }
      const permitidos = TRANSICIONES_AGENTE[estado] || [];
      if (!permitidos.includes(n)) {
        await cli.query('ROLLBACK');
        return { error: 'Transicion no permitida: de ' + estado + ' a ' + (n || '(vacio)') };
      }
      await cli.query('UPDATE solicitudes SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2', [n, Number(id)]);
      await cli.query(
        'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
        [Number(id), 'estado', estado, n, agente]
      );
      if (n === 'Resuelta') {
        await cli.query(
          'INSERT INTO notificaciones (usuario, solicitud_id, mensaje) VALUES ($1, $2, $3)',
          [propietario, Number(id), 'Tu solicitud #' + Number(id) + ' fue resuelta: confirmala o reabrela']
        );
      }
      await cli.query('COMMIT');
      return { anterior: estado, nuevo: n };
    } catch (e) {
      await cli.query('ROLLBACK');
      throw e;
    } finally {
      cli.release();
    }
  },

  // HU08: el solicitante acepta la solucion (Resuelta -> Cerrada) o la reabre con motivo (Resuelta -> Reabierta)
  // todo queda en el historial y, si se reabre, se le avisa al agente
  cerrarOReabrir: async (id, accion, motivo, propietario) => {
    const m = (motivo || '').trim();
    if (!['confirmar', 'reabrir'].includes(accion)) return { error: 'Accion invalida' };
    if (accion === 'reabrir' && !m) return { error: 'Para reabrir debes escribir el motivo' };
    const cli = await pool.connect();
    try {
      await cli.query('BEGIN');
      const s = await cli.query('SELECT estado, agente, propietario FROM solicitudes WHERE id = $1 FOR UPDATE', [Number(id)]);
      if (!s.rows[0] || s.rows[0].propietario !== propietario) { await cli.query('ROLLBACK'); return { error: 'No existe' }; }
      if (s.rows[0].estado !== 'Resuelta') {
        await cli.query('ROLLBACK');
        return { error: 'Solo se puede confirmar o reabrir una solicitud Resuelta' };
      }
      const nuevo = accion === 'confirmar' ? 'Cerrada' : 'Reabierta';
      await cli.query('UPDATE solicitudes SET estado = $1, fecha_actualizacion = NOW() WHERE id = $2', [nuevo, Number(id)]);
      await cli.query(
        'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
        [Number(id), 'estado', 'Resuelta', nuevo, propietario]
      );
      if (accion === 'confirmar') {
        await cli.query(
          'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
          [Number(id), 'confirmacion', null, 'Solucion aceptada', propietario]
        );
      } else {
        await cli.query(
          'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
          [Number(id), 'reapertura', null, m, propietario]
        );
        if (s.rows[0].agente) {
          await cli.query(
            'INSERT INTO notificaciones (usuario, solicitud_id, mensaje) VALUES ($1, $2, $3)',
            [s.rows[0].agente, Number(id), 'La solicitud #' + Number(id) + ' fue reabierta: ' + m]
          );
        }
      }
      await cli.query('COMMIT');
      return { estado: nuevo };
    } catch (e) {
      await cli.query('ROLLBACK');
      throw e;
    } finally {
      cli.release();
    }
  },

  // historial de cambios de una solicitud, lo mas nuevo primero
  historialSolicitud: async (id) => {
    const r = await pool.query(
      'SELECT campo, valor_anterior, valor_nuevo, usuario, fecha FROM historial_cambios WHERE solicitud_id = $1 ORDER BY id DESC',
      [Number(id)]
    );
    return r.rows;
  }
};
