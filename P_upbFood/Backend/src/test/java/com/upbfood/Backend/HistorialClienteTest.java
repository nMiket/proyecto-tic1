package com.upbfood.Backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.upbfood.Backend.controller.OrderController;
import com.upbfood.Backend.service.PedidoService;
import com.upbfood.Backend.service.StripeService;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * HU027 - Historial de pedidos del cliente.
 */
class HistorialClienteTest {

    @Test
    void historialRequiereCorreoYTelefono() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        PedidoService service = new PedidoService(jdbcTemplate, new ObjectMapper());

        assertThrows(IllegalArgumentException.class,
                () -> service.obtenerHistorialCliente("cliente@upb.edu.co", null));
        assertThrows(IllegalArgumentException.class,
                () -> service.obtenerHistorialCliente("  ", "3001234567"));
        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void historialNormalizaCorreoYTelefonoAntesDeConsultar() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        PedidoService service = new PedidoService(jdbcTemplate, new ObjectMapper());

        service.obtenerHistorialCliente(" Cliente@UPB.edu.co ", "300 123-4567");

        verify(jdbcTemplate).queryForList(anyString(), eq("cliente@upb.edu.co"), eq("3001234567"));
    }

    @Test
    void controladorDevuelveHistorialConCodigoDeSeguimiento() {
        PedidoService pedidoService = mock(PedidoService.class);
        OrderController controller = new OrderController(pedidoService, mock(StripeService.class));

        UUID codigo = UUID.fromString("550e8400-e29b-41d4-a716-446655440000");
        when(pedidoService.obtenerHistorialCliente("cliente@upb.edu.co", "3001234567")).thenReturn(List.of(
                Map.of(
                        "pedido_id", 7,
                        "codigo_seguimiento", codigo,
                        "nombre_restaurante", "Cafetería Central",
                        "estado", "ENTREGADO",
                        "total", new BigDecimal("15000.00"),
                        "cantidad_productos", 2
                )
        ));

        ResponseEntity<List<Map<String, Object>>> response =
                controller.historialCliente("cliente@upb.edu.co", "3001234567");

        assertEquals(200, response.getStatusCode().value());
        List<Map<String, Object>> body = response.getBody();
        assertEquals(1, body.size());
        assertEquals(7, body.get(0).get("id"));
        assertEquals(codigo, body.get(0).get("codigoSeguimiento"));
        assertEquals("ENTREGADO", body.get(0).get("estado"));
        assertEquals(2, body.get(0).get("cantidadProductos"));
    }
}
