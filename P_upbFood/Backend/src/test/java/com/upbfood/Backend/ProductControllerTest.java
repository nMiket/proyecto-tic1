package com.upbfood.Backend;

import com.upbfood.Backend.controller.ProductController;
import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.repository.ProductRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProductControllerTest {

    @Test
    void listProductsReturnsSavedProducts() {
        ProductRepository repository = mock(ProductRepository.class);
        ProductController controller = new ProductController(repository);

        Product product = new Product();
        product.setId(1L);
        product.setNombre("Café Especial");
        product.setPrecio(new BigDecimal("6500"));
        product.setDisponible(true);
        product.setRestauranteId(1L);
        product.setCategoriaId(2L);

        when(repository.findByRestauranteIdOrderByIdAsc(1L)).thenReturn(List.of(product));

        ResponseEntity<List<Map<String, Object>>> response = controller.listProducts(1L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(1, response.getBody().size());
        assertEquals("Café Especial", response.getBody().get(0).get("nombre"));
    }

    @Test
    void createProductReturnsCreatedProduct() {
        ProductRepository repository = mock(ProductRepository.class);
        ProductController controller = new ProductController(repository);

        Product product = new Product();
        product.setId(3L);
        product.setNombre("Empanada");
        product.setPrecio(new BigDecimal("4000"));
        product.setDisponible(true);
        product.setRestauranteId(1L);
        product.setCategoriaId(1L);

        when(repository.save(org.mockito.ArgumentMatchers.any(Product.class))).thenReturn(product);

        ResponseEntity<Map<String, Object>> response = controller.createProduct(Map.of(
                "nombre", "Empanada",
                "precio", "4000",
                "categoriaId", 1,
                "restauranteId", 1,
                "disponible", true
        ));

        assertEquals(201, response.getStatusCode().value());
        assertEquals("Empanada", response.getBody().get("nombre"));
    }

    @Test
    void updateProductReturnsUpdatedProduct() {
        ProductRepository repository = mock(ProductRepository.class);
        ProductController controller = new ProductController(repository);

        Product existing = new Product();
        existing.setId(10L);
        existing.setNombre("Café");
        existing.setPrecio(new BigDecimal("5000"));
        existing.setDisponible(true);
        existing.setRestauranteId(1L);
        existing.setCategoriaId(2L);

        Product updated = new Product();
        updated.setId(10L);
        updated.setNombre("Café Especial");
        updated.setPrecio(new BigDecimal("6500"));
        updated.setDisponible(false);
        updated.setRestauranteId(1L);
        updated.setCategoriaId(2L);

        when(repository.findById(10L)).thenReturn(java.util.Optional.of(existing));
        when(repository.save(existing)).thenReturn(updated);

        ResponseEntity<Map<String, Object>> response = controller.updateProduct(10L, Map.of(
                "nombre", "Café Especial",
                "precio", "6500",
                "disponible", false,
                "categoriaId", 2,
                "restauranteId", 1
        ));

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Café Especial", response.getBody().get("nombre"));
        assertEquals(false, response.getBody().get("disponible"));
    }

    @Test
    void deleteProductReturnsSuccessMessage() {
        ProductRepository repository = mock(ProductRepository.class);
        ProductController controller = new ProductController(repository);

        when(repository.existsById(7L)).thenReturn(true);

        ResponseEntity<Map<String, Object>> response = controller.deleteProduct(7L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Producto eliminado correctamente.", response.getBody().get("message"));
    }
}
