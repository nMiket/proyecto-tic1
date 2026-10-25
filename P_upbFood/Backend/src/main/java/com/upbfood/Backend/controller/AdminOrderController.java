package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.UpdateOrderStateRequest;
import com.upbfood.Backend.security.AdminAuthorizationService;
import com.upbfood.Backend.service.PedidoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/pedidos")
public class AdminOrderController {

    private final AdminAuthorizationService authorizationService;
    private final PedidoService pedidoService;

    public AdminOrderController(
            AdminAuthorizationService authorizationService,
            PedidoService pedidoService
    ) {
        this.authorizationService = authorizationService;
        this.pedidoService = pedidoService;
    }

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listarPedidos(
            @RequestParam Integer restauranteId
    ) {
        authorizationService.requireKitchenAdminForRestaurant(restauranteId);

        List<Map<String, Object>> pedidos =
                pedidoService.obtenerActivos(restauranteId);

        return ResponseEntity.ok(pedidos.stream().map(pedido -> {
            Map<String, Object> response = new HashMap<>();
            Object pedidoId = pedido.get("pedido_id");
            response.put("id", pedidoId);
            response.put("client", Map.of("nombre", pedido.getOrDefault("nombre_cliente", "Cliente sin nombre")));
            response.put("estado", pedido.get("estado"));
            response.put("total", pedido.get("total"));
            response.put("fechaCreacion", pedido.get("fecha"));
            response.put("horaRecogida", pedido.get("hora_recogida"));
            if (pedidoId != null) {
                response.put("details", pedidoService.obtenerDetalle(((Number) pedidoId).intValue()));
            } else {
                response.put("details", List.of());
            }
            return response;
        }).toList());
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<Map<String, Object>> cambiarEstado(
            @PathVariable Integer id,
            @Valid @RequestBody UpdateOrderStateRequest request
    ) {
        Map<String, Object> pedido =
                pedidoService.obtenerPedidoPorId(id);

        Integer restauranteId =
                ((Number) pedido.get("restaurante_id")).intValue();

        authorizationService.requireKitchenAdminForRestaurant(restauranteId);

        pedidoService.cambiarEstado(id, request.estado());

        Map<String, Object> actualizado =
                pedidoService.obtenerPedidoPorId(id);

        return ResponseEntity.ok(actualizado);
    }
}