-- Cambios del Sprint 3 (HU11 y cambio 2).
-- Se ejecuta en pgAdmin, conectado a mar_z, DESPUES de init.sql y sprint2.sql.
-- Se puede correr varias veces sin dañar nada.

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
