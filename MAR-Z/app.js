const express = require('express');
const session = require('express-session');
const path = require('path');
const homeRoutes = require('./routes/homeRoutes');
const { pool } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// lo estatico (css y js del navegador) sale de public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// la sesion guarda quien entro y con que rol
app.use(session({
  secret: 'marz-cambia-esto',
  resave: false,
  saveUninitialized: false
}));

// las rutas estan en routes/
app.use('/', homeRoutes);

// si no existe la pagina muestra el 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'View', '404.html'));
});

app.listen(PORT, async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('PostgreSQL conectado correctamente');
  } catch (e) {
    console.error('PostgreSQL FALLO:', e.message);
    console.error('Revisa PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD y que el servidor este activo.');
    process.exit(1);
  }
  console.log(`Servidor en http://localhost:${PORT}`);
});
