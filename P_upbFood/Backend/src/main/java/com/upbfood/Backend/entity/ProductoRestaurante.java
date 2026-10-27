
package com.upbfood.Backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "producto_restaurante")
public class ProductoRestaurante {

    @EmbeddedId
    private ProductoRestauranteId id;

    @Column(name = "precio", nullable = false, precision = 10, scale = 2)
    private BigDecimal precio;

    @Column(name = "imagen_url", columnDefinition = "TEXT")
    private String imagenUrl;

    @Column(name = "disponible", nullable = false)
    private Boolean disponible = true;

    public ProductoRestauranteId getId() {
        return id;
    }

    public void setId(ProductoRestauranteId id) {
        this.id = id;
    }

    public BigDecimal getPrecio() {
        return precio;
    }

    public void setPrecio(BigDecimal precio) {
        this.precio = precio;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public void setImagenUrl(String imagenUrl) {
        this.imagenUrl = imagenUrl;
    }

    public Boolean getDisponible() {
        return disponible;
    }

    public void setDisponible(Boolean disponible) {
        this.disponible = disponible;
    }
}
