package com.upbfood.Backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record CreateOrderRequest(
        @NotNull Long restauranteId,
        @NotBlank @Email String clienteCorreo,
        @NotBlank String clienteNombre,
        @NotBlank String clienteTelefono,
        @NotEmpty List<@Valid OrderItemRequest> items
) {
    public record OrderItemRequest(
            @NotNull Long productoId,
            @NotNull @Min(1) Integer cantidad,
            String observaciones
    ) {
    }
}