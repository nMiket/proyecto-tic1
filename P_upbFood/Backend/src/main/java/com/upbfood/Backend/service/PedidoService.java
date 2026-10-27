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
import java.time.LocalDateTime;
import java.time.ZoneId;

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

        Integer tiempoConfigurado = jdbcTemplate.queryForObject(
                "SELECT tiempo_pedido FROM restaurante WHERE restaurante_id = ?",
                Integer.class,
                request.restauranteId());
        if (tiempoConfigurado == null) {
            throw new IllegalArgumentException("No se encontró la cafetería seleccionada.");
        }

        int minutosPreparacion = Math.max(15, tiempoConfigurado);
        LocalDateTime horaMinimaRecogida = LocalDateTime.now(ZoneId.of("America/Bogota"))
                .plusMinutes(minutosPreparacion);
        LocalDateTime horaRecogida = request.horaRecogida();
        if (horaRecogida == null) {
            horaRecogida = horaMinimaRecogida;
        } else if (horaRecogida.isBefore(horaMinimaRecogida)) {
            throw new IllegalArgumentException(
                    "La hora de recogida debe ser al menos dentro de "
                            + minutosPreparacion + " minutos.");
        }

        List<Map<String, Object>> items = new ArrayList<>();

        for (CreateOrderRequest.OrderItemRequest item : request.items()) {
            List<Integer> adiciones = item.adiciones() == null ? List.of() : item.adiciones();
            for (Integer adicionId : adiciones.stream().distinct().toList()) {
                Integer habilitada = jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*) FROM producto_adicion pa
                        JOIN producto_restaurante pr
                          ON pr.restaurante_id = pa.restaurante_id AND pr.producto_id = pa.adicion_id
                        WHERE pa.restaurante_id = ? AND pa.producto_id = ?
                          AND pa.adicion_id = ? AND pr.disponible = TRUE
                        """,
                        Integer.class,
                        request.restauranteId(), item.productoId(), adicionId);
                if (habilitada == null || habilitada == 0) {
                    throw new IllegalArgumentException(
                            "Uno de los ingredientes extra ya no está disponible para este producto.");
                }
            }

            Map<String, Object> detalle = new LinkedHashMap<>();

            detalle.put("producto_id", item.productoId());
            detalle.put("cantidad", item.cantidad());
            detalle.put(
                    "adiciones",
                    adiciones
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
                horaRecogida
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
                       r.tiempo_pedido,
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
                FOR UPDATE
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

    public List<Map<String, Object>> obtenerHistorial(Integer restauranteId) {
        return jdbcTemplate.queryForList(
                """
                SELECT pedido_id,
                       nombre_cliente,
                       correo_cliente,
                       telefono_cliente,
                       estado,
                       total,
                       fecha,
                       hora_recogida
                FROM pedido
                WHERE restaurante_id = ?
                  AND estado IN (
                      'PAGADO',
                      'EN_PREPARACION',
                      'LISTO',
                      'ENTREGADO',
                      'CANCELADO'
                  )
                ORDER BY fecha DESC
                LIMIT 80
                """,
                restauranteId
        );
    }

    public Map<String, Object> obtenerEstadisticas(Integer restauranteId) {
        Map<String, Object> resumen = jdbcTemplate.queryForMap(
                """
                SELECT
                    COUNT(*) FILTER (
                        WHERE estado IN ('PAGADO', 'EN_PREPARACION', 'LISTO')
                    ) AS pedidos_activos,
                    COUNT(*) FILTER (WHERE estado = 'EN_PREPARACION') AS en_preparacion,
                    COUNT(*) FILTER (WHERE estado = 'LISTO') AS listos,
                    COUNT(*) FILTER (
                        WHERE estado NOT IN ('PENDIENTE', 'EN_PAGO')
                          AND (fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
                    ) AS pedidos_hoy,
                    COUNT(*) FILTER (
                        WHERE estado = 'ENTREGADO'
                          AND (fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
                    ) AS entregados_hoy,
                    COUNT(*) FILTER (
                        WHERE estado = 'CANCELADO'
                          AND (fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
                    ) AS cancelados_hoy,
                    COUNT(DISTINCT correo_cliente) FILTER (
                        WHERE estado IN (
                            'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'
                        )
                          AND (fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
                    ) AS clientes_hoy,
                    COALESCE(SUM(total) FILTER (
                        WHERE estado IN (
                            'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'
                        )
                          AND (fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota')::date = (now() AT TIME ZONE 'America/Bogota')::date
                    ), 0) AS ingresos_hoy,
                    COALESCE(SUM(total) FILTER (
                        WHERE estado IN (
                            'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'
                        )
                          AND date_trunc('month', fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota') = date_trunc(
                              'month', now() AT TIME ZONE 'America/Bogota'
                          )
                    ), 0) AS ingresos_mes,
                    COALESCE(SUM(total) FILTER (
                        WHERE estado IN (
                            'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'
                        )
                          AND date_trunc('month', fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota') = date_trunc(
                              'month', now() AT TIME ZONE 'America/Bogota'
                          ) - INTERVAL '1 month'
                    ), 0) AS ingresos_mes_anterior
                FROM pedido
                WHERE restaurante_id = ?
                """,
                restauranteId
        );

        List<Map<String, Object>> productosMasVendidos = jdbcTemplate.queryForList(
                """
                SELECT pr.nombre_producto AS nombre,
                       SUM(dp.cantidad) AS unidades
                FROM detalle_pedido dp
                JOIN producto pr ON pr.producto_id = dp.producto_id
                JOIN pedido p ON p.pedido_id = dp.pedido_id
                WHERE p.restaurante_id = ?
                  AND p.estado IN (
                      'PAGADO', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'
                  )
                GROUP BY pr.nombre_producto
                ORDER BY unidades DESC, nombre ASC
                LIMIT 5
                """,
                restauranteId
        );

        Map<String, Object> estadisticas = new LinkedHashMap<>();
        estadisticas.put("pedidosActivos", toInt(resumen.get("pedidos_activos")));
        estadisticas.put("enPreparacion", toInt(resumen.get("en_preparacion")));
        estadisticas.put("listos", toInt(resumen.get("listos")));
        estadisticas.put("pedidosHoy", toInt(resumen.get("pedidos_hoy")));
        estadisticas.put("entregadosHoy", toInt(resumen.get("entregados_hoy")));
        estadisticas.put("canceladosHoy", toInt(resumen.get("cancelados_hoy")));
        estadisticas.put("clientesHoy", toInt(resumen.get("clientes_hoy")));
        estadisticas.put("ingresosHoy", resumen.get("ingresos_hoy"));
        estadisticas.put("ingresosMes", resumen.get("ingresos_mes"));
        estadisticas.put("ingresosMesAnterior", resumen.get("ingresos_mes_anterior"));
        estadisticas.put("productosMasVendidos", productosMasVendidos);
        return estadisticas;
    }

    private static int toInt(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }
}