
package com.upbfood.Backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class AdministradorRestauranteId implements Serializable {

    @Column(name = "administrador_id")
    private Integer administradorId;

    @Column(name = "restaurante_id")
    private Integer restauranteId;

    public AdministradorRestauranteId() {
    }

    public AdministradorRestauranteId(
            Integer administradorId,
            Integer restauranteId) {
        this.administradorId = administradorId;
        this.restauranteId = restauranteId;
    }

    public Integer getAdministradorId() { return administradorId; }
    public void setAdministradorId(Integer administradorId) {
        this.administradorId = administradorId;
    }

    public Integer getRestauranteId() { return restauranteId; }
    public void setRestauranteId(Integer restauranteId) {
        this.restauranteId = restauranteId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof AdministradorRestauranteId that)) return false;

        return Objects.equals(administradorId, that.administradorId)
                && Objects.equals(restauranteId, that.restauranteId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(administradorId, restauranteId);
    }
}
