package com.upbfood.Backend.dto;

import lombok.Data;

@Data
public class CreateOrderItemRequest {
    private Long productoId;
    private Integer cantidad;
}
