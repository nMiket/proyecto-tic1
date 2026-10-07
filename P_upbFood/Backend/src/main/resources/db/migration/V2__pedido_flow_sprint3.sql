ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS chk_estado_ped;

UPDATE pedidos
SET estado = 'PENDIENTE'
WHERE estado = 'NUEVO';

ALTER TABLE pedidos
    ADD COLUMN IF NOT EXISTS codigo_seguimiento UUID,
    ADD COLUMN IF NOT EXISTS hora_recogida TIMESTAMP;

UPDATE pedidos
SET codigo_seguimiento = md5(random()::text || clock_timestamp()::text)::uuid
WHERE codigo_seguimiento IS NULL;

ALTER TABLE pedidos
    ALTER COLUMN codigo_seguimiento SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_pedidos_codigo_seguimiento
    ON pedidos (codigo_seguimiento);

ALTER TABLE pedidos
    ADD CONSTRAINT chk_estado_ped
    CHECK (estado IN ('PENDIENTE', 'EN_PAGO', 'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO', 'CANCELADO'));

CREATE TABLE IF NOT EXISTS pedido_eventos (
    id BIGSERIAL PRIMARY KEY,
    pedido_id BIGINT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    estado_anterior VARCHAR(30),
    estado_nuevo VARCHAR(30) NOT NULL,
    actor VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_pedido_eventos_pedido_id
    ON pedido_eventos (pedido_id);