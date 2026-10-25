-- Migración segura: retirar el administrador global sin recrear la base de datos.
-- Ejecutar una sola vez contra la base de datos existente, con respaldo previo.
BEGIN;

-- Retirar primero las dependencias de las cuentas marcadas como globales.
DELETE FROM refresh_tokens
WHERE administrador_id IN (
    SELECT administrador_id
    FROM administrador
    WHERE es_top_global = TRUE
);

DELETE FROM administrador_restaurante
WHERE administrador_id IN (
    SELECT administrador_id
    FROM administrador
    WHERE es_top_global = TRUE
);

DELETE FROM administrador
WHERE es_top_global = TRUE;

-- La autorización global se gestionará por enlaces de correo, no por cuentas.
DROP FUNCTION IF EXISTS fn_administrador_crear_top_global(
    VARCHAR, VARCHAR, VARCHAR, VARCHAR
);

ALTER TABLE administrador
    DROP COLUMN IF EXISTS es_top_global;

-- Tokens de decisión separados: cada enlace permite una sola acción específica.
ALTER TABLE solicitud_registro_restaurante
    ADD COLUMN IF NOT EXISTS token_aprobacion_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS token_rechazo_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS token_revision_expiracion TIMESTAMP;

COMMIT;
