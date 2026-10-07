package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.Order;
import com.upbfood.Backend.entity.EstadoPedido;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, Long> {
	Optional<Order> findByCodigoSeguimiento(UUID codigoSeguimiento);

	List<Order> findByRestaurant_IdAndEstadoInOrderByHoraRecogidaAscFechaCreacionAsc(
			Long restaurantId,
			Collection<EstadoPedido> estados
	);
}