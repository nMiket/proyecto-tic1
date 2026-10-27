-- Permite almacenar imágenes cargadas desde el dispositivo (Data URL) o enlaces largos en productos del menú.
ALTER TABLE producto_restaurante
    ALTER COLUMN imagen_url TYPE TEXT;
