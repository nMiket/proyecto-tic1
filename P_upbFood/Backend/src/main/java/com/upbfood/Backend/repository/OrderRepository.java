package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface OrderRepository extends JpaRepository<Order, Long> {
    
    // Encuentra pedidos activos para una cocina (restaurante) en particular
    @Query("SELECT o FROM Order o WHERE o.restaurant.id = :restaurantId AND o.estado IN ('NUEVO', 'EN_PREPARACION') ORDER BY o.fechaCreacion ASC")
    List<Order> findActiveOrdersByRestaurant(@Param("restaurantId") Long restaurantId);
    
    // Encuentra todos los pedidos activos si no se filtra por restaurante
    @Query("SELECT o FROM Order o WHERE o.estado IN ('NUEVO', 'EN_PREPARACION') ORDER BY o.fechaCreacion ASC")
    List<Order> findAllActiveOrders();
}
