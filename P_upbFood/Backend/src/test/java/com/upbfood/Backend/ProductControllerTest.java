package com.upbfood.Backend;

import com.upbfood.Backend.controller.ProductController;
import com.upbfood.Backend.dto.CreateProductRequest;
import com.upbfood.Backend.dto.UpdateProductRequest;
import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.repository.ProductRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProductControllerTest {

    @Test
    void listProductsReturnsSavedProducts() {
        ProductRepository repository = mock(ProductRepository.class);
        AdminAuthorizationService authorizationService = mock(AdminAuthorizationService.class);
        ProductController controller = new ProductController(repository, authorizationService);
        Product product = product(1L, "Café Especial", "6500", true, 1L, 2L);
        when(repository.findByRestauranteIdOrderByIdAsc(1L)).thenReturn(List.of(product));

        ResponseEntity<List<Map<String, Object>>> response = controller.listProducts(1L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Café Especial", response.getBody().get(0).get("nombre"));
    }

    @Test
    void createProductRequiresAuthorizationForRequestedRestaurant() {
        ProductRepository repository = mock(ProductRepository.class);
        AdminAuthorizationService authorizationService = mock(AdminAuthorizationService.class);
        ProductController controller = new ProductController(repository, authorizationService);
        Product saved = product(3L, "Empanada", "4000", true, 1L, 1L);
        when(repository.save(any(Product.class))).thenReturn(saved);

        CreateProductRequest request = new CreateProductRequest();
        request.setNombre("Empanada");
        request.setPrecio(new BigDecimal("4000"));
        request.setCategoriaId(1L);
        request.setRestauranteId(1L);
        request.setDisponible(true);

        ResponseEntity<Map<String, Object>> response = controller.createProduct(request);

        assertEquals(201, response.getStatusCode().value());
        assertEquals("Empanada", response.getBody().get("nombre"));
        org.mockito.Mockito.verify(authorizationService).requireAdminForRestaurant(1L);
    }

    @Test
    void updateProductReturnsUpdatedProduct() {
        ProductRepository repository = mock(ProductRepository.class);
        AdminAuthorizationService authorizationService = mock(AdminAuthorizationService.class);
        ProductController controller = new ProductController(repository, authorizationService);
        Product existing = product(10L, "Café", "5000", true, 1L, 2L);
        Product updated = product(10L, "Café Especial", "6500", false, 1L, 2L);
        when(repository.findById(10L)).thenReturn(Optional.of(existing));
        when(repository.save(existing)).thenReturn(updated);

        UpdateProductRequest request = new UpdateProductRequest();
        request.setNombre("Café Especial");
        request.setPrecio(new BigDecimal("6500"));
        request.setDisponible(false);
        request.setCategoriaId(2L);
        request.setRestauranteId(1L);

        ResponseEntity<Map<String, Object>> response = controller.updateProduct(10L, request);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Café Especial", response.getBody().get("nombre"));
        assertEquals(false, response.getBody().get("disponible"));
    }

    @Test
    void deleteProductReturnsSuccessMessage() {
        ProductRepository repository = mock(ProductRepository.class);
        AdminAuthorizationService authorizationService = mock(AdminAuthorizationService.class);
        ProductController controller = new ProductController(repository, authorizationService);
        Product product = product(7L, "Producto", "4000", true, 1L, 1L);
        when(repository.findById(7L)).thenReturn(Optional.of(product));

        ResponseEntity<Map<String, Object>> response = controller.deleteProduct(7L);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Producto eliminado correctamente.", response.getBody().get("message"));
    }

    private Product product(Long id, String name, String price, boolean available, Long restaurantId, Long categoryId) {
        Product product = new Product();
        product.setId(id);
        product.setNombre(name);
        product.setPrecio(new BigDecimal(price));
        product.setDisponible(available);
        product.setRestauranteId(restaurantId);
        product.setCategoriaId(categoryId);
        return product;
    }
}
