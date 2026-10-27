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
        authorizationService.requireAdminForRestaurant(restauranteId);

        List<Map<String, Object>> pedidos =
                pedidoService.obtenerActivos(restauranteId);

        return ResponseEntity.ok(mapearListaPedidosConDetalles(pedidos));
    }

    @GetMapping("/historial")
    public ResponseEntity<List<Map<String, Object>>> listarHistorial(
            @RequestParam Integer restauranteId
    ) {
        authorizationService.requireAdminForRestaurant(restauranteId);

        List<Map<String, Object>> pedidos =
                pedidoService.obtenerHistorial(restauranteId);

        return ResponseEntity.ok(mapearListaPedidosConDetalles(pedidos));
    }

    @GetMapping("/estadisticas")
    public ResponseEntity<Map<String, Object>> obtenerEstadisticas(
            @RequestParam Integer restauranteId
    ) {
        authorizationService.requireAdminForRestaurant(restauranteId);
        return ResponseEntity.ok(pedidoService.obtenerEstadisticas(restauranteId));
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

        authorizationService.requireAdminForRestaurant(restauranteId);

        pedidoService.cambiarEstado(id, request.estado());

        Map<String, Object> actualizado =
                pedidoService.obtenerPedidoPorId(id);

        return ResponseEntity.ok(actualizado);
    }

    private List<Map<String, Object>> mapearListaPedidosConDetalles(
            List<Map<String, Object>> pedidos
    ) {
        if (pedidos == null || pedidos.isEmpty()) {
            return List.of();
        }
        List<Integer> pedidoIds = pedidos.stream()
                .map(p -> p.get("pedido_id"))
                .filter(Number.class::isInstance)
                .map(id -> ((Number) id).intValue())
                .toList();

        Map<Integer, List<Map<String, Object>>> detallesPorPedido =
                pedidoService.obtenerDetallesPorPedidos(pedidoIds);

        return pedidos.stream()
                .map(pedido -> {
                    Object idObj = pedido.get("pedido_id");
                    List<Map<String, Object>> detalles = (idObj instanceof Number num)
                            ? detallesPorPedido.getOrDefault(num.intValue(), List.of())
                            : List.of();
                    return mapearPedido(pedido, detalles);
                })
                .toList();
    }

    private Map<String, Object> mapearPedido(
            Map<String, Object> pedido,
            List<Map<String, Object>> detalles
    ) {
        Map<String, Object> response = new HashMap<>();
        Object pedidoId = pedido.get("pedido_id");
        response.put("id", pedidoId);
        Object nombreCliente = pedido.get("nombre_cliente");
        response.put(
                "client",
                Map.of("nombre", nombreCliente != null ? nombreCliente : "Cliente sin nombre")
        );
        response.put("correoCliente", pedido.get("correo_cliente"));
        response.put("telefonoCliente", pedido.get("telefono_cliente"));
        response.put("estado", pedido.get("estado"));
        response.put("total", pedido.get("total"));
        response.put("fechaCreacion", pedido.get("fecha"));
        response.put("horaRecogida", pedido.get("hora_recogida"));
        response.put("details", detalles != null ? detalles : List.of());
        return response;
    }
}