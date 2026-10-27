package com.upbfood.Backend;

import com.upbfood.Backend.controller.OrderController;
import com.upbfood.Backend.service.PedidoService;
import com.upbfood.Backend.service.StripeService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrderControllerTest {

    @Test
    void consultarPedidoPorCodigoReturnsOrderWithDetails() {
        PedidoService pedidoService = mock(PedidoService.class);
        StripeService stripeService = mock(StripeService.class);
        OrderController controller = new OrderController(pedidoService, stripeService);

        UUID codigo = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        when(pedidoService.obtenerPorCodigo(codigo)).thenReturn(Map.of(
                "pedido_id", 15,
                "nombre_restaurante", "Cafetería Central",
                "estado", "PAGADO",
                "total", new BigDecimal("17000.00"),
                "nombre_cliente", "Julián",
                "tiempo_pedido", 15
        ));
        when(pedidoService.obtenerDetalle(15)).thenReturn(List.of(
                Map.of("detalle_pedido_id", 1, "nombre_producto", "Ejecutivo de Carne", "cantidad", 1)
        ));

        ResponseEntity<?> response = controller.consultarPedido(codigo);

        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(15, body.get("id"));
        assertEquals("Cafetería Central", body.get("nombreRestaurante"));
        assertEquals("PAGADO", body.get("estado"));
    }

    @Test
    void consultarPedidoPorIdYContactoReturnsOrder() {
        PedidoService pedidoService = mock(PedidoService.class);
        StripeService stripeService = mock(StripeService.class);
        OrderController controller = new OrderController(pedidoService, stripeService);

        UUID codigo = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        when(pedidoService.buscarPedido(15, null, "cliente@upb.edu.co", null)).thenReturn(Map.of(
                "pedido_id", 15,
                "codigo_seguimiento", codigo,
                "nombre_restaurante", "Cafetería Central",
                "estado", "LISTO",
                "total", new BigDecimal("15000.00"),
                "nombre_cliente", "Julián",
                "tiempo_pedido", 15
        ));
        when(pedidoService.obtenerDetalle(15)).thenReturn(List.of());

        ResponseEntity<?> response = controller.consultarPedido(15, null, "cliente@upb.edu.co", null);

        assertEquals(200, response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals(15, body.get("id"));
        assertEquals(codigo, body.get("codigoSeguimiento"));
        assertEquals("LISTO", body.get("estado"));
    }

    @Test
    void consultarPedidoWithoutRequiredParamsThrowsBadRequest() {
        PedidoService pedidoService = mock(PedidoService.class);
        StripeService stripeService = mock(StripeService.class);
        OrderController controller = new OrderController(pedidoService, stripeService);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.consultarPedido(15, null, null, null)
        );
        assertEquals(400, exception.getStatusCode().value());
    }

    @Test
    void consultarPedidoReturnsNotFoundWhenMissing() {
        PedidoService pedidoService = mock(PedidoService.class);
        StripeService stripeService = mock(StripeService.class);
        OrderController controller = new OrderController(pedidoService, stripeService);

        UUID codigo = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        when(pedidoService.obtenerPorCodigo(codigo)).thenThrow(new EmptyResultDataAccessException(1));

        ResponseEntity<?> response = controller.consultarPedido(codigo);
        assertEquals(404, response.getStatusCode().value());
    }

    @Test
    void registrarPagoUpdatesOrderAndReturnsUpdatedStatus() {
        PedidoService pedidoService = mock(PedidoService.class);
        StripeService stripeService = mock(StripeService.class);
        OrderController controller = new OrderController(pedidoService, stripeService);

        UUID codigo = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        when(pedidoService.obtenerPorCodigo(codigo))
                .thenReturn(Map.of("pedido_id", 20, "estado", "PENDIENTE", "total", new BigDecimal("12000")))
                .thenReturn(Map.of("pedido_id", 20, "estado", "PAGADO", "total", new BigDecimal("12000")));

        OrderController.RegistrarPagoRequest req =
                new OrderController.RegistrarPagoRequest(1, new BigDecimal("12000"));
        ResponseEntity<?> response = controller.registrarPago(codigo, req);

        assertEquals(200, response.getStatusCode().value());
        verify(pedidoService).registrarPago(20, 1, new BigDecimal("12000"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals("PAGADO", body.get("estado"));
    }

    @Test
    void confirmarPagoStripeRegistersPaymentWhenSessionIsPaid() {
        PedidoService pedidoService = mock(PedidoService.class);
        StripeService stripeService = mock(StripeService.class);
        OrderController controller = new OrderController(pedidoService, stripeService);

        UUID codigo = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        when(pedidoService.obtenerPorCodigo(codigo))
                .thenReturn(Map.of("pedido_id", 25, "estado", "PENDIENTE", "total", new BigDecimal("15000")))
                .thenReturn(Map.of("pedido_id", 25, "estado", "PAGADO", "total", new BigDecimal("15000")));
        when(stripeService.verificarSesionPagada("cs_test_12345")).thenReturn(true);

        ResponseEntity<?> response = controller.confirmarPagoStripe(codigo, "cs_test_12345");

        assertEquals(200, response.getStatusCode().value());
        verify(pedidoService).registrarPago(25, 2, new BigDecimal("15000"));
        @SuppressWarnings("unchecked")
        Map<String, Object> body = (Map<String, Object>) response.getBody();
        assertEquals("PAGADO", body.get("estado"));
    }
}
