package com.upbfood.Backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateOrderRequest {
    private Long restauranteId;
    private String clienteCorreo;
    private String clienteNombre;
    private String clienteTelefono;
    private List<CreateOrderItemRequest> items;
}
