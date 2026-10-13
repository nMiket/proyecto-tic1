package com.upbfood.Backend;

import com.upbfood.Backend.controller.ProductController;
import com.upbfood.Backend.dto.CreateProductRequest;
import com.upbfood.Backend.dto.UpdateProductRequest;
import com.upbfood.Backend.entity.Product;
import com.upbfood.Backend.entity.ProductoRestaurante;
import com.upbfood.Backend.entity.ProductoRestauranteId;
import com.upbfood.Backend.repository.ProductRepository;
import com.upbfood.Backend.repository.ProductoRestauranteRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductControllerTest {

    @Test
    void listProductsReturnsSavedProducts() {
        ProductRepository productRepository = mock(ProductRepository.class);
        ProductoRestauranteRepository menuRepository =
                mock(ProductoRestauranteRepository.class);
        AdminAuthorizationService authorizationService =
                mock(AdminAuthorizationService.class);

        ProductController controller = new ProductController(
                productRepository, menuRepository, authorizationService
        );

        Product product = product(1, "Café Especial", 2);
        ProductoRestaurante menuItem =
                menuItem(1, 1, "6500", true);

        when(menuRepository.findByIdRestauranteIdOrderByIdProductoIdAsc(1))
                .thenReturn(List.of(menuItem));
        when(productRepository.findById(1))
                .thenReturn(Optional.of(product));

        ResponseEntity<List<Map<String, Object>>> response =
                controller.listProducts(1);

        assertEquals(200, response.getStatusCode().value());
        assertEquals("Café Especial", response.getBody().get(0).get("nombre"));
        assertEquals(
                new BigDecimal("6500"),
                response.getBody().get(0).get("precio")
        );
        assertEquals(
                true,
                response.getBody().get(0).get("disponible")
        );
    }

    @Test
    void createProductRequiresAuthorizationForRequestedRestaurant() {
        ProductRepository productRepository = mock(ProductRepository.class);
        ProductoRestauranteRepository menuRepository =
                mock(ProductoRestauranteRepository.class);
        AdminAuthorizationService authorizationService =
                mock(AdminAuthorizationService.class);

        ProductController controller = new ProductController(
                productRepository, menuRepository, authorizationService
        );

        Product savedProduct = product(3, "Empanada", 1);
        ProductoRestaurante savedMenuItem =
                menuItem(1, 3, "4000", true);

        when(productRepository.save(any(Product.class)))
                .thenReturn(savedProduct);
        when(menuRepository.save(any(ProductoRestaurante.class)))
                .thenReturn(savedMenuItem);

        CreateProductRequest request = new CreateProductRequest(
            "Empanada",
            "Empanada de carne",
            new BigDecimal("4000"),
            1,
            1,
            null,
            true
    );

        ResponseEntity<Map<String, Object>> response =
                controller.createProduct(request);

        assertEquals(201, response.getStatusCode().value());
        assertEquals("Empanada", response.getBody().get("nombre"));
        assertEquals(
                new BigDecimal("4000"),
                response.getBody().get("precio")
        );

        verify(authorizationService).requireAdminForRestaurant(1);
        verify(productRepository).save(any(Product.class));
        verify(menuRepository).save(any(ProductoRestaurante.class));
    }

    @Test
    void updateProductReturnsUpdatedProduct() {
        ProductRepository productRepository = mock(ProductRepository.class);
        ProductoRestauranteRepository menuRepository =
                mock(ProductoRestauranteRepository.class);
        AdminAuthorizationService authorizationService =
                mock(AdminAuthorizationService.class);

        ProductController controller = new ProductController(
                productRepository, menuRepository, authorizationService
        );

        Product existingProduct = product(10, "Café", 1);
        ProductoRestaurante existingMenuItem =
                menuItem(1, 10, "5000", true);

        when(productRepository.findById(10))
                .thenReturn(Optional.of(existingProduct));
        when(menuRepository.findById(
                new ProductoRestauranteId(1, 10)
        )).thenReturn(Optional.of(existingMenuItem));
        when(productRepository.save(existingProduct))
                .thenReturn(existingProduct);
        when(menuRepository.save(existingMenuItem))
                .thenReturn(existingMenuItem);

        UpdateProductRequest request = new UpdateProductRequest(
        "Café Especial",
        "Café de origen especial",
        new BigDecimal("6500"),
        2,
        1,
        "https://example.com/cafe.jpg",
        false
);

        ResponseEntity<Map<String, Object>> response =
                controller.updateProduct(10, request);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(
                "Café Especial",
                response.getBody().get("nombre")
        );
        assertEquals(
                new BigDecimal("6500"),
                response.getBody().get("precio")
        );
        assertEquals(false, response.getBody().get("disponible"));
        assertEquals(2, response.getBody().get("tipoProductoId"));

        verify(authorizationService).requireAdminForRestaurant(1);
    }

    @Test
    void deleteProductDeactivatesProductInRestaurantMenu() {
        ProductRepository productRepository = mock(ProductRepository.class);
        ProductoRestauranteRepository menuRepository =
                mock(ProductoRestauranteRepository.class);
        AdminAuthorizationService authorizationService =
                mock(AdminAuthorizationService.class);

        ProductController controller = new ProductController(
                productRepository, menuRepository, authorizationService
        );

        ProductoRestaurante menuItem =
                menuItem(1, 7, "4000", true);

        when(menuRepository.findById(
                new ProductoRestauranteId(1, 7)
        )).thenReturn(Optional.of(menuItem));
        when(menuRepository.save(menuItem)).thenReturn(menuItem);

        ResponseEntity<Map<String, Object>> response =
                controller.deleteProduct(7, 1);

        assertEquals(200, response.getStatusCode().value());
        assertEquals(
                "Producto desactivado en el menú correctamente.",
                response.getBody().get("message")
        );
        assertEquals(false, menuItem.getDisponible());

        verify(authorizationService).requireAdminForRestaurant(1);
        verify(menuRepository).save(menuItem);
    }

    private Product product(
            Integer id, String nombre, Integer tipoProductoId) {
        Product product = new Product();
        product.setId(id);
        product.setNombre(nombre);
        product.setDescripcion("Descripción de prueba");
        product.setTipoProductoId(tipoProductoId);
        return product;
    }

    private ProductoRestaurante menuItem(
            Integer restauranteId,
            Integer productoId,
            String precio,
            boolean disponible
    ) {
        ProductoRestaurante item = new ProductoRestaurante();
        item.setId(new ProductoRestauranteId(restauranteId, productoId));
        item.setPrecio(new BigDecimal(precio));
        item.setImagenUrl("https://example.com/producto.jpg");
        item.setDisponible(disponible);
        return item;
    }
}