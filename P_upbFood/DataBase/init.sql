-- ============================================================================
-- PROYECTO: Sistema de Restaurantes / Cafeterías
-- BASE DE DATOS: PostgreSQL 16
-- ESTRUCTURA: Tablas normalizadas + Funciones almacenadas (PL/pgSQL)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LIMPIEZA PREVENTIVA DE TABLAS Y FUNCIONES
--    Incluye también las tablas y funciones de la versión anterior del modelo.
--    ¡Borra todos los datos!
-- ----------------------------------------------------------------------------

-- Tablas del modelo actual
DROP TABLE IF EXISTS pago                      CASCADE;
DROP TABLE IF EXISTS detalle_pedido_adicion    CASCADE;
DROP TABLE IF EXISTS detalle_pedido            CASCADE;
DROP TABLE IF EXISTS pedido                    CASCADE;
DROP TABLE IF EXISTS refresh_tokens            CASCADE;
DROP TABLE IF EXISTS administrador_restaurante CASCADE;
DROP TABLE IF EXISTS producto_restaurante      CASCADE;
DROP TABLE IF EXISTS administrador             CASCADE;
DROP TABLE IF EXISTS tipo_administrador        CASCADE;
DROP TABLE IF EXISTS restaurante               CASCADE;
DROP TABLE IF EXISTS producto                  CASCADE;
DROP TABLE IF EXISTS tipo_producto             CASCADE;
DROP TABLE IF EXISTS tipo_pago                 CASCADE;

-- Funciones del modelo actual
DROP FUNCTION IF EXISTS fn_restaurante_crear;
DROP FUNCTION IF EXISTS fn_restaurante_obtener_todos;
DROP FUNCTION IF EXISTS fn_restaurante_actualizar;
DROP FUNCTION IF EXISTS fn_restaurante_eliminar;
DROP FUNCTION IF EXISTS fn_tipo_producto_crear;
DROP FUNCTION IF EXISTS fn_tipo_producto_obtener_todos;
DROP FUNCTION IF EXISTS fn_tipo_producto_actualizar;
DROP FUNCTION IF EXISTS fn_tipo_producto_eliminar;
DROP FUNCTION IF EXISTS fn_tipo_pago_crear;
DROP FUNCTION IF EXISTS fn_tipo_pago_obtener_todos;
DROP FUNCTION IF EXISTS fn_tipo_administrador_obtener_todos;
DROP FUNCTION IF EXISTS fn_producto_crear;
DROP FUNCTION IF EXISTS fn_producto_obtener_todos;
DROP FUNCTION IF EXISTS fn_producto_actualizar;
DROP FUNCTION IF EXISTS fn_producto_eliminar;
DROP FUNCTION IF EXISTS fn_menu_asignar;
DROP FUNCTION IF EXISTS fn_menu_obtener_por_restaurante;
DROP FUNCTION IF EXISTS fn_menu_quitar;
DROP FUNCTION IF EXISTS fn_administrador_crear;
DROP FUNCTION IF EXISTS fn_administrador_login;
DROP FUNCTION IF EXISTS fn_administrador_actualizar_password;
DROP FUNCTION IF EXISTS fn_administrador_eliminar;
DROP FUNCTION IF EXISTS fn_administrador_asignar;
DROP FUNCTION IF EXISTS fn_administrador_desasignar;
DROP FUNCTION IF EXISTS fn_administrador_restaurantes;
DROP FUNCTION IF EXISTS fn_restaurante_administradores;
DROP FUNCTION IF EXISTS fn_refresh_token_crear;
DROP FUNCTION IF EXISTS fn_refresh_token_validar;
DROP FUNCTION IF EXISTS fn_refresh_token_revocar;
DROP FUNCTION IF EXISTS fn_pedido_crear;
DROP FUNCTION IF EXISTS fn_pedido_obtener_por_codigo;
DROP FUNCTION IF EXISTS fn_pedido_detalle;
DROP FUNCTION IF EXISTS fn_pedido_obtener_activos;
DROP FUNCTION IF EXISTS fn_pedido_cambiar_estado;
DROP FUNCTION IF EXISTS fn_pago_registrar;
DROP FUNCTION IF EXISTS validar_adicion CASCADE;

-- ----------------------------------------------------------------------------
-- 2. CREACIÓN DE TABLAS
-- ----------------------------------------------------------------------------

-- ---------- Catálogos ----------

CREATE TABLE tipo_producto (
    tipo_producto_id      SERIAL PRIMARY KEY,
    nombre_tipo_producto  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE tipo_pago (
    tipo_pago_id  SERIAL PRIMARY KEY,
    nombre        VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE tipo_administrador (
    tipo_administrador_id      SERIAL PRIMARY KEY,
    nombre_tipo_administrador  VARCHAR(50) NOT NULL UNIQUE
);

-- Roles fijos del sistema (no cambian en tiempo de ejecución)
INSERT INTO tipo_administrador (nombre_tipo_administrador) VALUES
    ('Dueño de restaurante'),
    ('Administrador de cocina');

CREATE TABLE producto (
    producto_id           SERIAL PRIMARY KEY,
    tipo_producto_id      INTEGER NOT NULL REFERENCES tipo_producto (tipo_producto_id),
    nombre_producto       VARCHAR(50) NOT NULL,
    descripcion_producto  VARCHAR(120) NOT NULL
);

-- ---------- Restaurantes y administradores ----------

CREATE TABLE restaurante (
    restaurante_id         SERIAL PRIMARY KEY,
    nombre_restaurante     VARCHAR(50) NOT NULL,
    ubicacion_restaurante  VARCHAR(50) NOT NULL,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'Abierto'
        CHECK (estado IN ('Abierto', 'Cerrado', 'Alta demanda')),
    tiempo_pedido          INTEGER NOT NULL DEFAULT 15 CHECK (tiempo_pedido > 0)
);

CREATE TABLE administrador (
    administrador_id        SERIAL PRIMARY KEY,
    nombre_administrador    VARCHAR(50) NOT NULL,
    telefono_administrador  VARCHAR(20) NOT NULL,
    correo_administrador    VARCHAR(100) NOT NULL UNIQUE,
    password_hash           VARCHAR(255) NOT NULL
);

-- El rol se define por restaurante: una persona puede tener un rol distinto en cada uno
CREATE TABLE administrador_restaurante (
    restaurante_id         INTEGER NOT NULL REFERENCES restaurante (restaurante_id),
    administrador_id       INTEGER NOT NULL REFERENCES administrador (administrador_id),
    tipo_administrador_id  INTEGER NOT NULL REFERENCES tipo_administrador (tipo_administrador_id),
    fecha_asignacion       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado                 VARCHAR(20) NOT NULL DEFAULT 'Activo',
    PRIMARY KEY (restaurante_id, administrador_id)
);

CREATE TABLE refresh_tokens (
    refresh_token_id  BIGSERIAL PRIMARY KEY,
    administrador_id  INTEGER NOT NULL
        REFERENCES administrador (administrador_id) ON DELETE CASCADE,
    token_hash        VARCHAR(64) NOT NULL UNIQUE,
    expires_at        TIMESTAMP NOT NULL,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at        TIMESTAMP
);

-- ---------- Menú: productos por restaurante (el precio lo define cada restaurante) ----------

CREATE TABLE producto_restaurante (
    restaurante_id  INTEGER NOT NULL REFERENCES restaurante (restaurante_id),
    producto_id     INTEGER NOT NULL REFERENCES producto (producto_id),
    precio          DECIMAL(10,2) NOT NULL CHECK (precio > 0),
    imagen_url      VARCHAR(500),
    disponible      BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (restaurante_id, producto_id)
);

-- ---------- Pedidos ----------

CREATE TABLE pedido (
    pedido_id           SERIAL PRIMARY KEY,
    restaurante_id      INTEGER NOT NULL REFERENCES restaurante (restaurante_id),
    nombre_cliente      VARCHAR(80) NOT NULL,
    telefono_cliente    VARCHAR(20) NOT NULL,
    correo_cliente      VARCHAR(100) NOT NULL,
    estado              VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
        CHECK (estado IN ('PENDIENTE', 'EN_PAGO', 'PAGADO', 'EN_PREPARACION',
                          'LISTO', 'ENTREGADO', 'CANCELADO')),
    codigo_seguimiento  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    fecha               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    hora_recogida       TIMESTAMP,
    total               DECIMAL(10,2) NOT NULL CHECK (total > 0),
    -- Necesaria para la FK compuesta desde detalle_pedido
    UNIQUE (pedido_id, restaurante_id)
);

CREATE TABLE detalle_pedido (
    detalle_pedido_id  SERIAL PRIMARY KEY,
    restaurante_id     INTEGER NOT NULL,
    pedido_id          INTEGER NOT NULL,
    producto_id        INTEGER NOT NULL,
    cantidad           INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario    DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0),
    observaciones      VARCHAR(255),

    -- El restaurante de la línea debe ser el del pedido
    FOREIGN KEY (pedido_id, restaurante_id)
        REFERENCES pedido (pedido_id, restaurante_id),
    -- Ese restaurante debe vender ese producto
    FOREIGN KEY (restaurante_id, producto_id)
        REFERENCES producto_restaurante (restaurante_id, producto_id),
    -- Necesaria para la FK compuesta desde detalle_pedido_adicion
    UNIQUE (detalle_pedido_id, restaurante_id)
);

CREATE TABLE detalle_pedido_adicion (
    detalle_pedido_id  INTEGER NOT NULL,
    adicion_id         INTEGER NOT NULL,
    restaurante_id     INTEGER NOT NULL,
    precio_adicion     DECIMAL(10,2) NOT NULL CHECK (precio_adicion >= 0),
    PRIMARY KEY (detalle_pedido_id, adicion_id),

    -- La adición es del mismo restaurante que la línea
    FOREIGN KEY (detalle_pedido_id, restaurante_id)
        REFERENCES detalle_pedido (detalle_pedido_id, restaurante_id),
    -- Ese restaurante vende esa adición
    FOREIGN KEY (restaurante_id, adicion_id)
        REFERENCES producto_restaurante (restaurante_id, producto_id)
);

-- ---------- Pagos (un pago por pedido) ----------

CREATE TABLE pago (
    pago_id       SERIAL PRIMARY KEY,
    tipo_pago_id  INTEGER NOT NULL REFERENCES tipo_pago (tipo_pago_id),
    pedido_id     INTEGER NOT NULL UNIQUE REFERENCES pedido (pedido_id),
    estado        VARCHAR(50) NOT NULL,
    monto_pagado  DECIMAL(10,2) NOT NULL CHECK (monto_pagado > 0),
    fecha         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ----------------------------------------------------------------------------
-- 3. FUNCIONES ALMACENADAS (PL/pgSQL)
--    Solo las operaciones que la aplicación realmente usa:
--    - Los pedidos y sus líneas se crean juntos con fn_pedido_crear.
--    - Los pedidos no se eliminan: se cancelan con fn_pedido_cambiar_estado.
-- ----------------------------------------------------------------------------

-- =========================================================
-- RESTAURANTES
-- =========================================================
CREATE OR REPLACE FUNCTION fn_restaurante_crear(
    p_nombre VARCHAR, p_ubicacion VARCHAR,
    p_estado VARCHAR DEFAULT 'Abierto', p_tiempo INT DEFAULT 15
) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO restaurante (nombre_restaurante, ubicacion_restaurante, estado, tiempo_pedido)
    VALUES (p_nombre, p_ubicacion, p_estado, p_tiempo)
    RETURNING restaurante_id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_restaurante_obtener_todos()
RETURNS TABLE(restaurante_id INT, nombre_restaurante VARCHAR, ubicacion_restaurante VARCHAR,
              estado VARCHAR, tiempo_pedido INT) AS $$
BEGIN
    RETURN QUERY
    SELECT r.restaurante_id, r.nombre_restaurante, r.ubicacion_restaurante, r.estado, r.tiempo_pedido
    FROM restaurante r
    ORDER BY r.restaurante_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_restaurante_actualizar(
    p_id INT, p_nombre VARCHAR, p_ubicacion VARCHAR, p_estado VARCHAR, p_tiempo INT
) RETURNS VOID AS $$
BEGIN
    UPDATE restaurante
    SET nombre_restaurante = p_nombre, ubicacion_restaurante = p_ubicacion,
        estado = p_estado, tiempo_pedido = p_tiempo
    WHERE restaurante_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El restaurante % no existe', p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Solo funciona si el restaurante no tiene menú, pedidos ni administradores asociados
CREATE OR REPLACE FUNCTION fn_restaurante_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM restaurante WHERE restaurante_id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CATÁLOGOS: TIPO DE PRODUCTO, TIPO DE PAGO, TIPO DE ADMINISTRADOR
-- =========================================================
CREATE OR REPLACE FUNCTION fn_tipo_producto_crear(p_nombre VARCHAR) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO tipo_producto (nombre_tipo_producto) VALUES (p_nombre)
    RETURNING tipo_producto_id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_tipo_producto_obtener_todos()
RETURNS TABLE(tipo_producto_id INT, nombre_tipo_producto VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT t.tipo_producto_id, t.nombre_tipo_producto
    FROM tipo_producto t
    ORDER BY t.tipo_producto_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_tipo_producto_actualizar(p_id INT, p_nombre VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE tipo_producto SET nombre_tipo_producto = p_nombre WHERE tipo_producto_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El tipo de producto % no existe', p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Solo funciona si ningún producto usa ese tipo.
-- OJO: el tipo 'Adición' lo usa fn_pedido_crear para reconocer las adiciones; no lo elimines ni renombres.
CREATE OR REPLACE FUNCTION fn_tipo_producto_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM tipo_producto WHERE tipo_producto_id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_tipo_pago_crear(p_nombre VARCHAR) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO tipo_pago (nombre) VALUES (p_nombre) RETURNING tipo_pago_id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_tipo_pago_obtener_todos()
RETURNS TABLE(tipo_pago_id INT, nombre VARCHAR) AS $$
BEGIN
    RETURN QUERY SELECT t.tipo_pago_id, t.nombre FROM tipo_pago t ORDER BY t.tipo_pago_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_tipo_administrador_obtener_todos()
RETURNS TABLE(tipo_administrador_id INT, nombre_tipo_administrador VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT t.tipo_administrador_id, t.nombre_tipo_administrador
    FROM tipo_administrador t
    ORDER BY t.tipo_administrador_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- PRODUCTOS (catálogo global; incluye las adiciones, que son productos de tipo 'Adición')
-- =========================================================
CREATE OR REPLACE FUNCTION fn_producto_crear(
    p_tipo_producto_id INT, p_nombre VARCHAR, p_descripcion VARCHAR
) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO producto (tipo_producto_id, nombre_producto, descripcion_producto)
    VALUES (p_tipo_producto_id, p_nombre, p_descripcion)
    RETURNING producto_id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_producto_obtener_todos()
RETURNS TABLE(producto_id INT, nombre_producto VARCHAR, descripcion_producto VARCHAR,
              tipo_producto_id INT, nombre_tipo_producto VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT p.producto_id, p.nombre_producto, p.descripcion_producto,
           t.tipo_producto_id, t.nombre_tipo_producto
    FROM producto p
    JOIN tipo_producto t ON t.tipo_producto_id = p.tipo_producto_id
    ORDER BY p.producto_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_producto_actualizar(
    p_id INT, p_tipo_producto_id INT, p_nombre VARCHAR, p_descripcion VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE producto
    SET tipo_producto_id = p_tipo_producto_id, nombre_producto = p_nombre,
        descripcion_producto = p_descripcion
    WHERE producto_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe', p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Solo funciona si ningún restaurante lo tiene en su menú
CREATE OR REPLACE FUNCTION fn_producto_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM producto WHERE producto_id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- MENÚ POR RESTAURANTE (precio, imagen y disponibilidad)
-- =========================================================

-- Agrega el producto al menú del restaurante, o actualiza su precio/imagen/disponibilidad si ya está
CREATE OR REPLACE FUNCTION fn_menu_asignar(
    p_restaurante_id INT, p_producto_id INT, p_precio NUMERIC,
    p_imagen_url VARCHAR DEFAULT NULL, p_disponible BOOLEAN DEFAULT TRUE
) RETURNS VOID AS $$
BEGIN
    INSERT INTO producto_restaurante (restaurante_id, producto_id, precio, imagen_url, disponible)
    VALUES (p_restaurante_id, p_producto_id, p_precio, p_imagen_url, p_disponible)
    ON CONFLICT (restaurante_id, producto_id)
    DO UPDATE SET precio = EXCLUDED.precio,
                  imagen_url = EXCLUDED.imagen_url,
                  disponible = EXCLUDED.disponible;
END;
$$ LANGUAGE plpgsql;

-- Menú completo del restaurante; es_adicion permite separar los extras de los productos
CREATE OR REPLACE FUNCTION fn_menu_obtener_por_restaurante(p_restaurante_id INT)
RETURNS TABLE(producto_id INT, nombre_producto VARCHAR, descripcion_producto VARCHAR,
              nombre_tipo_producto VARCHAR, es_adicion BOOLEAN,
              precio NUMERIC, imagen_url VARCHAR, disponible BOOLEAN) AS $$
BEGIN
    RETURN QUERY
    SELECT p.producto_id, p.nombre_producto, p.descripcion_producto,
           t.nombre_tipo_producto, (t.nombre_tipo_producto = 'Adición'),
           pr.precio, pr.imagen_url, pr.disponible
    FROM producto_restaurante pr
    JOIN producto p      ON p.producto_id = pr.producto_id
    JOIN tipo_producto t ON t.tipo_producto_id = p.tipo_producto_id
    WHERE pr.restaurante_id = p_restaurante_id
    ORDER BY (t.nombre_tipo_producto = 'Adición'), t.nombre_tipo_producto, p.nombre_producto;
END;
$$ LANGUAGE plpgsql;

-- Solo funciona si el producto nunca se ha pedido en ese restaurante;
-- si ya tiene historial, usa fn_menu_asignar con p_disponible = FALSE
CREATE OR REPLACE FUNCTION fn_menu_quitar(p_restaurante_id INT, p_producto_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM producto_restaurante
    WHERE restaurante_id = p_restaurante_id AND producto_id = p_producto_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- ADMINISTRADORES Y SUS ROLES POR RESTAURANTE
-- =========================================================
CREATE OR REPLACE FUNCTION fn_administrador_crear(
    p_nombre VARCHAR, p_telefono VARCHAR, p_correo VARCHAR, p_password_hash VARCHAR
) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO administrador (nombre_administrador, telefono_administrador,
                               correo_administrador, password_hash)
    VALUES (p_nombre, p_telefono, p_correo, p_password_hash)
    RETURNING administrador_id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Devuelve el hash para que la aplicación compare la contraseña
CREATE OR REPLACE FUNCTION fn_administrador_login(p_correo VARCHAR)
RETURNS TABLE(administrador_id INT, nombre_administrador VARCHAR,
              correo_administrador VARCHAR, password_hash VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT a.administrador_id, a.nombre_administrador, a.correo_administrador, a.password_hash
    FROM administrador a
    WHERE a.correo_administrador = p_correo;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_administrador_actualizar_password(
    p_id INT, p_nuevo_password_hash VARCHAR
) RETURNS VOID AS $$
BEGIN
    UPDATE administrador SET password_hash = p_nuevo_password_hash WHERE administrador_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El administrador % no existe', p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Elimina primero sus asignaciones a restaurantes (sus refresh tokens se borran en cascada)
CREATE OR REPLACE FUNCTION fn_administrador_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM administrador_restaurante WHERE administrador_id = p_id;
    DELETE FROM administrador WHERE administrador_id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Asigna un administrador a un restaurante con un rol; si ya estaba asignado, actualiza rol y estado
CREATE OR REPLACE FUNCTION fn_administrador_asignar(
    p_restaurante_id INT, p_administrador_id INT, p_tipo_administrador_id INT,
    p_estado VARCHAR DEFAULT 'Activo'
) RETURNS VOID AS $$
BEGIN
    INSERT INTO administrador_restaurante (restaurante_id, administrador_id,
                                           tipo_administrador_id, estado)
    VALUES (p_restaurante_id, p_administrador_id, p_tipo_administrador_id, p_estado)
    ON CONFLICT (restaurante_id, administrador_id)
    DO UPDATE SET tipo_administrador_id = EXCLUDED.tipo_administrador_id,
                  estado = EXCLUDED.estado;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_administrador_desasignar(
    p_restaurante_id INT, p_administrador_id INT
) RETURNS VOID AS $$
BEGIN
    DELETE FROM administrador_restaurante
    WHERE restaurante_id = p_restaurante_id AND administrador_id = p_administrador_id;
END;
$$ LANGUAGE plpgsql;

-- Restaurantes de un administrador y rol que tiene en cada uno (se usa después del login)
CREATE OR REPLACE FUNCTION fn_administrador_restaurantes(p_administrador_id INT)
RETURNS TABLE(restaurante_id INT, nombre_restaurante VARCHAR,
              nombre_tipo_administrador VARCHAR, estado VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT r.restaurante_id, r.nombre_restaurante, t.nombre_tipo_administrador, ar.estado
    FROM administrador_restaurante ar
    JOIN restaurante r         ON r.restaurante_id = ar.restaurante_id
    JOIN tipo_administrador t  ON t.tipo_administrador_id = ar.tipo_administrador_id
    WHERE ar.administrador_id = p_administrador_id
    ORDER BY r.restaurante_id;
END;
$$ LANGUAGE plpgsql;

-- Administradores de un restaurante con su rol
CREATE OR REPLACE FUNCTION fn_restaurante_administradores(p_restaurante_id INT)
RETURNS TABLE(administrador_id INT, nombre_administrador VARCHAR, correo_administrador VARCHAR,
              nombre_tipo_administrador VARCHAR, estado VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT a.administrador_id, a.nombre_administrador, a.correo_administrador,
           t.nombre_tipo_administrador, ar.estado
    FROM administrador_restaurante ar
    JOIN administrador a       ON a.administrador_id = ar.administrador_id
    JOIN tipo_administrador t  ON t.tipo_administrador_id = ar.tipo_administrador_id
    WHERE ar.restaurante_id = p_restaurante_id
    ORDER BY t.tipo_administrador_id, a.nombre_administrador;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- REFRESH TOKENS (sesiones de los administradores)
-- =========================================================
CREATE OR REPLACE FUNCTION fn_refresh_token_crear(
    p_administrador_id INT, p_token_hash VARCHAR, p_expires_at TIMESTAMP
) RETURNS BIGINT AS $$
DECLARE v_id BIGINT;
BEGIN
    INSERT INTO refresh_tokens (administrador_id, token_hash, expires_at)
    VALUES (p_administrador_id, p_token_hash, p_expires_at)
    RETURNING refresh_token_id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Devuelve el administrador dueño del token solo si no está vencido ni revocado
CREATE OR REPLACE FUNCTION fn_refresh_token_validar(p_token_hash VARCHAR)
RETURNS TABLE(administrador_id INT) AS $$
BEGIN
    RETURN QUERY
    SELECT rt.administrador_id
    FROM refresh_tokens rt
    WHERE rt.token_hash = p_token_hash
      AND rt.revoked_at IS NULL
      AND rt.expires_at > CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Cierre de sesión
CREATE OR REPLACE FUNCTION fn_refresh_token_revocar(p_token_hash VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE refresh_tokens
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE token_hash = p_token_hash AND revoked_at IS NULL;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- PEDIDOS
-- =========================================================

-- Crea el pedido completo (cabecera, líneas y adiciones) en una sola operación.
-- El precio de cada producto y adición se toma del menú del restaurante y el total se calcula aquí.
--
-- p_items es un arreglo JSON; "adiciones" y "observaciones" son opcionales:
--   [
--     {"producto_id": 1, "cantidad": 2, "adiciones": [5, 7], "observaciones": "Sin cebolla"},
--     {"producto_id": 2, "cantidad": 1}
--   ]
CREATE OR REPLACE FUNCTION fn_pedido_crear(
    p_restaurante_id INT, p_nombre_cliente VARCHAR, p_telefono_cliente VARCHAR,
    p_correo_cliente VARCHAR, p_items JSONB, p_hora_recogida TIMESTAMP DEFAULT NULL
) RETURNS TABLE(pedido_id INT, codigo_seguimiento UUID) AS $$
#variable_conflict use_column
DECLARE
    v_estado_rest  VARCHAR;
    v_item         JSONB;
    v_producto_id  INT;
    v_cantidad     INT;
    v_adicion_id   INT;
    v_precio       NUMERIC;
    v_precio_ad    NUMERIC;
    v_subtotal     NUMERIC;
    v_total        NUMERIC := 0;
    v_pedido_id    INT;
    v_codigo       UUID;
    v_detalle_id   INT;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'El pedido debe tener al menos un producto';
    END IF;

    SELECT r.estado INTO v_estado_rest
    FROM restaurante r WHERE r.restaurante_id = p_restaurante_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El restaurante % no existe', p_restaurante_id;
    END IF;
    IF v_estado_rest = 'Cerrado' THEN
        RAISE EXCEPTION 'El restaurante % está cerrado', p_restaurante_id;
    END IF;

    -- Primera pasada: validar cada línea y calcular el total
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id')::INT;
        v_cantidad    := (v_item->>'cantidad')::INT;

        IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
            RAISE EXCEPTION 'La cantidad del producto % debe ser mayor a 0', v_producto_id;
        END IF;

        SELECT pr.precio INTO v_precio
        FROM producto_restaurante pr
        JOIN producto p      ON p.producto_id = pr.producto_id
        JOIN tipo_producto t ON t.tipo_producto_id = p.tipo_producto_id
        WHERE pr.restaurante_id = p_restaurante_id
          AND pr.producto_id = v_producto_id
          AND pr.disponible
          AND t.nombre_tipo_producto <> 'Adición';
        IF NOT FOUND THEN
            RAISE EXCEPTION 'El producto % no está disponible en el restaurante %',
                v_producto_id, p_restaurante_id;
        END IF;

        v_subtotal := v_precio;

        FOR v_adicion_id IN
            SELECT DISTINCT a.valor::INT
            FROM jsonb_array_elements_text(COALESCE(v_item->'adiciones', '[]'::jsonb)) AS a(valor)
        LOOP
            SELECT pr.precio INTO v_precio_ad
            FROM producto_restaurante pr
            JOIN producto p      ON p.producto_id = pr.producto_id
            JOIN tipo_producto t ON t.tipo_producto_id = p.tipo_producto_id
            WHERE pr.restaurante_id = p_restaurante_id
              AND pr.producto_id = v_adicion_id
              AND pr.disponible
              AND t.nombre_tipo_producto = 'Adición';
            IF NOT FOUND THEN
                RAISE EXCEPTION 'La adición % no está disponible en el restaurante %',
                    v_adicion_id, p_restaurante_id;
            END IF;
            v_subtotal := v_subtotal + v_precio_ad;
        END LOOP;

        v_total := v_total + v_cantidad * v_subtotal;
    END LOOP;

    -- Cabecera del pedido
    INSERT INTO pedido (restaurante_id, nombre_cliente, telefono_cliente, correo_cliente,
                        hora_recogida, total)
    VALUES (p_restaurante_id, p_nombre_cliente, p_telefono_cliente, p_correo_cliente,
            p_hora_recogida, v_total)
    RETURNING pedido.pedido_id, pedido.codigo_seguimiento INTO v_pedido_id, v_codigo;

    -- Segunda pasada: guardar líneas y adiciones con el precio histórico
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        v_producto_id := (v_item->>'producto_id')::INT;
        v_cantidad    := (v_item->>'cantidad')::INT;

        INSERT INTO detalle_pedido (restaurante_id, pedido_id, producto_id, cantidad,
                                    precio_unitario, observaciones)
        SELECT p_restaurante_id, v_pedido_id, v_producto_id, v_cantidad, pr.precio,
               NULLIF(trim(v_item->>'observaciones'), '')
        FROM producto_restaurante pr
        WHERE pr.restaurante_id = p_restaurante_id AND pr.producto_id = v_producto_id
        RETURNING detalle_pedido_id INTO v_detalle_id;

        INSERT INTO detalle_pedido_adicion (detalle_pedido_id, adicion_id, restaurante_id,
                                            precio_adicion)
        SELECT v_detalle_id, pr.producto_id, p_restaurante_id, pr.precio
        FROM producto_restaurante pr
        WHERE pr.restaurante_id = p_restaurante_id
          AND pr.producto_id IN (
              SELECT DISTINCT a.valor::INT
              FROM jsonb_array_elements_text(COALESCE(v_item->'adiciones', '[]'::jsonb)) AS a(valor)
          );
    END LOOP;

    RETURN QUERY SELECT v_pedido_id, v_codigo;
END;
$$ LANGUAGE plpgsql;

-- Seguimiento del pedido por parte del cliente (sin registro, con su código)
CREATE OR REPLACE FUNCTION fn_pedido_obtener_por_codigo(p_codigo UUID)
RETURNS TABLE(pedido_id INT, nombre_restaurante VARCHAR, nombre_cliente VARCHAR,
              estado VARCHAR, total NUMERIC, fecha TIMESTAMP, hora_recogida TIMESTAMP,
              tiempo_pedido INT) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT p.pedido_id, r.nombre_restaurante, p.nombre_cliente, p.estado, p.total,
           p.fecha, p.hora_recogida, r.tiempo_pedido
    FROM pedido p
    JOIN restaurante r ON r.restaurante_id = p.restaurante_id
    WHERE p.codigo_seguimiento = p_codigo;
END;
$$ LANGUAGE plpgsql;

-- Líneas del pedido con sus adiciones, observaciones y subtotal
CREATE OR REPLACE FUNCTION fn_pedido_detalle(p_pedido_id INT)
RETURNS TABLE(detalle_pedido_id INT, nombre_producto VARCHAR, cantidad INT,
              precio_unitario NUMERIC, adiciones TEXT, observaciones VARCHAR,
              subtotal NUMERIC) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT dp.detalle_pedido_id, p.nombre_producto, dp.cantidad, dp.precio_unitario,
           (SELECT string_agg(pa.nombre_producto, ', ' ORDER BY pa.nombre_producto)
              FROM detalle_pedido_adicion dpa
              JOIN producto pa ON pa.producto_id = dpa.adicion_id
             WHERE dpa.detalle_pedido_id = dp.detalle_pedido_id),
           dp.observaciones,
           dp.cantidad * (dp.precio_unitario + COALESCE(
               (SELECT SUM(dpa.precio_adicion)
                  FROM detalle_pedido_adicion dpa
                 WHERE dpa.detalle_pedido_id = dp.detalle_pedido_id), 0))
    FROM detalle_pedido dp
    JOIN producto p ON p.producto_id = dp.producto_id
    WHERE dp.pedido_id = p_pedido_id
    ORDER BY dp.detalle_pedido_id;
END;
$$ LANGUAGE plpgsql;

-- Pedidos en curso de un restaurante (los que ve cocina), del más antiguo al más reciente
CREATE OR REPLACE FUNCTION fn_pedido_obtener_activos(p_restaurante_id INT)
RETURNS TABLE(pedido_id INT, nombre_cliente VARCHAR, estado VARCHAR, total NUMERIC,
              fecha TIMESTAMP, hora_recogida TIMESTAMP) AS $$
#variable_conflict use_column
BEGIN
    RETURN QUERY
    SELECT p.pedido_id, p.nombre_cliente, p.estado, p.total, p.fecha, p.hora_recogida
    FROM pedido p
    WHERE p.restaurante_id = p_restaurante_id
      AND p.estado IN ('PAGADO', 'EN_PREPARACION', 'LISTO')
    ORDER BY p.fecha ASC;
END;
$$ LANGUAGE plpgsql;

-- Avanza el estado del pedido (también sirve para cancelarlo: 'CANCELADO')
CREATE OR REPLACE FUNCTION fn_pedido_cambiar_estado(p_id INT, p_nuevo_estado VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE pedido SET estado = p_nuevo_estado WHERE pedido_id = p_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pedido % no existe', p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- PAGOS
-- =========================================================

-- Registra el pago de un pedido y lo pasa a 'PAGADO'.
-- Solo acepta pedidos pendientes y montos que cubran el total.
CREATE OR REPLACE FUNCTION fn_pago_registrar(
    p_pedido_id INT, p_tipo_pago_id INT, p_monto NUMERIC
) RETURNS INT AS $$
DECLARE
    v_total   NUMERIC;
    v_estado  VARCHAR;
    v_pago_id INT;
BEGIN
    SELECT p.total, p.estado INTO v_total, v_estado
    FROM pedido p WHERE p.pedido_id = p_pedido_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pedido % no existe', p_pedido_id;
    END IF;
    IF v_estado NOT IN ('PENDIENTE', 'EN_PAGO') THEN
        RAISE EXCEPTION 'El pedido % está en estado % y no admite pago', p_pedido_id, v_estado;
    END IF;
    IF p_monto <> v_total THEN
        RAISE EXCEPTION 'El monto % no cubre el total del pedido (%)', p_monto, v_total;
    END IF;

    INSERT INTO pago (tipo_pago_id, pedido_id, estado, monto_pagado)
    VALUES (p_tipo_pago_id, p_pedido_id, 'APROBADO', p_monto)
    RETURNING pago_id INTO v_pago_id;

    UPDATE pedido SET estado = 'PAGADO' WHERE pedido_id = p_pedido_id;
    RETURN v_pago_id;
END;
$$ LANGUAGE plpgsql;


-- ----------------------------------------------------------------------------
-- 4. DATOS INICIALES (usando las funciones)
-- ----------------------------------------------------------------------------

-- Restaurantes (ids 1 y 2)
SELECT fn_restaurante_crear('Cafetería Central - Bloque 11', 'Bloque 11', 'Abierto', 15);
SELECT fn_restaurante_crear('Cafetería Montana del Boulevard', 'Boulevard', 'Abierto', 10);

-- Tipos de producto (ids 1 a 4). 'Adición' es el tipo que usan los extras.
SELECT fn_tipo_producto_crear('Almuerzos');
SELECT fn_tipo_producto_crear('Bebidas');
SELECT fn_tipo_producto_crear('Snacks');
SELECT fn_tipo_producto_crear('Adición');

-- Tipos de pago
SELECT fn_tipo_pago_crear('Efectivo');
SELECT fn_tipo_pago_crear('Tarjeta');
SELECT fn_tipo_pago_crear('Transferencia');

-- Productos del catálogo global (ids 1 a 7)
SELECT fn_producto_crear(1, 'Ejecutivo de Carne', 'Carne acompañada de arroz, ensalada y papas.');
SELECT fn_producto_crear(2, 'Jugo Natural 16oz', 'Jugo natural de fruta preparado al momento.');
SELECT fn_producto_crear(3, 'Sandwich Gourmet', 'Sandwich gourmet preparado con ingredientes frescos.');
SELECT fn_producto_crear(2, 'Café Latte', 'Café latte preparado con espresso y leche.');
SELECT fn_producto_crear(4, 'Queso extra', 'Porción adicional de queso.');
SELECT fn_producto_crear(4, 'Piña', 'Rodajas de piña.');
SELECT fn_producto_crear(4, 'Ensalada', 'Porción de ensalada fresca.');

-- Menú de Cafetería Central (restaurante 1): cada restaurante define sus precios
SELECT fn_menu_asignar(1, 1, 15000.00, 'https://images.unsplash.com/photo-1547592180-85f173990554');
SELECT fn_menu_asignar(1, 2,  4500.00, 'https://images.unsplash.com/photo-1600271886742-f049cd451bba');
SELECT fn_menu_asignar(1, 5,  2000.00);
SELECT fn_menu_asignar(1, 7,  1500.00);

-- Menú de Cafetería Montana del Boulevard (restaurante 2)
SELECT fn_menu_asignar(2, 3, 12500.00, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af');
SELECT fn_menu_asignar(2, 4,  5500.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93');
SELECT fn_menu_asignar(2, 5,  2500.00);
SELECT fn_menu_asignar(2, 6,  1500.00);

-- Administradores de demostración (ids 1 y 2)
SELECT fn_administrador_crear('Administrador Central', '3000000001', 'admin@upb.edu.co',
    '$2a$10$tyIhSPUO.tPXDrUKklBiJef3B9OlrWZeazp5iJT0v3LQ6h0Zq7SnS');
SELECT fn_administrador_crear('Administrador Boulevard', '3000000002', 'admin2@upb.edu.co',
    '$2a$10$0gCFeH/1cEHW30aS1ehcJ.HtLbZvFpBYTmaRXYcgkOWdetsasSQDO');

-- Roles por restaurante (1 = Dueño de restaurante, 2 = Administrador de cocina)
SELECT fn_administrador_asignar(1, 1, 1);   -- admin: dueño del restaurante 1
SELECT fn_administrador_asignar(2, 2, 1);   -- admin2: dueño del restaurante 2