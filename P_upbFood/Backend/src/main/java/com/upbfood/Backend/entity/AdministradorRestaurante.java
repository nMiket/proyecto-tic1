
package com.upbfood.Backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "administrador_restaurante")
public class AdministradorRestaurante {

    @EmbeddedId
    private AdministradorRestauranteId id;

    @Column(name = "tipo_administrador_id", nullable = false)
    private Integer tipoAdministradorId;

    @Column(name = "estado")
    private String estado;

    public AdministradorRestauranteId getId() {
        return id;
    }

    public void setId(AdministradorRestauranteId id) {
        this.id = id;
    }

    public Integer getTipoAdministradorId() {
        return tipoAdministradorId;
    }

    public void setTipoAdministradorId(Integer tipoAdministradorId) {
        this.tipoAdministradorId = tipoAdministradorId;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }
}
