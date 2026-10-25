-- Configura algunos extras coherentes con los productos del menú de ejemplo.
-- Es idempotente: puede ejecutarse más de una vez sin duplicar registros.

INSERT INTO producto (tipo_producto_id, nombre_producto, descripcion_producto)
SELECT tp.tipo_producto_id, 'Tocineta extra', 'Porción adicional de tocineta.'
FROM tipo_producto tp
WHERE LOWER(tp.nombre_tipo_producto) = LOWER('Adición')
  AND NOT EXISTS (
      SELECT 1 FROM producto p WHERE LOWER(p.nombre_producto) = LOWER('Tocineta extra')
  );

INSERT INTO producto (tipo_producto_id, nombre_producto, descripcion_producto)
SELECT tp.tipo_producto_id, 'Extra pulpa', 'Porción adicional de pulpa de fruta.'
FROM tipo_producto tp
WHERE LOWER(tp.nombre_tipo_producto) = LOWER('Adición')
  AND NOT EXISTS (
      SELECT 1 FROM producto p WHERE LOWER(p.nombre_producto) = LOWER('Extra pulpa')
  );

-- Disponibilidad y precios independientes por cafetería.
INSERT INTO producto_restaurante (restaurante_id, producto_id, precio, disponible)
SELECT r.restaurante_id, p.producto_id, 2500, TRUE
FROM restaurante r
CROSS JOIN producto p
WHERE r.nombre_restaurante = 'Cafetería Montana del Boulevard'
  AND p.nombre_producto = 'Tocineta extra'
ON CONFLICT (restaurante_id, producto_id) DO NOTHING;

INSERT INTO producto_restaurante (restaurante_id, producto_id, precio, disponible)
SELECT r.restaurante_id, p.producto_id, 1000, TRUE
FROM restaurante r
CROSS JOIN producto p
WHERE r.nombre_restaurante = 'Cafetería Central - Bloque 11'
  AND p.nombre_producto = 'Extra pulpa'
ON CONFLICT (restaurante_id, producto_id) DO NOTHING;

-- Ejecutivo: queso extra. Jugo: pulpa adicional. Sándwich: queso y tocineta.
INSERT INTO producto_adicion (restaurante_id, producto_id, adicion_id)
SELECT r.restaurante_id, menu.producto_id, extra.producto_id
FROM restaurante r
JOIN producto menu ON menu.nombre_producto = 'Ejecutivo de Carne'
JOIN producto extra ON extra.nombre_producto = 'Queso extra'
JOIN producto_restaurante pr_menu
  ON pr_menu.restaurante_id = r.restaurante_id AND pr_menu.producto_id = menu.producto_id
JOIN producto_restaurante pr_extra
  ON pr_extra.restaurante_id = r.restaurante_id AND pr_extra.producto_id = extra.producto_id
WHERE r.nombre_restaurante = 'Cafetería Central - Bloque 11'
ON CONFLICT DO NOTHING;

INSERT INTO producto_adicion (restaurante_id, producto_id, adicion_id)
SELECT r.restaurante_id, menu.producto_id, extra.producto_id
FROM restaurante r
JOIN producto menu ON menu.nombre_producto = 'Jugo Natural 16oz'
JOIN producto extra ON extra.nombre_producto = 'Extra pulpa'
JOIN producto_restaurante pr_menu
  ON pr_menu.restaurante_id = r.restaurante_id AND pr_menu.producto_id = menu.producto_id
JOIN producto_restaurante pr_extra
  ON pr_extra.restaurante_id = r.restaurante_id AND pr_extra.producto_id = extra.producto_id
WHERE r.nombre_restaurante = 'Cafetería Central - Bloque 11'
ON CONFLICT DO NOTHING;

INSERT INTO producto_adicion (restaurante_id, producto_id, adicion_id)
SELECT r.restaurante_id, menu.producto_id, extra.producto_id
FROM restaurante r
JOIN producto menu ON menu.nombre_producto = 'Sandwich Gourmet'
JOIN producto extra ON extra.nombre_producto IN ('Queso extra', 'Tocineta extra')
JOIN producto_restaurante pr_menu
  ON pr_menu.restaurante_id = r.restaurante_id AND pr_menu.producto_id = menu.producto_id
JOIN producto_restaurante pr_extra
  ON pr_extra.restaurante_id = r.restaurante_id AND pr_extra.producto_id = extra.producto_id
WHERE r.nombre_restaurante = 'Cafetería Montana del Boulevard'
ON CONFLICT DO NOTHING;
