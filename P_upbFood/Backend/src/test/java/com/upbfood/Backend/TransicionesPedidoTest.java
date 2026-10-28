package com.upbfood.Backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.upbfood.Backend.entity.EstadoPedido;
import com.upbfood.Backend.service.PedidoService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * HU015 - La cocina no puede saltarse estados del pedido.
 */
class TransicionesPedidoTest {

    private PedidoService servicioConEstado(int pedidoId, String estadoActual) {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForObject(anyString(), eq(String.class), eq(pedidoId)))
                .thenReturn(estadoActual);
        return new PedidoService(jdbcTemplate, new ObjectMapper());
    }

    @Test
    void noSePuedePrepararUnPedidoSinPago() {
        PedidoService service = servicioConEstado(5, "PENDIENTE");
        assertThrows(IllegalStateException.class,
                () -> service.cambiarEstado(5, EstadoPedido.EN_PREPARACION));
    }

    @Test
    void noSePuedeEntregarUnPedidoQueNoEstaListo() {
        PedidoService service = servicioConEstado(6, "EN_PREPARACION");
        assertThrows(IllegalStateException.class,
                () -> service.cambiarEstado(6, EstadoPedido.ENTREGADO));
    }

    @Test
    void unPedidoEntregadoNoRetrocede() {
        PedidoService service = servicioConEstado(7, "ENTREGADO");
        assertThrows(IllegalStateException.class,
                () -> service.cambiarEstado(7, EstadoPedido.LISTO));
    }
}
