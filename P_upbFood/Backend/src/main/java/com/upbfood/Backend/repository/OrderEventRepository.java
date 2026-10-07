package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.OrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderEventRepository extends JpaRepository<OrderEvent, Long> {
}