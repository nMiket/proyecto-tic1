package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.IngredientExtra;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface IngredientExtraRepository extends JpaRepository<IngredientExtra, Long> {

    List<IngredientExtra> findByProductoIdOrderByIdAsc(Long productoId);

    void deleteByProductoId(Long productoId);
}