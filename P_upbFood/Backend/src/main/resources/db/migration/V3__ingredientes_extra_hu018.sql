CREATE TABLE IF NOT EXISTS ingredientes_extra (
    id SERIAL PRIMARY KEY,
    producto_id INT NOT NULL
        CONSTRAINT fk_ingrediente_producto
        REFERENCES productos(id)
        ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL
);