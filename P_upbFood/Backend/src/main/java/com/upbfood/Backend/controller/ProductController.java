package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.CreateProductRequest;
import com.upbfood.Backend.dto.UpdateProductRequest;
import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.repository.ProductRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import jakarta.validation.Valid;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
    private final AdminAuthorizationService authorizationService;

    public ProductController(ProductRepository productRepository, AdminAuthorizationService authorizationService) {
        this.productRepository = productRepository;
        this.authorizationService = authorizationService;
    }

    @GetMapping("/products")
    public ResponseEntity<List<Map<String, Object>>> listProducts(@RequestParam Long restauranteId) {
        List<Product> products = productRepository.findByRestauranteIdOrderByIdAsc(restauranteId);
        List<Map<String, Object>> response = new ArrayList<>();
        products.forEach(product -> response.add(toResponse(product)));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/products")
    public ResponseEntity<Map<String, Object>> createProduct(@Valid @RequestBody CreateProductRequest request) {
        authorizationService.requireAdminForRestaurant(request.getRestauranteId());

        Product product = new Product();
        product.setNombre(request.getNombre().trim());
        product.setPrecio(request.getPrecio());
        product.setRestauranteId(request.getRestauranteId());
        product.setCategoriaId(request.getCategoriaId());
        product.setDisponible(request.getDisponible() == null || request.getDisponible());

        Product saved = productRepository.save(product);
        Map<String, Object> response = toResponse(saved);
        response.put("message", "Producto creado correctamente.");
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<Map<String, Object>> updateProduct(
        @PathVariable Long id,
        @Valid @RequestBody UpdateProductRequest request
    ) {
        Product product = productRepository.findById(id).orElseThrow(
            () -> new IllegalArgumentException("Producto no encontrado.")
        );
        authorizationService.requireAdminForRestaurant(product.getRestauranteId());
        authorizationService.requireAdminForRestaurant(request.getRestauranteId());

        product.setNombre(request.getNombre().trim());
        product.setPrecio(request.getPrecio());
        product.setCategoriaId(request.getCategoriaId());
        product.setDisponible(request.getDisponible());

        Product updated = productRepository.save(product);
        Map<String, Object> response = toResponse(updated);
        response.put("message", "Producto actualizado correctamente.");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Map<String, Object>> deleteProduct(@PathVariable Long id) {
        Product product = productRepository.findById(id).orElseThrow(
            () -> new IllegalArgumentException("Producto no encontrado.")
        );
        authorizationService.requireAdminForRestaurant(product.getRestauranteId());
        productRepository.delete(product);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Producto eliminado correctamente.");
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> toResponse(Product product) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", product.getId());
        response.put("nombre", product.getNombre());
        response.put("precio", product.getPrecio());
        response.put("disponible", product.getDisponible());
        response.put("restauranteId", product.getRestauranteId());
        response.put("categoriaId", product.getCategoriaId());
        return response;
    }
}
