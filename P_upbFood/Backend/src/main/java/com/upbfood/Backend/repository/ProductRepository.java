package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<Product> findByRestauranteIdOrderByIdAsc(Long restauranteId);
}
