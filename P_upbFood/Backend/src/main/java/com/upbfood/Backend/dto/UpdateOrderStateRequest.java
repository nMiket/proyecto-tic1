package com.upbfood.Backend.dto;

import com.upbfood.Backend.entity.EstadoPedido;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStateRequest(@NotNull EstadoPedido estado) {
}