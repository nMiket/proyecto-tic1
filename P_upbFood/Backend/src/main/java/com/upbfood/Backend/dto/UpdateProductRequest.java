package com.upbfood.Backend.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public class UpdateProductRequest {

    @NotBlank(message = "El nombre es obligatorio.")
    private String nombre;

    @NotNull(message = "El precio es obligatorio.")
    @DecimalMin(value = "0.01", message = "El precio debe ser mayor que cero.")
    private BigDecimal precio;

    @NotNull(message = "La categoría es obligatoria.")
    @Positive(message = "La categoría debe ser válida.")
    private Long categoriaId;

    @NotNull(message = "El restaurante es obligatorio.")
    @Positive(message = "El restaurante debe ser válido.")
    private Long restauranteId;

    @NotNull(message = "La disponibilidad es obligatoria.")
    private Boolean disponible;

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }
    public BigDecimal getPrecio() { return precio; }
    public void setPrecio(BigDecimal precio) { this.precio = precio; }
    public Long getCategoriaId() { return categoriaId; }
    public void setCategoriaId(Long categoriaId) { this.categoriaId = categoriaId; }
    public Long getRestauranteId() { return restauranteId; }
    public void setRestauranteId(Long restauranteId) { this.restauranteId = restauranteId; }
    public Boolean getDisponible() { return disponible; }
    public void setDisponible(Boolean disponible) { this.disponible = disponible; }
}
