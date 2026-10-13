package com.upbfood.Backend.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.upbfood.Backend.dto.CreateOrderRequest;
import com.upbfood.Backend.entity.EstadoPedido;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class PedidoService {

    private static final Map<EstadoPedido, Set<EstadoPedido>> TRANSICIONES =
            Map.of(
                    EstadoPedido.PENDIENTE,
                    EnumSet.of(
                            EstadoPedido.EN_PAGO,
                            EstadoPedido.CANCELADO
                    ),
                    EstadoPedido.EN_PAGO,
                    EnumSet.of(
                            EstadoPedido.PAGADO,
                            EstadoPedido.PENDIENTE,
                            EstadoPedido.CANCELADO
                    ),
                    EstadoPedido.PAGADO,
                    EnumSet.of(
                            EstadoPedido.EN_PREPARACION,
                            EstadoPedido.CANCELADO
                    ),
                    EstadoPedido.EN_PREPARACION,
                    EnumSet.of(EstadoPedido.LISTO),
                    EstadoPedido.LISTO,
                    EnumSet.of(EstadoPedido.ENTREGADO),
                    EstadoPedido.ENTREGADO,
                    EnumSet.noneOf(EstadoPedido.class),
                    EstadoPedido.CANCELADO,
                    EnumSet.noneOf(EstadoPedido.class)
            );

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public PedidoService(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> crearPedido(CreateOrderRequest request) {

        List<Map<String, Object>> items = new ArrayList<>();

        for (CreateOrderRequest.OrderItemRequest item : request.items()) {
            Map<String, Object> detalle = new LinkedHashMap<>();

            detalle.put("producto_id", item.productoId());
            detalle.put("cantidad", item.cantidad());
            detalle.put(
                    "adiciones",
                    item.adiciones() == null ? List.of() : item.adiciones()
            );
            detalle.put("observaciones", item.observaciones());

            items.add(detalle);
        }

        String itemsJson;

        try {
            itemsJson = objectMapper.writeValueAsString(items);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(
                    "No fue posible procesar los productos del pedido.",
                    e
            );
        }

        return jdbcTemplate.queryForMap(
                """
                SELECT pedido_id, codigo_seguimiento
                FROM fn_pedido_crear(
                    ?, ?, ?, ?,
                    CAST(? AS JSONB),
                    CAST(? AS TIMESTAMP)
                )
                """,
                request.restauranteId(),
                request.clienteNombre().trim(),
                request.clienteTelefono().trim(),
                request.clienteCorreo().trim(),
                itemsJson,
                request.horaRecogida()
        );
    }

    public Map<String, Object> obtenerPorCodigo(UUID codigo) {
        return jdbcTemplate.queryForMap(
                """
                SELECT *
                FROM fn_pedido_obtener_por_codigo(CAST(? AS UUID))
                """,
                codigo.toString()
        );
    }

    public Map<String, Object> buscarPedido(
            Integer pedidoId,
            UUID codigo,
            String correo,
            String telefono
    ) {
        return jdbcTemplate.queryForMap(
                """
                SELECT p.pedido_id,
                       p.codigo_seguimiento,
                       r.nombre AS nombre_restaurante,
                       p.estado,
                       p.total,
                       p.fecha,
                       p.hora_recogida,
                       p.nombre_cliente,
                       p.telefono_cliente,
                       p.correo_cliente
                FROM pedido p
                JOIN restaurante r ON r.restaurante_id = p.restaurante_id
                WHERE (? IS NULL OR p.pedido_id = ?)
                  AND (? IS NULL OR p.codigo_seguimiento = ?)
                  AND (? IS NULL OR LOWER(TRIM(p.correo_cliente)) = LOWER(TRIM(?)))
                  AND (? IS NULL OR REGEXP_REPLACE(p.telefono_cliente, '\\D', '', 'g')
                                  = REGEXP_REPLACE(?, '\\D', '', 'g'))
                ORDER BY p.fecha DESC
                LIMIT 1
                """,
                pedidoId,
                pedidoId,
                codigo,
                codigo,
                correo,
                correo,
                telefono,
                telefono
        );
    }

    public List<Map<String, Object>> obtenerDetalle(Integer pedidoId) {
        return jdbcTemplate.queryForList(
                """
                SELECT *
                FROM fn_pedido_detalle(?)
                """,
                pedidoId
        );
    }

    public List<Map<String, Object>> obtenerActivos(Integer restauranteId) {
        return jdbcTemplate.queryForList(
                """
                SELECT *
                FROM fn_pedido_obtener_activos(?)
                """,
                restauranteId
        );
    }

    @Transactional
    public void cambiarEstado(
            Integer pedidoId,
            EstadoPedido nuevoEstado
    ) {
        String estadoActualTexto = jdbcTemplate.queryForObject(
                """
                SELECT estado
                FROM pedido
                WHERE pedido_id = ?
                """,
                String.class,
                pedidoId
        );

        EstadoPedido estadoActual = EstadoPedido.valueOf(estadoActualTexto);

        if (!TRANSICIONES
                .getOrDefault(estadoActual, Set.of())
                .contains(nuevoEstado)) {
            throw new IllegalStateException(
                    "Transición no permitida: "
                            + estadoActual + " -> " + nuevoEstado
            );
        }

        jdbcTemplate.query(
                "SELECT fn_pedido_cambiar_estado(?, ?)",
                ps -> {
                    ps.setInt(1, pedidoId);
                    ps.setString(2, nuevoEstado.name());
                },
                rs -> {
                    while (rs.next()) {
                        // La función realiza el cambio en PostgreSQL.
                    }
                    return null;
                }
        );
    }

    @Transactional
    public Map<String, Object> registrarPago(
            Integer pedidoId,
            Integer tipoPagoId,
            java.math.BigDecimal monto
    ) {
        Integer pagoId = jdbcTemplate.queryForObject(
                """
                SELECT fn_pago_registrar(?, ?, ?) AS pago_id
                """,
                Integer.class,
                pedidoId,
                tipoPagoId,
                monto
        );

        return Map.of("pago_id", pagoId);
    }

    public Map<String, Object> obtenerPedidoPorId(Integer pedidoId) {
        return jdbcTemplate.queryForMap(
                """
                SELECT pedido_id, restaurante_id, estado, total
                FROM pedido
                WHERE pedido_id = ?
                """,
                pedidoId
        );
    }
}