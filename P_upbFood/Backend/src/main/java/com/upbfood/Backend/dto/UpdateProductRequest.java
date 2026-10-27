
package com.upbfood.Backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateProductRequest(
        @NotBlank
        @Size(max = 50)
        String nombre,

        @NotBlank
        @Size(max = 120)
        String descripcion,

        @NotNull
        @Positive
        BigDecimal precio,

        @NotNull
        @Positive
        Integer categoriaId,

        @NotNull
        @Positive
        Integer restauranteId,

        @Size(max = 2000000)
        String imagenUrl,

        @NotNull
        Boolean disponible
) {
}
