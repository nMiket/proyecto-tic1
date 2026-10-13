
package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.ProductoRestaurante;
import com.upbfood.Backend.entity.ProductoRestauranteId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductoRestauranteRepository
        extends JpaRepository<ProductoRestaurante, ProductoRestauranteId> {

    List<ProductoRestaurante> findByIdRestauranteIdOrderByIdProductoIdAsc(
            Integer restauranteId
    );
}
