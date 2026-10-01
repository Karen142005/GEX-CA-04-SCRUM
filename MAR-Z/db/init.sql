-- Script manual para pgAdmin: crea las tablas del proyecto MAR-Z.
-- 1. Crea la BD si no existe (conectado a postgres): CREATE DATABASE mar_z;
-- 2. Conectado a mar_z, abre este archivo y ejecútalo.

-- Roles (el id_tipo es el que se guarda en usuarios)
CREATE TABLE IF NOT EXISTS tipos_usuario (
    id_tipo SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    prefijo VARCHAR(10) NOT NULL
);

INSERT INTO tipos_usuario (id_tipo, nombre, prefijo) VALUES
    (1, 'Solicitante', 'S'),
    (2, 'Agente', 'Ag'),
    (3, 'Coordinador', 'C'),
    (4, 'Auditor', 'Au')
ON CONFLICT (id_tipo) DO NOTHING;

-- Usuarios: cada registro queda atado a su rol (id_tipo)
CREATE TABLE IF NOT EXISTS usuarios (
    id_usuario SERIAL PRIMARY KEY,
    codigo VARCHAR(100) NOT NULL UNIQUE,
    nombre_usuario VARCHAR(100) NOT NULL UNIQUE,
    correo_electronico VARCHAR(150) NOT NULL UNIQUE,
    clave_hash TEXT NOT NULL,
    id_tipo INTEGER NOT NULL REFERENCES tipos_usuario (id_tipo)
);

-- Solicitudes: el id y la fecha los pone la BD, el estado nace en 'Nuevo'
CREATE TABLE IF NOT EXISTS solicitudes (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    categoria VARCHAR(100) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    estado VARCHAR(50) DEFAULT 'Nuevo',
    prioridad VARCHAR(20) DEFAULT 'Media',
    propietario VARCHAR(100) NOT NULL
);

-- Trazabilidad: cada cambio de una solicitud queda anotado con quién y cuándo
CREATE TABLE IF NOT EXISTS historial_cambios (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
    campo VARCHAR(50) NOT NULL,
    valor_anterior VARCHAR(100),
    valor_nuevo VARCHAR(100),
    usuario VARCHAR(100) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW()
);
