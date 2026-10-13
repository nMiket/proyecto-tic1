package com.upbfood.Backend.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public record CreateOrderRequest(
        @NotNull @Positive Integer restauranteId,

        @NotBlank @Email String clienteCorreo,

        @NotBlank @Size(max = 100) String clienteNombre,

        @NotBlank
        @Pattern(regexp = "3[0-9]{9}")
        String clienteTelefono,

        @NotEmpty
        @Size(max = 30)
        List<@Valid OrderItemRequest> items,

        LocalDateTime horaRecogida
) {
    public record OrderItemRequest(
            @NotNull @Positive Integer productoId,

            @NotNull @Min(1) @Max(20)
            Integer cantidad,

            @Size(max = 200)
            String observaciones,

            @Size(max = 20)
            List<@NotNull @Positive Integer> adiciones
    ) {
    }
}