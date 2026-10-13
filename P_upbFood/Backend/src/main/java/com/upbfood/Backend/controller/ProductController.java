
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

    public ProductController(
            ProductRepository productRepository,
            ProductoRestauranteRepository productoRestauranteRepository,
            AdminAuthorizationService authorizationService) {
        this.productRepository = productRepository;
        this.productoRestauranteRepository = productoRestauranteRepository;
        this.authorizationService = authorizationService;
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

        List<Map<String, Object>> response = new ArrayList<>();

        for (ProductoRestaurante asociacion : asociaciones) {
            Integer productoId = asociacion.getId().getProductoId();

            Product product = productRepository.findById(productoId)
                    .orElseThrow(() ->
                            new IllegalStateException(
                                    "No se encontró el producto asociado al restaurante."));

            response.add(toResponse(product, asociacion));
        }

        return ResponseEntity.ok(response);
    }

    @Transactional
    @PostMapping({"/products", "/productos"})
    public ResponseEntity<Map<String, Object>> createProduct(
            @Valid @RequestBody CreateProductRequest request) {

        authorizationService.requireOwnerForRestaurant(
                request.restauranteId());

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
        asociacion.setImagenUrl(request.imagenUrl());
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

        product.setNombre(request.nombre().trim());
        product.setDescripcion(request.descripcion().trim());
        product.setTipoProductoId(request.categoriaId());

        asociacion.setPrecio(request.precio());
        asociacion.setImagenUrl(request.imagenUrl());
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

        productoRestauranteRepository.delete(asociacion);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message",
                "Producto retirado del restaurante correctamente.");

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toResponse(
            Product product,
            ProductoRestaurante asociacion) {

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

        // Compatibilidad temporal con el formato anterior del frontend.
        response.put("ingredientesExtra", List.of());

        return response;
    }
}
