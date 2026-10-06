// aca se sirven las paginas y tambien se devuelven los datos en json
const path = require('path');
const SiteModel = require('../Model/SiteModel');

exports.index = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'home.html'));
};

exports.rolDetalle = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'servicio.html'));
};

exports.loginPage = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'login.html'));
};

exports.registroPage = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'registro.html'));
};

exports.apiRegistro = async (req, res) => {
  const { usuario, nombre, email, clave, rolId } = req.body || {};
  const name = (usuario || nombre || '').trim();
  if (!name || !clave || !rolId) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo invalido' });
  }
  try {
    const rol = await SiteModel.getServicioById(rolId);
    if (!rol) return res.status(404).json({ error: 'Rol no existe' });
    const r = await SiteModel.createUser({ usuario: name, email, clave, rolId });
    if (r.error) {
      let status = 409;
      if (r.error === 'Rol no existe') status = 404;
      if (r.error === 'Faltan datos') status = 400;
      return res.status(status).json({ error: r.error });
    }
    res.status(201).json({ ok: true, usuario: r.usuario, rolId: r.rolId, rol: rol.nombre });
  } catch (e) {
    console.error('apiRegistro:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

exports.apiLogin = async (req, res) => {
  const { usuario, nombre, clave, rolId } = req.body || {};
  const name = (usuario || nombre || '').trim();
  if (!name || !clave || !rolId) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  try {
    const r = await SiteModel.validateUser({ usuario: name, clave, rolId });
    if (r.error) return res.status(401).json({ error: r.error });
    // se guarda en la sesion para saber quien entro y con que rol
    req.session.user = { usuario: r.usuario, rolId: r.rolId, rol: r.rol };
    res.json({ ok: true, usuario: r.usuario, rolId: r.rolId, rol: r.rol });
  } catch (e) {
    console.error('apiLogin:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// cierra la sesion
exports.apiLogout = (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
};

// dice quien esta logueado, si nadie lo esta devuelve 401
exports.apiYo = (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'No has iniciado sesión' });
  res.json(req.session.user);
};

// pagina del solicitante
exports.solicitante = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'usuario.html'));
};

// pagina del coordinador
exports.coordinador = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'coordinador.html'));
};

// guarda la solicitud del que esta logueado, el propietario sale de la sesion
exports.apiCrearSolicitud = async (req, res) => {
  try {
    const r = await SiteModel.crearSolicitud({ ...req.body, propietario: req.session.user.usuario });
    if (r.error) return res.status(400).json({ error: r.error });
    res.status(201).json({ ok: true, id: r.id, fecha: r.fecha, estado: r.estado });
  } catch (e) {
    console.error('apiCrearSolicitud:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// trae solo las solicitudes del que esta logueado
exports.apiMisSolicitudes = async (req, res) => {
  try {
    res.json(await SiteModel.misSolicitudes(req.session.user.usuario));
  } catch (e) {
    console.error('apiMisSolicitudes:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// trae una sola solicitud, pero solo si es mia
exports.apiDetalleSolicitud = async (req, res) => {
  try {
    const s = await SiteModel.detalleSolicitud(req.params.id, req.session.user.usuario);
    if (!s) return res.status(404).json({ error: 'No existe' });
    res.json(s);
  } catch (e) {
    console.error('apiDetalleSolicitud:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// lista todas para el coordinador, se puede pedir ordenada por prioridad, estado o fecha
exports.apiTodasSolicitudes = async (req, res) => {
  try {
    res.json(await SiteModel.todasSolicitudes(req.query.orden));
  } catch (e) {
    console.error('apiTodasSolicitudes:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// cambia la prioridad, solo coordinador (lo revisa el middleware)
exports.apiPriorizar = async (req, res) => {
  try {
    const r = await SiteModel.cambiarPrioridad(req.params.id, req.body.prioridad, req.session.user.usuario);
    if (r.error) {
      const status = r.error === 'No existe' ? 404 : 400;
      return res.status(status).json({ error: r.error });
    }
    res.json({ ok: true, anterior: r.anterior, nueva: r.nueva });
  } catch (e) {
    console.error('apiPriorizar:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// historial de cambios de una solicitud
exports.apiHistorial = async (req, res) => {
  try {
    res.json(await SiteModel.historialSolicitud(req.params.id));
  } catch (e) {
    console.error('apiHistorial:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// pagina del agente
exports.agente = (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'View', 'agente.html'));
};

// HU05: lista de agentes activos para el coordinador
exports.apiAgentes = async (req, res) => {
  try {
    res.json(await SiteModel.agentesActivos());
  } catch (e) {
    console.error('apiAgentes:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// HU05: el coordinador asigna una solicitud a un agente
exports.apiAsignar = async (req, res) => {
  try {
    const r = await SiteModel.asignarSolicitud(req.params.id, (req.body || {}).agente, req.session.user.usuario);
    if (r.error) {
      const status = r.error === 'No existe' ? 404 : 400;
      return res.status(status).json({ error: r.error });
    }
    res.json({ ok: true, ...r });
  } catch (e) {
    console.error('apiAsignar:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// HU05: solicitudes asignadas al agente que entro
exports.apiAsignadas = async (req, res) => {
  try {
    res.json(await SiteModel.misAsignadas(req.session.user.usuario));
  } catch (e) {
    console.error('apiAsignadas:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// HU05: avisos del usuario que entro
exports.apiNotificaciones = async (req, res) => {
  try {
    res.json(await SiteModel.misNotificaciones(req.session.user.usuario));
  } catch (e) {
    console.error('apiNotificaciones:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// HU06: el agente asignado agrega un comentario
exports.apiComentar = async (req, res) => {
  try {
    const r = await SiteModel.agregarComentario(req.params.id, (req.body || {}).texto, req.session.user.usuario);
    if (r.error) {
      let status = 400;
      if (r.error === 'No existe') status = 404;
      if (r.error === 'Solo el agente asignado puede comentar') status = 403;
      return res.status(status).json({ error: r.error });
    }
    res.status(201).json({ ok: true, ...r });
  } catch (e) {
    console.error('apiComentar:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// HU06: comentarios de una solicitud, segun el rol del que pregunta
exports.apiComentarios = async (req, res) => {
  try {
    const u = req.session.user;
    const r = await SiteModel.comentariosSolicitud(req.params.id, u.usuario, u.rolId);
    if (r.error) return res.status(404).json({ error: r.error });
    res.json(r.lista);
  } catch (e) {
    console.error('apiComentarios:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

// esto lo usa el js del navegador para los textos y los roles
exports.apiPagina = (req, res) => {
  const pagina = SiteModel.getPagina(req.params.clave);
  if (!pagina) return res.status(404).json({ error: 'No encontrado' });
  res.json(pagina);
};

exports.apiServicios = async (req, res) => {
  try {
    res.json(await SiteModel.getServicios());
  } catch (e) {
    console.error('apiServicios:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};

exports.apiServicioById = async (req, res) => {
  try {
    const servicio = await SiteModel.getServicioById(req.params.id);
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' });
    res.json(servicio);
  } catch (e) {
    console.error('apiServicioById:', e.message);
    res.status(500).json({ error: 'Error en la base de datos' });
  }
};
