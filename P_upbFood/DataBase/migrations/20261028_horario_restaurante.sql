-- HU029: horario de atención configurable por el dueño de la cafetería.
-- Ejecutar una sola vez en bases existentes (las nuevas ya lo crean desde init.sql).
ALTER TABLE restaurante
    ADD COLUMN IF NOT EXISTS horario VARCHAR(100);

UPDATE restaurante
SET horario = 'Lunes a viernes, 7:00 a. m. - 6:00 p. m.'
WHERE horario IS NULL;
