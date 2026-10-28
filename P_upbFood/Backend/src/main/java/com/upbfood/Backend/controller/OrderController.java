package com.upbfood.Backend.controller;

import com.upbfood.Backend.dto.CreateOrderRequest;
import com.upbfood.Backend.entity.EstadoPedido;
import com.upbfood.Backend.service.PedidoService;
import com.upbfood.Backend.service.StripeService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/pedidos")
public class OrderController {

    private final PedidoService pedidoService;
    private final StripeService stripeService;

    public OrderController(PedidoService pedidoService, StripeService stripeService) {
        this.pedidoService = pedidoService;
        this.stripeService = stripeService;
    }

    @PostMapping
    public ResponseEntity<?> crearPedido(
            @Valid @RequestBody CreateOrderRequest request) {

        Map<String, Object> creado = pedidoService.crearPedido(request);

        UUID codigo = UUID.fromString(
                creado.get("codigo_seguimiento").toString()
        );

        Map<String, Object> pedido = pedidoService.obtenerPorCodigo(codigo);

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

    // HU011: al continuar al pago el pedido pasa de PENDIENTE a EN_PAGO.
    @PostMapping("/seguimiento/{codigo}/iniciar-pago")
    public ResponseEntity<?> iniciarPago(@PathVariable UUID codigo) {
        Map<String, Object> pedido;
        try {
            pedido = pedidoService.obtenerPorCodigo(codigo);
        } catch (EmptyResultDataAccessException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No encontramos el pedido para iniciar el pago."));
        }

        Integer pedidoId = ((Number) pedido.get("pedido_id")).intValue();
        if ("PENDIENTE".equals(String.valueOf(pedido.get("estado")))) {
            pedidoService.cambiarEstado(pedidoId, EstadoPedido.EN_PAGO);
        }

        Map<String, Object> actualizado = pedidoService.obtenerPorCodigo(codigo);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", actualizado.get("pedido_id"));
        response.put("codigoSeguimiento", codigo);
        response.put("estado", actualizado.get("estado"));
        response.put("total", actualizado.get("total"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/seguimiento/{codigo}/stripe-session")
    public ResponseEntity<?> crearSesionStripe(
            @PathVariable UUID codigo,
            @RequestHeader(value = "Origin", required = false) String origin,
            @RequestHeader(value = "Referer", required = false) String referer) {
        Map<String, Object> pedido;
        try {
            pedido = pedidoService.obtenerPorCodigo(codigo);
        } catch (EmptyResultDataAccessException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No encontramos el pedido para iniciar el pago."));
        }

        Integer pedidoId = ((Number) pedido.get("pedido_id")).intValue();
        String nombreRestaurante = pedido.get("nombre_restaurante") != null
                ? pedido.get("nombre_restaurante").toString()
                : "UPB Food";
        BigDecimal total = new BigDecimal(pedido.get("total").toString());

        Map<String, Object> session = stripeService.crearSesionCheckout(
                pedidoId,
                codigo,
                nombreRestaurante,
                total,
                (origin != null && !origin.isBlank()) ? origin : referer
        );
        return ResponseEntity.ok(session);
    }

    @PostMapping("/seguimiento/{codigo}/stripe-confirmar")
    public ResponseEntity<?> confirmarPagoStripe(
            @PathVariable UUID codigo,
            @RequestParam String sessionId
    ) {
        Map<String, Object> pedido;
        try {
            pedido = pedidoService.obtenerPorCodigo(codigo);
        } catch (EmptyResultDataAccessException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No encontramos el pedido para confirmar el pago."));
        }

        String estadoActual = String.valueOf(pedido.get("estado"));
        if (!"PENDIENTE".equals(estadoActual) && !"EN_PAGO".equals(estadoActual)) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("id", pedido.get("pedido_id"));
            response.put("codigoSeguimiento", codigo);
            response.put("estado", estadoActual);
            response.put("total", pedido.get("total"));
            return ResponseEntity.ok(response);
        }

        boolean pagadoEnStripe = stripeService.verificarSesionPagada(sessionId);
        if (!pagadoEnStripe) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "La sesión de Stripe aún no registra el pago como completado."
            );
        }

        Integer pedidoId = ((Number) pedido.get("pedido_id")).intValue();
        BigDecimal total = new BigDecimal(pedido.get("total").toString());

        // Tipo de pago 2 = Tarjeta
        pedidoService.registrarPago(pedidoId, 2, total);

        Map<String, Object> actualizado = pedidoService.obtenerPorCodigo(codigo);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", actualizado.get("pedido_id"));
        response.put("codigoSeguimiento", codigo);
        response.put("estado", actualizado.get("estado"));
        response.put("total", actualizado.get("total"));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/seguimiento/{codigo}")
    public ResponseEntity<?> consultarPedido(@PathVariable UUID codigo) {

        Map<String, Object> pedido;
        try {
            pedido = pedidoService.obtenerPorCodigo(codigo);
        } catch (EmptyResultDataAccessException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No encontramos un pedido con ese código de seguimiento."));
        }

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
        response.put("productos", pedidoService.obtenerDetalle(((Number) pedido.get("pedido_id")).intValue()));

        return ResponseEntity.ok(response);
    }

    // HU027: historial de pedidos del cliente por correo y teléfono.
    @GetMapping("/historial")
    public ResponseEntity<List<Map<String, Object>>> historialCliente(
            @RequestParam(required = false) String correo,
            @RequestParam(required = false) String telefono
    ) {
        List<Map<String, Object>> pedidos = pedidoService.obtenerHistorialCliente(correo, telefono);

        List<Map<String, Object>> response = pedidos.stream()
                .map(pedido -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", pedido.get("pedido_id"));
                    item.put("codigoSeguimiento", pedido.get("codigo_seguimiento"));
                    item.put("nombreRestaurante", pedido.get("nombre_restaurante"));
                    item.put("estado", pedido.get("estado"));
                    item.put("total", pedido.get("total"));
                    item.put("fecha", pedido.get("fecha"));
                    item.put("horaRecogida", pedido.get("hora_recogida"));
                    item.put("cantidadProductos", pedido.get("cantidad_productos"));
                    return item;
                })
                .toList();

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

        Map<String, Object> pedido;
        try {
            pedido = pedidoService.buscarPedido(
                    pedidoId,
                    codigo,
                    correo,
                    telefono
            );
        } catch (EmptyResultDataAccessException exception) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("message", "No encontramos un pedido con esos datos. Verifica el número, correo o teléfono."));
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("id", pedido.get("pedido_id"));
        response.put("codigoSeguimiento", pedido.get("codigo_seguimiento"));
        response.put("nombreRestaurante", pedido.get("nombre_restaurante"));
        response.put("estado", pedido.get("estado"));
        response.put("total", pedido.get("total"));
        response.put("fecha", pedido.get("fecha"));
        response.put("horaRecogida", pedido.get("hora_recogida"));
        response.put("clienteNombre", pedido.get("nombre_cliente"));
        response.put("tiempoPedido", pedido.get("tiempo_pedido"));
        response.put("productos", pedidoService.obtenerDetalle(((Number) pedido.get("pedido_id")).intValue()));

        return ResponseEntity.ok(response);
    }

    public record RegistrarPagoRequest(
            @NotNull @Positive Integer tipoPagoId,
            @NotNull @Positive BigDecimal monto
    ) {}
}
