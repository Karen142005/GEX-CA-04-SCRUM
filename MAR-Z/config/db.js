// Conexión PostgreSQL (driver pg)

const { Pool } = require('pg');

const cfg = {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'mar_z',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || '1234'
};

const pool = new Pool(cfg);

pool.on('connect', () => {
    console.log('PostgreSQL conectado correctamente');
});

pool.on('error', (error) => {
    console.error('Error de PostgreSQL:', error);
});

module.exports = {pool,cfg};
