-- ============================================================================
-- PROYECTO: Sistema de Cafeterías UPB
-- BASE DE DATOS: PostgreSQL 16.14
-- ESTRUCTURA: Tablas Normalizadas (3FN) + Funciones Almacenadas (CRUD)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LIMPIEZA PREVENTIVA DE TABLAS Y FUNCIONES
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS detalle_pedidos CASCADE;
DROP TABLE IF EXISTS pedidos CASCADE;
DROP TABLE IF EXISTS clientes CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS categorias CASCADE;
DROP TABLE IF EXISTS usuarios_admin CASCADE;
DROP TABLE IF EXISTS restaurantes CASCADE;

DROP FUNCTION IF EXISTS fn_restaurante_crear;
DROP FUNCTION IF EXISTS fn_restaurante_obtener_todos;
DROP FUNCTION IF EXISTS fn_restaurante_actualizar;
DROP FUNCTION IF EXISTS fn_restaurante_eliminar;

DROP FUNCTION IF EXISTS fn_categoria_crear;
DROP FUNCTION IF EXISTS fn_categoria_obtener_todas;
DROP FUNCTION IF EXISTS fn_categoria_actualizar;
DROP FUNCTION IF EXISTS fn_categoria_eliminar;

DROP FUNCTION IF EXISTS fn_producto_crear;
DROP FUNCTION IF EXISTS fn_producto_obtener_todos;
DROP FUNCTION IF EXISTS fn_producto_actualizar;
DROP FUNCTION IF EXISTS fn_producto_eliminar;

DROP FUNCTION IF EXISTS fn_cliente_crear;
DROP FUNCTION IF EXISTS fn_cliente_obtener_por_correo;
DROP FUNCTION IF EXISTS fn_cliente_actualizar;
DROP FUNCTION IF EXISTS fn_cliente_eliminar;

DROP FUNCTION IF EXISTS fn_pedido_crear;
DROP FUNCTION IF EXISTS fn_pedido_obtener_activos;
DROP FUNCTION IF EXISTS fn_pedido_cambiar_estado;
DROP FUNCTION IF EXISTS fn_pedido_eliminar;

DROP FUNCTION IF EXISTS fn_detalle_pedido_crear;
DROP FUNCTION IF EXISTS fn_detalle_pedido_obtener_por_pedido;
DROP FUNCTION IF EXISTS fn_detalle_pedido_actualizar;
DROP FUNCTION IF EXISTS fn_detalle_pedido_eliminar;

DROP FUNCTION IF EXISTS fn_usuario_admin_crear;
DROP FUNCTION IF EXISTS fn_usuario_admin_login;
DROP FUNCTION IF EXISTS fn_usuario_admin_actualizar_password;
DROP FUNCTION IF EXISTS fn_usuario_admin_eliminar;


-- ----------------------------------------------------------------------------
-- 2. CREACIÓN DE TABLAS NORMALIZADAS (3FN)
-- ----------------------------------------------------------------------------

-- Tabla 1: Restaurantes / Cafeterías (HU001, HU002)
CREATE TABLE restaurantes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ubicacion VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'Abierto' 
        CONSTRAINT chk_estado_restaurante CHECK (estado IN ('Abierto', 'Cerrado', 'Alta demanda')),
    tiempo_estimado_min INT DEFAULT 15 CONSTRAINT chk_tiempo_positivo CHECK (tiempo_estimado_min > 0)
);

-- Tabla 2: Categorías de Menú
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

-- Tabla 3: Productos del Catálogo (HU004, HU005, HU016, HU017, HU018, HU019)
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    restaurante_id INT NOT NULL CONSTRAINT fk_prod_rest REFERENCES restaurantes(id) ON DELETE CASCADE,
    categoria_id INT NOT NULL CONSTRAINT fk_prod_cat REFERENCES categorias(id),
    nombre VARCHAR(100) NOT NULL,
    precio NUMERIC(10,2) NOT NULL CONSTRAINT chk_precio_pos CHECK (precio >= 0),
    disponible BOOLEAN DEFAULT TRUE
);

-- Tabla 4: Clientes Registrados (HU010)
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    correo VARCHAR(100) UNIQUE NOT NULL, -- Correo institucional (@upb.edu.co)
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL
);

-- Tabla 5: Pedidos Generales (HU007, HU009, HU014, HU015)
CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    restaurante_id INT NOT NULL CONSTRAINT fk_ped_rest REFERENCES restaurantes(id) ON DELETE RESTRICT,
    cliente_id INT NOT NULL CONSTRAINT fk_ped_cli REFERENCES clientes(id),
    estado VARCHAR(30) DEFAULT 'NUEVO' 
        CONSTRAINT chk_estado_ped CHECK (estado IN ('NUEVO', 'EN_PREPARACION', 'ENTREGADO')),
    total NUMERIC(10,2) NOT NULL CONSTRAINT chk_total_pos CHECK (total >= 0),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla 6: Detalle del Pedido (HU008)
CREATE TABLE detalle_pedidos (
    id SERIAL PRIMARY KEY,
    pedido_id INT NOT NULL CONSTRAINT fk_det_ped REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INT NOT NULL CONSTRAINT fk_det_prod REFERENCES productos(id),
    cantidad INT NOT NULL CONSTRAINT chk_cant_pos CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL
);

-- Tabla 7: Usuarios de Administración de Cocina (HU012, HU013)
CREATE TABLE usuarios_admin (
    id SERIAL PRIMARY KEY,
    restaurante_id INT NOT NULL CONSTRAINT fk_usr_rest REFERENCES restaurantes(id) ON DELETE CASCADE,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);


-- ----------------------------------------------------------------------------
-- 3. FUNCIONES CRUD STORED PROCEDURES (PL/pgSQL)
-- ----------------------------------------------------------------------------

-- =========================================================
-- CRUD: RESTAURANTES
-- =========================================================
CREATE OR REPLACE FUNCTION fn_restaurante_crear(
    p_nombre VARCHAR, p_ubicacion VARCHAR, p_estado VARCHAR DEFAULT 'Abierto', p_tiempo INT DEFAULT 15
) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO restaurantes (nombre, ubicacion, estado, tiempo_estimado_min)
    VALUES (p_nombre, p_ubicacion, p_estado, p_tiempo) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_restaurante_obtener_todos()
RETURNS TABLE(id INT, nombre VARCHAR, ubicacion VARCHAR, estado VARCHAR, tiempo_estimado_min INT) AS $$
BEGIN
    RETURN QUERY SELECT r.id, r.nombre, r.ubicacion, r.estado, r.tiempo_estimado_min FROM restaurantes r;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_restaurante_actualizar(
    p_id INT, p_nombre VARCHAR, p_ubicacion VARCHAR, p_estado VARCHAR, p_tiempo INT
) RETURNS VOID AS $$
BEGIN
    UPDATE restaurantes 
    SET nombre = p_nombre, ubicacion = p_ubicacion, estado = p_estado, tiempo_estimado_min = p_tiempo 
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_restaurante_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM restaurantes WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CRUD: CATEGORIAS
-- =========================================================
CREATE OR REPLACE FUNCTION fn_categoria_crear(p_nombre VARCHAR) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO categorias (nombre) VALUES (p_nombre) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_categoria_obtener_todas()
RETURNS TABLE(id INT, nombre VARCHAR) AS $$
BEGIN
    RETURN QUERY SELECT c.id, c.nombre FROM categorias c;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_categoria_actualizar(p_id INT, p_nombre VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE categorias SET nombre = p_nombre WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_categoria_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM categorias WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CRUD: PRODUCTOS
-- =========================================================
CREATE OR REPLACE FUNCTION fn_producto_crear(
    p_restaurante_id INT, p_categoria_id INT, p_nombre VARCHAR, p_precio NUMERIC, p_disponible BOOLEAN DEFAULT TRUE
) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO productos (restaurante_id, categoria_id, nombre, precio, disponible)
    VALUES (p_restaurante_id, p_categoria_id, p_nombre, p_precio, p_disponible) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_producto_obtener_todos()
RETURNS TABLE(id INT, producto VARCHAR, precio NUMERIC, disponible BOOLEAN, restaurante VARCHAR, categoria VARCHAR) AS $$
BEGIN
    RETURN QUERY 
    SELECT p.id, p.nombre, p.precio, p.disponible, r.nombre, c.nombre
    FROM productos p
    JOIN restaurantes r ON p.restaurante_id = r.id
    JOIN categorias c ON p.categoria_id = c.id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_producto_actualizar(
    p_id INT, p_nombre VARCHAR, p_precio NUMERIC, p_disponible BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE productos 
    SET nombre = p_nombre, precio = p_precio, disponible = p_disponible 
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_producto_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM productos WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CRUD: CLIENTES
-- =========================================================
CREATE OR REPLACE FUNCTION fn_cliente_crear(p_correo VARCHAR, p_nombre VARCHAR, p_telefono VARCHAR) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO clientes (correo, nombre, telefono)
    VALUES (p_correo, p_nombre, p_telefono) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_cliente_obtener_por_correo(p_correo VARCHAR)
RETURNS TABLE(id INT, correo VARCHAR, nombre VARCHAR, telefono VARCHAR) AS $$
BEGIN
    RETURN QUERY SELECT c.id, c.correo, c.nombre, c.telefono FROM clientes c WHERE c.correo = p_correo;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_cliente_actualizar(p_id INT, p_nombre VARCHAR, p_telefono VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE clientes SET nombre = p_nombre, telefono = p_telefono WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_cliente_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM clientes WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CRUD: PEDIDOS
-- =========================================================
CREATE OR REPLACE FUNCTION fn_pedido_crear(p_restaurante_id INT, p_cliente_id INT, p_total NUMERIC) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO pedidos (restaurante_id, cliente_id, total)
    VALUES (p_restaurante_id, p_cliente_id, p_total) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_pedido_obtener_activos()
RETURNS TABLE(id INT, cliente VARCHAR, estado VARCHAR, total NUMERIC, fecha_creacion TIMESTAMP) AS $$
BEGIN
    RETURN QUERY 
    SELECT p.id, c.nombre, p.estado, p.total, p.fecha_creacion
    FROM pedidos p
    JOIN clientes c ON p.cliente_id = c.id
    WHERE p.estado IN ('NUEVO', 'EN_PREPARACION')
    ORDER BY p.fecha_creacion ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_pedido_cambiar_estado(p_id INT, p_nuevo_estado VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE pedidos SET estado = p_nuevo_estado WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_pedido_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM pedidos WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CRUD: DETALLE PEDIDOS
-- =========================================================
CREATE OR REPLACE FUNCTION fn_detalle_pedido_crear(
    p_pedido_id INT, p_producto_id INT, p_cantidad INT, p_precio_unitario NUMERIC
) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO detalle_pedidos (pedido_id, producto_id, cantidad, precio_unitario)
    VALUES (p_pedido_id, p_producto_id, p_cantidad, p_precio_unitario) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_detalle_pedido_obtener_por_pedido(p_pedido_id INT)
RETURNS TABLE(id INT, producto VARCHAR, cantidad INT, precio_unitario NUMERIC, subtotal NUMERIC) AS $$
BEGIN
    RETURN QUERY 
    SELECT dp.id, p.nombre, dp.cantidad, dp.precio_unitario, (dp.cantidad * dp.precio_unitario)
    FROM detalle_pedidos dp
    JOIN productos p ON dp.producto_id = p.id
    WHERE dp.pedido_id = p_pedido_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_detalle_pedido_actualizar(p_id INT, p_cantidad INT, p_precio_unitario NUMERIC) RETURNS VOID AS $$
BEGIN
    UPDATE detalle_pedidos SET cantidad = p_cantidad, precio_unitario = p_precio_unitario WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_detalle_pedido_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM detalle_pedidos WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- =========================================================
-- CRUD: USUARIOS ADMIN
-- =========================================================
CREATE OR REPLACE FUNCTION fn_usuario_admin_crear(p_restaurante_id INT, p_email VARCHAR, p_password_hash VARCHAR) RETURNS INT AS $$
DECLARE v_id INT;
BEGIN
    INSERT INTO usuarios_admin (restaurante_id, email, password_hash)
    VALUES (p_restaurante_id, p_email, p_password_hash) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_usuario_admin_login(p_email VARCHAR)
RETURNS TABLE(id INT, email VARCHAR, password_hash VARCHAR, restaurante VARCHAR) AS $$
BEGIN
    RETURN QUERY 
    SELECT u.id, u.email, u.password_hash, r.nombre
    FROM usuarios_admin u
    JOIN restaurantes r ON u.restaurante_id = r.id
    WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_usuario_admin_actualizar_password(p_id INT, p_nuevo_password_hash VARCHAR) RETURNS VOID AS $$
BEGIN
    UPDATE usuarios_admin SET password_hash = p_nuevo_password_hash WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_usuario_admin_eliminar(p_id INT) RETURNS VOID AS $$
BEGIN
    DELETE FROM usuarios_admin WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;


-- ----------------------------------------------------------------------------
-- 4. INSERCIÓN DE DATOS INICIALES USANDO EXCLUSIVAMENTE LAS FUNCIONES
-- ----------------------------------------------------------------------------
SELECT fn_restaurante_crear('Cafetería Central - Bloque 11', 'Bloque 11', 'Abierto', 15);
SELECT fn_restaurante_crear('Cafetería Montana del Boulevard', 'Boulevard', 'Abierto', 10);
SELECT fn_categoria_crear('Almuerzos');
SELECT fn_categoria_crear('Bebidas');
SELECT fn_categoria_crear('Snacks');

SELECT fn_producto_crear(1, 1, 'Ejecutivo de Carne', 15000.00, TRUE);
SELECT fn_producto_crear(1, 2, 'Jugo Natural 16oz', 4500.00, TRUE);
SELECT fn_producto_crear(2, 3, 'Sandwich Gourmet Boulevard', 12500.00, TRUE);
SELECT fn_producto_crear(2, 2, 'Café Latte Montana', 5500.00, TRUE);

-- Usuario administrativo de demostración para el login del panel administrativo
SELECT fn_usuario_admin_crear(1, 'admin@upb.edu.co', 'admin123');

