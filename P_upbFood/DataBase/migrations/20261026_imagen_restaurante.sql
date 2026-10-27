-- Agrega columna de imagen principal para los restaurantes y optimiza índices de consulta.
ALTER TABLE restaurante
    ADD COLUMN IF NOT EXISTS imagen_url TEXT;

CREATE INDEX IF NOT EXISTS idx_pedido_restaurante_fecha
    ON pedido (restaurante_id, fecha DESC);

CREATE INDEX IF NOT EXISTS idx_pedido_restaurante_estado
    ON pedido (restaurante_id, estado);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido_pedido_id
    ON detalle_pedido (pedido_id);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_admin_id
    ON refresh_tokens (administrador_id);
