-- Cambios del Sprint 2 (HU05, HU06, HU07, HU08 y cambio 1).
-- Se ejecuta en pgAdmin, conectado a mar_z, DESPUES de init.sql.
-- Se puede correr varias veces sin dañar nada.

-- HU05: solo se asigna a agentes con estado Activo
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- HU05: a quien se asigno, quien la asigno y cuando
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS agente VARCHAR(100);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS asignado_por VARCHAR(100);
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_asignacion TIMESTAMP;

-- Cambio 1: la prioridad Alta pide justificacion y fecha objetivo
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS justificacion TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS fecha_objetivo DATE;

-- Cambio 1: las solicitudes que ya eran Alta antes del cambio quedan marcadas,
-- para que la regla nueva no les impida cambiar de estado despues
UPDATE solicitudes
   SET justificacion = 'Sin justificacion: prioridad Alta asignada antes del cambio 1',
       fecha_objetivo = fecha::date
 WHERE prioridad = 'Alta' AND (justificacion IS NULL OR fecha_objetivo IS NULL);

-- HU07: estados que puede tener una solicitud
-- Cambio 1: si es Alta, debe tener justificacion y fecha objetivo
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_estado') THEN
    ALTER TABLE solicitudes ADD CONSTRAINT chk_estado
      CHECK (estado IN ('Nuevo', 'Asignada', 'En progreso', 'Resuelta', 'Cerrada', 'Reabierta'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_alta') THEN
    ALTER TABLE solicitudes ADD CONSTRAINT chk_alta
      CHECK (prioridad <> 'Alta' OR (justificacion IS NOT NULL AND fecha_objetivo IS NOT NULL));
  END IF;
END $$;

-- HU08: el motivo de reapertura puede ser largo, por eso los valores pasan a TEXT
ALTER TABLE historial_cambios ALTER COLUMN valor_anterior TYPE TEXT;
ALTER TABLE historial_cambios ALTER COLUMN valor_nuevo TYPE TEXT;

-- HU06: comentarios de trabajo, no vacios
CREATE TABLE IF NOT EXISTS comentarios (
    id SERIAL PRIMARY KEY,
    solicitud_id INTEGER NOT NULL REFERENCES solicitudes(id),
    autor VARCHAR(100) NOT NULL,
    texto TEXT NOT NULL CHECK (length(trim(texto)) > 0),
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

-- HU06: un comentario no se puede editar ni borrar (autor y fecha quedan fijos)
CREATE OR REPLACE FUNCTION no_editar_comentario() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Los comentarios no se pueden editar ni borrar';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comentario_fijo ON comentarios;
CREATE TRIGGER trg_comentario_fijo
  BEFORE UPDATE OR DELETE ON comentarios
  FOR EACH ROW EXECUTE FUNCTION no_editar_comentario();

-- HU05: avisos dentro de la aplicacion
CREATE TABLE IF NOT EXISTS notificaciones (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL,
    solicitud_id INTEGER REFERENCES solicitudes(id),
    mensaje TEXT NOT NULL,
    leida BOOLEAN NOT NULL DEFAULT FALSE,
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);
