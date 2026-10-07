package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.UpdateOrderStateRequest;
import com.upbfood.Backend.entity.EstadoPedido;
import com.upbfood.Backend.entity.Order;
import com.upbfood.Backend.repository.OrderRepository;
import com.upbfood.Backend.security.AdminAuthorizationService;
import com.upbfood.Backend.service.PedidoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/pedidos")
public class AdminOrderController {
    private final OrderRepository orderRepository;
    private final AdminAuthorizationService authorizationService;
    private final PedidoService pedidoService;

    public AdminOrderController(
            OrderRepository orderRepository,
            AdminAuthorizationService authorizationService,
            PedidoService pedidoService
    ) {
        this.orderRepository = orderRepository;
        this.authorizationService = authorizationService;
        this.pedidoService = pedidoService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listarPedidos() {
        Long restauranteId = authorizationService.getAuthenticatedAdmin().getRestauranteId();
        List<Order> pedidos = orderRepository.findByRestaurant_IdAndEstadoInOrderByHoraRecogidaAscFechaCreacionAsc(
                restauranteId,
                EnumSet.of(EstadoPedido.PAGADO, EstadoPedido.EN_PREPARACION, EstadoPedido.LISTO)
        );
        return ResponseEntity.ok(pedidos.stream().map(this::toResponse).toList());
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<Map<String, Object>> cambiarEstado(
            @PathVariable Long id,
            @Valid @RequestBody UpdateOrderStateRequest request
    ) {
        Order order = orderRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("El pedido no existe."));
        authorizationService.requireAdminForRestaurant(order.getRestaurant().getId());
        Order updated = pedidoService.cambiarEstado(order, request.estado(), "COCINA");
        return ResponseEntity.ok(toResponse(updated));
    }

    private Map<String, Object> toResponse(Order order) {
        Map<String, Object> response = new HashMap<>();
        response.put("id", order.getId());
        response.put("estado", order.getEstado());
        response.put("total", order.getTotal());
        response.put("fechaCreacion", order.getFechaCreacion());
        response.put("horaRecogida", order.getHoraRecogida());
        response.put("client", Map.of("nombre", order.getClient().getNombre()));
        response.put("details", order.getDetails());
        return response;
    }
}