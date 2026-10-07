package com.upbfood.Backend.service;

import com.upbfood.Backend.entity.EstadoPedido;
import com.upbfood.Backend.entity.Order;
import com.upbfood.Backend.entity.OrderEvent;
import com.upbfood.Backend.repository.OrderEventRepository;
import com.upbfood.Backend.repository.OrderRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Service
public class PedidoService {
    private static final Map<EstadoPedido, Set<EstadoPedido>> TRANSICIONES = Map.of(
            EstadoPedido.PENDIENTE, EnumSet.of(EstadoPedido.EN_PAGO, EstadoPedido.CANCELADO),
            EstadoPedido.EN_PAGO, EnumSet.of(EstadoPedido.PAGADO, EstadoPedido.PENDIENTE, EstadoPedido.CANCELADO),
            EstadoPedido.PAGADO, EnumSet.of(EstadoPedido.EN_PREPARACION, EstadoPedido.CANCELADO),
            EstadoPedido.EN_PREPARACION, EnumSet.of(EstadoPedido.LISTO),
            EstadoPedido.LISTO, EnumSet.of(EstadoPedido.ENTREGADO),
            EstadoPedido.ENTREGADO, EnumSet.noneOf(EstadoPedido.class),
            EstadoPedido.CANCELADO, EnumSet.noneOf(EstadoPedido.class)
    );

    private final OrderRepository orderRepository;
    private final OrderEventRepository orderEventRepository;

    public PedidoService(OrderRepository orderRepository, OrderEventRepository orderEventRepository) {
        this.orderRepository = orderRepository;
        this.orderEventRepository = orderEventRepository;
    }

    @Transactional
    public Order cambiarEstado(Order order, EstadoPedido nuevoEstado, String actor) {
        EstadoPedido estadoAnterior = order.getEstado();
        if (!TRANSICIONES.getOrDefault(estadoAnterior, Set.of()).contains(nuevoEstado)) {
            throw new IllegalStateException(
                    "Transición no permitida: " + estadoAnterior + " -> " + nuevoEstado
            );
        }

        order.setEstado(nuevoEstado);
        Order updated = orderRepository.save(order);
        registrarEvento(updated, estadoAnterior, nuevoEstado, actor);
        return updated;
    }

    @Transactional
    public void registrarCreacion(Order order, String actor) {
        registrarEvento(order, null, order.getEstado(), actor);
    }

    private void registrarEvento(Order order, EstadoPedido anterior, EstadoPedido nuevo, String actor) {
        OrderEvent event = new OrderEvent();
        event.setOrderId(order.getId());
        event.setEstadoAnterior(anterior);
        event.setEstadoNuevo(nuevo);
        event.setActor(actor);
        event.setCreatedAt(LocalDateTime.now());
        orderEventRepository.save(event);
    }
}