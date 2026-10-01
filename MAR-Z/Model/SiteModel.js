// los datos salen de postgres, los textos fijos estan aca mismo
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

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
  crearSolicitud: async ({ titulo, descripcion, categoria, propietario }) => {
    const t = (titulo || '').trim();
    const d = (descripcion || '').trim();
    const c = (categoria || '').trim();
    if (!t || !d || !c || !propietario) return { error: 'Faltan datos' };
    const r = await pool.query(
      'INSERT INTO solicitudes (titulo, descripcion, categoria, propietario) VALUES ($1, $2, $3, $4) RETURNING id, fecha, estado',
      [t, d, c, propietario]
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
      'SELECT id, titulo, categoria, estado, prioridad, fecha, fecha_actualizacion, propietario FROM solicitudes ORDER BY ' + por
    );
    return r.rows;
  },

  // cambia la prioridad y lo anota en el historial para que quede trazable
  cambiarPrioridad: async (id, prioridad, usuario) => {
    if (!['Alta', 'Media', 'Baja'].includes(prioridad)) return { error: 'Prioridad invalida' };
    const actual = await pool.query('SELECT prioridad FROM solicitudes WHERE id = $1', [Number(id)]);
    if (!actual.rows[0]) return { error: 'No existe' };
    const anterior = actual.rows[0].prioridad;
    await pool.query(
      'UPDATE solicitudes SET prioridad = $1, fecha_actualizacion = NOW() WHERE id = $2',
      [prioridad, Number(id)]
    );
    await pool.query(
      'INSERT INTO historial_cambios (solicitud_id, campo, valor_anterior, valor_nuevo, usuario) VALUES ($1, $2, $3, $4, $5)',
      [Number(id), 'prioridad', anterior, prioridad, usuario]
    );
    return { anterior, nueva: prioridad };
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
