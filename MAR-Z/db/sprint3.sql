-- Cambios del Sprint 3 (HU12 y cambio 2).
-- Se ejecuta en pgAdmin, conectado a mar_z, DESPUES de init.sql y sprint2.sql.
-- Se puede correr varias veces sin dañar nada.

-- HU12: cada exportacion queda registrada (quien, cuando, con que filtros y cuantas filas)
CREATE TABLE IF NOT EXISTS exportaciones (
    id SERIAL PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL,
    filtros TEXT NOT NULL,
    filas INTEGER NOT NULL,
    fecha TIMESTAMP NOT NULL DEFAULT NOW()
);

-- HU11 y cambio 2: el historial es de solo lectura, nadie lo puede editar ni borrar
CREATE OR REPLACE FUNCTION no_editar_historial() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'El historial de cambios es de solo lectura';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historial_fijo ON historial_cambios;
CREATE TRIGGER trg_historial_fijo
  BEFORE UPDATE OR DELETE ON historial_cambios
  FOR EACH ROW EXECUTE FUNCTION no_editar_historial();
