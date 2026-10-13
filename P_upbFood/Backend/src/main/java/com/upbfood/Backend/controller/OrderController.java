package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.CreateOrderRequest;
import com.upbfood.Backend.service.PedidoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/pedidos")
@CrossOrigin(origins = "http://localhost:5173")
public class OrderController {

    private final PedidoService pedidoService;

    public OrderController(PedidoService pedidoService) {
        this.pedidoService = pedidoService;
    }

    @PostMapping
    public ResponseEntity<?> crearPedido(
            @Valid @RequestBody CreateOrderRequest request) {

        Map<String, Object> creado = pedidoService.crearPedido(request);

        UUID codigo = UUID.fromString(
                creado.get("codigo_seguimiento").toString()
        );

        Map<String, Object> pedido =
                pedidoService.obtenerPorCodigo(codigo);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", pedido.get("pedido_id"));
        response.put("codigoSeguimiento", codigo);
        response.put("estado", pedido.get("estado"));
        response.put("total", pedido.get("total"));
        response.put("horaRecogida", pedido.get("hora_recogida"));

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PutMapping("/seguimiento/{codigo}/pago")
    public ResponseEntity<?> registrarPago(
            @PathVariable UUID codigo,
            @Valid @RequestBody RegistrarPagoRequest request) {

        Map<String, Object> pedido =
                pedidoService.obtenerPorCodigo(codigo);

        Integer pedidoId =
                ((Number) pedido.get("pedido_id")).intValue();

        pedidoService.registrarPago(
                pedidoId,
                request.tipoPagoId(),
                request.monto()
        );

        Map<String, Object> actualizado =
                pedidoService.obtenerPorCodigo(codigo);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", actualizado.get("pedido_id"));
        response.put("codigoSeguimiento", codigo);
        response.put("estado", actualizado.get("estado"));
        response.put("total", actualizado.get("total"));

        return ResponseEntity.ok(response);
    }

    @GetMapping("/seguimiento/{codigo}")
    public ResponseEntity<?> consultarPedido(@PathVariable UUID codigo) {

        Map<String, Object> pedido =
                pedidoService.obtenerPorCodigo(codigo);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", pedido.get("pedido_id"));
        response.put("codigoSeguimiento", codigo);
        response.put("nombreRestaurante", pedido.get("nombre_restaurante"));
        response.put("estado", pedido.get("estado"));
        response.put("total", pedido.get("total"));
        response.put("fecha", pedido.get("fecha"));
        response.put("horaRecogida", pedido.get("hora_recogida"));
        response.put("clienteNombre", pedido.get("nombre_cliente"));
        response.put("tiempoPedido", pedido.get("tiempo_pedido"));

        return ResponseEntity.ok(response);
    }

        @GetMapping({"/consulta", "/seguimiento/consulta"})
    public ResponseEntity<?> consultarPedido(
            @RequestParam(required = false) Integer pedidoId,
            @RequestParam(required = false) UUID codigo,
            @RequestParam(required = false) String correo,
            @RequestParam(required = false) String telefono
    ) {
        boolean tieneCodigo = codigo != null;
        boolean tieneIdentificadorSecundario = correo != null && !correo.isBlank()
                || telefono != null && !telefono.isBlank();

        if (!tieneCodigo && (pedidoId == null || !tieneIdentificadorSecundario)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Usa el código de seguimiento o el número de pedido con correo o teléfono."
            );
        }

        Map<String, Object> pedido = pedidoService.buscarPedido(
                pedidoId,
                codigo,
                correo,
                telefono
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", pedido.get("pedido_id"));
        response.put("codigoSeguimiento", pedido.get("codigo_seguimiento"));
        response.put("nombreRestaurante", pedido.get("nombre_restaurante"));
        response.put("estado", pedido.get("estado"));
        response.put("total", pedido.get("total"));
        response.put("fecha", pedido.get("fecha"));
        response.put("horaRecogida", pedido.get("hora_recogida"));
        response.put("clienteNombre", pedido.get("nombre_cliente"));
        response.put("tiempoPedido", pedido.get("fecha"));

        return ResponseEntity.ok(response);
    }

    public record RegistrarPagoRequest(
            @NotNull @Positive Integer tipoPagoId,
            @NotNull @Positive BigDecimal monto
    ) {}
}