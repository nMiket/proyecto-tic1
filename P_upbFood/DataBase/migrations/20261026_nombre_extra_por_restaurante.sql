-- Permite que cada cafetería use su propio nombre para un ingrediente extra.
ALTER TABLE producto_restaurante
    ADD COLUMN IF NOT EXISTS nombre_personalizado VARCHAR(50);
