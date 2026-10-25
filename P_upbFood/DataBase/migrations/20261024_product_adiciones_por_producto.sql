-- Relaciona los ingredientes adicionales que cada producto puede ofrecer.
-- Ejecutar una sola vez en bases de datos que ya existen.
CREATE TABLE IF NOT EXISTS producto_adicion (
    restaurante_id INTEGER NOT NULL,
    producto_id INTEGER NOT NULL,
    adicion_id INTEGER NOT NULL,
    PRIMARY KEY (restaurante_id, producto_id, adicion_id),
    FOREIGN KEY (restaurante_id, producto_id)
        REFERENCES producto_restaurante (restaurante_id, producto_id) ON DELETE CASCADE,
    FOREIGN KEY (restaurante_id, adicion_id)
        REFERENCES producto_restaurante (restaurante_id, producto_id) ON DELETE CASCADE,
    CHECK (producto_id <> adicion_id)
);
