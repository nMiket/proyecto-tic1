
package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.CreateProductRequest;
import com.upbfood.Backend.dto.UpdateProductRequest;
import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.entity.ProductoRestaurante;
import com.upbfood.Backend.entity.ProductoRestauranteId;
import com.upbfood.Backend.repository.ProductRepository;
import com.upbfood.Backend.repository.ProductoRestauranteRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ProductController {

    private final ProductRepository productRepository;
    private final ProductoRestauranteRepository productoRestauranteRepository;
    private final AdminAuthorizationService authorizationService;
    private final JdbcTemplate jdbcTemplate;

    public ProductController(
            ProductRepository productRepository,
            ProductoRestauranteRepository productoRestauranteRepository,
            AdminAuthorizationService authorizationService,
            JdbcTemplate jdbcTemplate) {
        this.productRepository = productRepository;
        this.productoRestauranteRepository = productoRestauranteRepository;
        this.authorizationService = authorizationService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @GetMapping({"/products", "/productos"})
    public ResponseEntity<List<Map<String, Object>>> listProducts(
            @RequestParam Integer restauranteId) {
        return getProductsByRestaurant(restauranteId);
    }

    
        @GetMapping("/productos/admin")
        public ResponseEntity<List<Map<String, Object>>> listProductosAdmin(
                @RequestParam Integer restauranteId) {

        authorizationService.requireAdminForRestaurant(restauranteId);

        return getProductsByRestaurant(restauranteId);
        }


    private ResponseEntity<List<Map<String, Object>>> getProductsByRestaurant(
            Integer restauranteId) {

        List<ProductoRestaurante> asociaciones =
                productoRestauranteRepository
                        .findByIdRestauranteIdOrderByIdProductoIdAsc(restauranteId);

        if (asociaciones.isEmpty()) {
            return ResponseEntity.ok(List.of());
        }

        List<Integer> productoIds = asociaciones.stream()
                .map(a -> a.getId().getProductoId())
                .toList();

        Map<Integer, Product> productosPorId = new HashMap<>();
        for (Product p : productRepository.findAllById(productoIds)) {
            productosPorId.put(p.getId(), p);
        }

        Map<Integer, List<Map<String, Object>>> extrasPorProducto =
                obtenerExtrasAgrupadosPorRestaurante(restauranteId);

        List<Map<String, Object>> response = new ArrayList<>();

        for (ProductoRestaurante asociacion : asociaciones) {
            Integer productoId = asociacion.getId().getProductoId();

            Product product = productosPorId.get(productoId);
            if (product == null) {
                product = productRepository.findById(productoId)
                        .orElseThrow(() ->
                                new IllegalStateException(
                                        "No se encontró el producto asociado al restaurante."));
            }

            // Las adiciones se administran por separado y no aparecen como productos del menú.
            if (product.getTipoProductoId() == 4) {
                continue;
            }
            response.add(toResponse(
                    product,
                    asociacion,
                    extrasPorProducto.getOrDefault(productoId, List.of())));
        }

        return ResponseEntity.ok(response);
    }

    private Map<Integer, List<Map<String, Object>>> obtenerExtrasAgrupadosPorRestaurante(
            Integer restauranteId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT pa.producto_id AS parent_producto_id,
                       p.producto_id AS id,
                       COALESCE(pr.nombre_personalizado, p.nombre_producto) AS nombre,
                       pr.precio
                FROM producto_adicion pa
                JOIN producto_restaurante pr
                  ON pr.restaurante_id = pa.restaurante_id AND pr.producto_id = pa.adicion_id
                JOIN producto p ON p.producto_id = pr.producto_id
                WHERE pa.restaurante_id = ?
                  AND pr.disponible = TRUE
                ORDER BY pa.producto_id, p.nombre_producto
                """,
                restauranteId);

        Map<Integer, List<Map<String, Object>>> agrupados = new HashMap<>();
        if (rows == null) {
            return agrupados;
        }
        for (Map<String, Object> row : rows) {
            Object parentObj = row.get("parent_producto_id");
            if (!(parentObj instanceof Number parentNum)) {
                continue;
            }
            Map<String, Object> extra = new HashMap<>();
            extra.put("id", row.get("id"));
            extra.put("nombre", row.get("nombre"));
            extra.put("precio", row.get("precio"));
            agrupados.computeIfAbsent(parentNum.intValue(), k -> new ArrayList<>()).add(extra);
        }
        return agrupados;
    }

    @GetMapping("/productos/extras")
    public ResponseEntity<List<Map<String, Object>>> listExtras(@RequestParam Integer restauranteId) {
        authorizationService.requireAdminForRestaurant(restauranteId);
        List<Map<String, Object>> extras = jdbcTemplate.queryForList(
                """
                SELECT p.producto_id AS id, COALESCE(pr.nombre_personalizado, p.nombre_producto) AS nombre,
                       p.descripcion_producto AS descripcion, pr.precio,
                       pr.disponible
                FROM producto_restaurante pr
                JOIN producto p ON p.producto_id = pr.producto_id
                WHERE pr.restaurante_id = ? AND p.tipo_producto_id = 4
                ORDER BY p.nombre_producto
                """, restauranteId);
        return ResponseEntity.ok(extras);
    }

    @Transactional
    @PatchMapping("/productos/{id}/disponibilidad")
    public ResponseEntity<Map<String, Object>> updateProductAvailability(
            @PathVariable Integer id,
            @RequestParam Integer restauranteId,
            @RequestBody Map<String, Boolean> request) {
        // Dueño y administrador de cocina (con asignación activa) pueden cambiar la disponibilidad.
        authorizationService.requireOwnerOrKitchenForRestaurant(restauranteId);

        Boolean disponible = request.get("disponible");
        if (disponible == null) {
            throw new IllegalArgumentException("Debes indicar si el producto está disponible.");
        }

        Product product = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Producto no encontrado."));
        if (product.getTipoProductoId() == 4) {
            throw new IllegalArgumentException("Los ingredientes extra se administran desde el panel del restaurante.");
        }

        ProductoRestauranteId associationId = new ProductoRestauranteId(restauranteId, id);
        ProductoRestaurante association = productoRestauranteRepository.findById(associationId)
                .orElseThrow(() -> new IllegalArgumentException("El producto no pertenece a esta cafetería."));
        association.setDisponible(disponible);
        productoRestauranteRepository.save(association);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("id", id);
        response.put("disponible", disponible);
        response.put("message", "Disponibilidad actualizada correctamente.");
        return ResponseEntity.ok(response);
    }

    @Transactional
    @PutMapping("/productos/extras/{id}")
    public ResponseEntity<Map<String, Object>> updateExtra(
            @PathVariable Integer id,
            @RequestParam Integer restauranteId,
            @RequestBody Map<String, Object> request) {
        authorizationService.requireOwnerForRestaurant(restauranteId);
        ProductoRestauranteId associationId = new ProductoRestauranteId(restauranteId, id);
        ProductoRestaurante association = productoRestauranteRepository.findById(associationId)
                .orElseThrow(() -> new IllegalArgumentException("El ingrediente extra no pertenece a este restaurante."));
        Product extra = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Ingrediente extra no encontrado."));
        if (extra.getTipoProductoId() != 4) {
            throw new IllegalArgumentException("El producto seleccionado no es un ingrediente extra.");
        }
        String nombre = String.valueOf(request.getOrDefault("nombre", "")).trim();
        BigDecimal precio;
        try {
            precio = new BigDecimal(String.valueOf(request.get("precio")));
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException("El precio debe ser un número válido.");
        }
        if (nombre.isBlank() || nombre.length() > 50 || precio.signum() <= 0) {
            throw new IllegalArgumentException("Escribe un nombre y un precio mayor que cero.");
        }
        // El nombre del extra se guarda en la asociación para que cada cafetería
        // pueda personalizarlo sin cambiar el nombre global usado por otras.
        jdbcTemplate.update(
                "UPDATE producto_restaurante SET nombre_personalizado = ?, precio = ? WHERE restaurante_id = ? AND producto_id = ?",
                nombre, precio, restauranteId, id);
        association.setPrecio(precio);
        productoRestauranteRepository.save(association);
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Ingrediente extra actualizado.");
        return ResponseEntity.ok(result);
    }

    @Transactional
    @PutMapping("/productos/{id}/extras")
    public ResponseEntity<Map<String, Object>> updateProductExtras(
            @PathVariable Integer id,
            @RequestParam Integer restauranteId,
            @RequestBody Map<String, List<Integer>> request) {
        authorizationService.requireOwnerForRestaurant(restauranteId);

        Integer productoExiste = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM producto_restaurante WHERE restaurante_id = ? AND producto_id = ?",
                Integer.class, restauranteId, id);
        if (productoExiste == null || productoExiste == 0) {
            throw new IllegalArgumentException("El producto no pertenece a este restaurante.");
        }
        Integer esAdicion = jdbcTemplate.queryForObject(
                "SELECT tipo_producto_id FROM producto WHERE producto_id = ?", Integer.class, id);
        if (esAdicion != null && esAdicion == 4) {
            throw new IllegalArgumentException("No se pueden asignar extras a otro ingrediente extra.");
        }

        List<Integer> ids = request.getOrDefault("adiciones", List.of());
        jdbcTemplate.update("DELETE FROM producto_adicion WHERE restaurante_id = ? AND producto_id = ?", restauranteId, id);
        for (Integer adicionId : ids.stream().filter(java.util.Objects::nonNull).distinct().toList()) {
            Integer valida = jdbcTemplate.queryForObject(
                    """
                    SELECT COUNT(*) FROM producto_restaurante pr
                    JOIN producto p ON p.producto_id = pr.producto_id
                    WHERE pr.restaurante_id = ? AND pr.producto_id = ?
                      AND pr.disponible = TRUE AND p.tipo_producto_id = 4
                    """, Integer.class, restauranteId, adicionId);
            if (valida == null || valida == 0) {
                throw new IllegalArgumentException("Uno de los ingredientes extra no está disponible en este restaurante.");
            }
            jdbcTemplate.update(
                    "INSERT INTO producto_adicion (restaurante_id, producto_id, adicion_id) VALUES (?, ?, ?)",
                    restauranteId, id, adicionId);
        }
        Map<String, Object> result = new HashMap<>();
        result.put("success", true);
        result.put("message", "Ingredientes extra actualizados.");
        return ResponseEntity.ok(result);
    }

    @Transactional
    @PostMapping({"/products", "/productos"})
    public ResponseEntity<Map<String, Object>> createProduct(
            @Valid @RequestBody CreateProductRequest request) {

        authorizationService.requireOwnerForRestaurant(
                request.restauranteId());

        String imagenLimpia = normalizarYValidarImagen(request.imagenUrl());

        Product product = new Product();
        product.setNombre(request.nombre().trim());
        product.setDescripcion(request.descripcion().trim());
        product.setTipoProductoId(request.categoriaId());

        Product savedProduct = productRepository.save(product);

        ProductoRestaurante asociacion = new ProductoRestaurante();
        asociacion.setId(new ProductoRestauranteId(
                request.restauranteId(),
                savedProduct.getId()));
        asociacion.setPrecio(request.precio());
        asociacion.setImagenUrl(imagenLimpia);
        asociacion.setDisponible(request.disponible());

        ProductoRestaurante savedAssociation =
                productoRestauranteRepository.save(asociacion);

        Map<String, Object> response =
                toResponse(savedProduct, savedAssociation);
        response.put("message", "Producto creado correctamente.");

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @Transactional
    @PutMapping("/products/{id}")
    public ResponseEntity<Map<String, Object>> updateProduct(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateProductRequest request) {

        authorizationService.requireOwnerForRestaurant(
                request.restauranteId());

        String imagenLimpia = normalizarYValidarImagen(request.imagenUrl());

        Product product = productRepository.findById(id)
                .orElseThrow(() ->
                        new IllegalArgumentException("Producto no encontrado."));

        ProductoRestauranteId associationId =
                new ProductoRestauranteId(request.restauranteId(), id);

        ProductoRestaurante asociacion =
                productoRestauranteRepository.findById(associationId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "El producto no está asociado a este restaurante."));

        Integer otrosRestaurantes = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM producto_restaurante WHERE producto_id = ? AND restaurante_id <> ?",
                Integer.class, id, request.restauranteId());

        if (otrosRestaurantes != null && otrosRestaurantes > 0) {
            // Si el producto estaba compartido en el catálogo inicial, se independiza para esta cafetería.
            Product independizado = new Product();
            independizado.setNombre(request.nombre().trim());
            independizado.setDescripcion(request.descripcion().trim());
            independizado.setTipoProductoId(request.categoriaId());
            Product savedNuevo = productRepository.save(independizado);

            ProductoRestaurante nuevaAsociacion = new ProductoRestaurante();
            nuevaAsociacion.setId(new ProductoRestauranteId(request.restauranteId(), savedNuevo.getId()));
            nuevaAsociacion.setPrecio(request.precio());
            nuevaAsociacion.setImagenUrl(imagenLimpia);
            nuevaAsociacion.setDisponible(request.disponible());
            ProductoRestaurante savedAsociacion = productoRestauranteRepository.save(nuevaAsociacion);

            jdbcTemplate.update(
                    "INSERT INTO producto_adicion (restaurante_id, producto_id, adicion_id) " +
                    "SELECT restaurante_id, ?, adicion_id FROM producto_adicion WHERE restaurante_id = ? AND producto_id = ?",
                    savedNuevo.getId(), request.restauranteId(), id);
            jdbcTemplate.update(
                    "DELETE FROM producto_adicion WHERE restaurante_id = ? AND producto_id = ?",
                    request.restauranteId(), id);

            Integer ventasAnteriores = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM detalle_pedido WHERE restaurante_id = ? AND producto_id = ?",
                    Integer.class, request.restauranteId(), id);
            if (ventasAnteriores == null || ventasAnteriores == 0) {
                productoRestauranteRepository.delete(asociacion);
            } else {
                asociacion.setDisponible(false);
                productoRestauranteRepository.save(asociacion);
            }

            Map<String, Object> response = toResponse(savedNuevo, savedAsociacion);
            response.put("message", "Producto actualizado correctamente.");
            return ResponseEntity.ok(response);
        }

        product.setNombre(request.nombre().trim());
        product.setDescripcion(request.descripcion().trim());
        product.setTipoProductoId(request.categoriaId());

        asociacion.setPrecio(request.precio());
        asociacion.setImagenUrl(imagenLimpia);
        asociacion.setDisponible(request.disponible());

        Product updatedProduct = productRepository.save(product);
        ProductoRestaurante updatedAssociation =
                productoRestauranteRepository.save(asociacion);

        Map<String, Object> response =
                toResponse(updatedProduct, updatedAssociation);
        response.put("message", "Producto actualizado correctamente.");

        return ResponseEntity.ok(response);
    }

    @Transactional
    @DeleteMapping("/products/{id}")
    public ResponseEntity<Map<String, Object>> deleteProduct(
            @PathVariable Integer id,
            @RequestParam Integer restauranteId) {

        authorizationService.requireOwnerForRestaurant(restauranteId);

        ProductoRestauranteId associationId =
                new ProductoRestauranteId(restauranteId, id);

        ProductoRestaurante asociacion =
                productoRestauranteRepository.findById(associationId)
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "El producto no está asociado a este restaurante."));

        Integer ventasHistoricas = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM detalle_pedido WHERE restaurante_id = ? AND producto_id = ?",
                Integer.class, restauranteId, id);

        if (ventasHistoricas != null && ventasHistoricas > 0) {
            jdbcTemplate.update(
                    "DELETE FROM producto_adicion WHERE restaurante_id = ? AND (producto_id = ? OR adicion_id = ?)",
                    restauranteId, id, id);
            asociacion.setDisponible(false);
            productoRestauranteRepository.save(asociacion);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("deactivatedInsteadOfDeleted", true);
            response.put("message",
                    "El producto ya tiene pedidos en el historial; se desactivó del menú disponible para conservar las estadísticas.");
            return ResponseEntity.ok(response);
        }

        jdbcTemplate.update(
                "DELETE FROM producto_adicion WHERE restaurante_id = ? AND (producto_id = ? OR adicion_id = ?)",
                restauranteId, id, id);
        productoRestauranteRepository.delete(asociacion);

        Integer referenciasRestantes = jdbcTemplate.queryForObject(
                "SELECT (SELECT COUNT(*) FROM producto_restaurante WHERE producto_id = ?) + " +
                "(SELECT COUNT(*) FROM detalle_pedido WHERE producto_id = ?) + " +
                "(SELECT COUNT(*) FROM detalle_pedido_adicion WHERE adicion_id = ?)",
                Integer.class, id, id, id);
        if (referenciasRestantes != null && referenciasRestantes == 0) {
            productRepository.findById(id).ifPresent(productRepository::delete);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message",
                "Producto retirado del restaurante correctamente.");

        return ResponseEntity.ok(response);
    }

    private String normalizarYValidarImagen(String imagenUrl) {
        if (imagenUrl == null) {
            return null;
        }
        String limpia = imagenUrl.trim();
        if (limpia.isEmpty()) {
            return null;
        }
        if (limpia.length() > 2_000_000) {
            throw new IllegalArgumentException("La imagen supera el tamaño máximo permitido.");
        }
        String lower = limpia.toLowerCase();
        if (!lower.startsWith("https://") && !lower.startsWith("http://") && !lower.startsWith("data:image/")) {
            throw new IllegalArgumentException(
                    "La imagen debe ser un enlace HTTP/HTTPS válido o una imagen cargada desde el dispositivo.");
        }
        return limpia;
    }

    private Map<String, Object> toResponse(
            Product product,
            ProductoRestaurante asociacion) {
        List<Map<String, Object>> extras = jdbcTemplate.queryForList(
                """
                SELECT p.producto_id AS id, COALESCE(pr.nombre_personalizado, p.nombre_producto) AS nombre, pr.precio
                FROM producto_adicion pa
                JOIN producto_restaurante pr
                  ON pr.restaurante_id = pa.restaurante_id AND pr.producto_id = pa.adicion_id
                JOIN producto p ON p.producto_id = pr.producto_id
                WHERE pa.restaurante_id = ? AND pa.producto_id = ?
                  AND pr.disponible = TRUE
                ORDER BY p.nombre_producto
                """, asociacion.getId().getRestauranteId(), product.getId());
        return toResponse(product, asociacion, extras);
    }

    private Map<String, Object> toResponse(
            Product product,
            ProductoRestaurante asociacion,
            List<Map<String, Object>> extras) {

        Map<String, Object> response = new HashMap<>();

        response.put("id", product.getId());
        response.put("nombre", product.getNombre());
        response.put("descripcion", product.getDescripcion());
        response.put("categoriaId", product.getTipoProductoId());

        response.put("restauranteId",
                asociacion.getId().getRestauranteId());
        response.put("precio", asociacion.getPrecio());
        response.put("imagenUrl", asociacion.getImagenUrl());
        response.put("disponible", asociacion.getDisponible());
        response.put("ingredientesExtra", extras != null ? extras : List.of());

        return response;
    }
}
