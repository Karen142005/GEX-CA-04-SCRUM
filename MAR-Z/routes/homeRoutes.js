const express = require('express');
const router = express.Router();
const homeController = require('../Controller/homeController');

// si no hay sesion no deja pasar, en paginas manda al inicio y en apis da 401
function pedirLogin(req, res, next) {
  if (req.session.user) return next();
  if (req.path.startsWith('/api')) return res.status(401).json({ error: 'No has iniciado sesión' });
  res.redirect('/');
}

// solo el solicitante entra a su pagina
function soloSolicitante(req, res, next) {
  if (Number(req.session.user.rolId) !== 1) return res.redirect('/');
  next();
}

// lo mismo pero para apis, ahi se devuelve 403
function soloSolicitanteApi(req, res, next) {
  if (Number(req.session.user.rolId) !== 1) {
    return res.status(403).json({ error: 'Solo el solicitante crea solicitudes' });
  }
  next();
}

// solo el coordinador entra a su pagina
function soloCoordinador(req, res, next) {
  if (Number(req.session.user.rolId) !== 3) return res.redirect('/');
  next();
}

// lo mismo pero para apis
function soloCoordinadorApi(req, res, next) {
  if (Number(req.session.user.rolId) !== 3) {
    return res.status(403).json({ error: 'Solo el coordinador hace esto' });
  }
  next();
}

// solo el agente entra a su pagina
function soloAgente(req, res, next) {
  if (Number(req.session.user.rolId) !== 2) return res.redirect('/');
  next();
}

// lo mismo pero para apis
function soloAgenteApi(req, res, next) {
  if (Number(req.session.user.rolId) !== 2) {
    return res.status(403).json({ error: 'Solo el agente hace esto' });
  }
  next();
}

// las paginas
router.get('/', homeController.index);
router.get('/roles/:id', homeController.rolDetalle);
router.get('/roles/:id/login', homeController.loginPage);
router.get('/roles/:id/registro', homeController.registroPage);
router.get('/solicitante', pedirLogin, soloSolicitante, homeController.solicitante);
router.get('/coordinador', pedirLogin, soloCoordinador, homeController.coordinador);
router.get('/agente', pedirLogin, soloAgente, homeController.agente);

// los datos en json que usa el main.js
router.get('/api/pagina/:clave', homeController.apiPagina);
router.get('/api/roles', homeController.apiServicios);
router.get('/api/roles/:id', homeController.apiServicioById);
router.get('/api/yo', pedirLogin, homeController.apiYo);
router.post('/api/registro', homeController.apiRegistro);
router.post('/api/login', homeController.apiLogin);
router.post('/api/salir', homeController.apiLogout);
router.post('/api/solicitudes', pedirLogin, soloSolicitanteApi, homeController.apiCrearSolicitud);
router.get('/api/todas-solicitudes', pedirLogin, soloCoordinadorApi, homeController.apiTodasSolicitudes);
router.put('/api/solicitudes/:id/prioridad', pedirLogin, soloCoordinadorApi, homeController.apiPriorizar);
router.get('/api/solicitudes/:id/historial', pedirLogin, soloCoordinadorApi, homeController.apiHistorial);
router.get('/api/solicitudes', pedirLogin, soloSolicitanteApi, homeController.apiMisSolicitudes);
router.get('/api/solicitudes/:id', pedirLogin, soloSolicitanteApi, homeController.apiDetalleSolicitud);

// sprint 2
router.get('/api/agentes', pedirLogin, soloCoordinadorApi, homeController.apiAgentes);
router.put('/api/solicitudes/:id/asignar', pedirLogin, soloCoordinadorApi, homeController.apiAsignar);
router.get('/api/asignadas', pedirLogin, soloAgenteApi, homeController.apiAsignadas);
router.get('/api/notificaciones', pedirLogin, homeController.apiNotificaciones);
// HU06: no hay rutas para editar ni borrar comentarios, a proposito
router.post('/api/solicitudes/:id/comentarios', pedirLogin, soloAgenteApi, homeController.apiComentar);
router.get('/api/solicitudes/:id/comentarios', pedirLogin, homeController.apiComentarios);

module.exports = router;
