package com.upbfood.Backend.controller;

import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.repository.ProductRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ProductController {

    private final ProductRepository productRepository;

    public ProductController(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    @GetMapping("/products")
    public ResponseEntity<List<Map<String, Object>>> listProducts(@RequestParam Long restauranteId) {
        List<Product> products = productRepository.findByRestauranteIdOrderByIdAsc(restauranteId);
        List<Map<String, Object>> response = new ArrayList<>();

        for (Product product : products) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", product.getId());
            item.put("nombre", product.getNombre());
            item.put("precio", product.getPrecio());
            item.put("disponible", product.getDisponible());
            item.put("restauranteId", product.getRestauranteId());
            item.put("categoriaId", product.getCategoriaId());
            response.add(item);
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/products")
    public ResponseEntity<Map<String, Object>> createProduct(@RequestBody Map<String, Object> payload) {
        try {
            String nombre = String.valueOf(payload.get("nombre")).trim();
            BigDecimal precio = new BigDecimal(String.valueOf(payload.get("precio")));
            Long restauranteId = Long.valueOf(String.valueOf(payload.get("restauranteId")));
            Long categoriaId = Long.valueOf(String.valueOf(payload.get("categoriaId")));
            Boolean disponible = payload.get("disponible") == null || Boolean.parseBoolean(String.valueOf(payload.get("disponible")));

            Product product = new Product();
            product.setNombre(nombre);
            product.setPrecio(precio);
            product.setRestauranteId(restauranteId);
            product.setCategoriaId(categoriaId);
            product.setDisponible(disponible);

            Product saved = productRepository.save(product);

            Map<String, Object> response = new HashMap<>();
            response.put("id", saved.getId());
            response.put("nombre", saved.getNombre());
            response.put("precio", saved.getPrecio());
            response.put("disponible", saved.getDisponible());
            response.put("restauranteId", saved.getRestauranteId());
            response.put("categoriaId", saved.getCategoriaId());
            response.put("message", "Producto creado correctamente.");

            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (Exception ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "No se pudo crear el producto.");
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PutMapping("/products/{id}")
    public ResponseEntity<Map<String, Object>> updateProduct(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        try {
            Product product = productRepository.findById(id).orElse(null);
            if (product == null) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Producto no encontrado.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            if (payload.containsKey("nombre") && payload.get("nombre") != null) {
                product.setNombre(String.valueOf(payload.get("nombre")).trim());
            }
            if (payload.containsKey("precio") && payload.get("precio") != null) {
                product.setPrecio(new BigDecimal(String.valueOf(payload.get("precio"))));
            }
            if (payload.containsKey("categoriaId") && payload.get("categoriaId") != null) {
                product.setCategoriaId(Long.valueOf(String.valueOf(payload.get("categoriaId"))));
            }
            if (payload.containsKey("restauranteId") && payload.get("restauranteId") != null) {
                product.setRestauranteId(Long.valueOf(String.valueOf(payload.get("restauranteId"))));
            }
            if (payload.containsKey("disponible") && payload.get("disponible") != null) {
                product.setDisponible(Boolean.parseBoolean(String.valueOf(payload.get("disponible"))));
            }

            Product updated = productRepository.save(product);

            Map<String, Object> response = new HashMap<>();
            response.put("id", updated.getId());
            response.put("nombre", updated.getNombre());
            response.put("precio", updated.getPrecio());
            response.put("disponible", updated.getDisponible());
            response.put("restauranteId", updated.getRestauranteId());
            response.put("categoriaId", updated.getCategoriaId());
            response.put("message", "Producto actualizado correctamente.");
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "No se pudo actualizar el producto.");
            return ResponseEntity.badRequest().body(response);
        }
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Map<String, Object>> deleteProduct(@PathVariable Long id) {
        try {
            if (!productRepository.existsById(id)) {
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "Producto no encontrado.");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            productRepository.deleteById(id);

            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Producto eliminado correctamente.");
            return ResponseEntity.ok(response);
        } catch (Exception ex) {
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "No se pudo eliminar el producto.");
            return ResponseEntity.badRequest().body(response);
        }
    }
}
