
package com.upbfood.Backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;

@Embeddable
public class ProductoRestauranteId implements Serializable {

    @Column(name = "restaurante_id")
    private Integer restauranteId;

    @Column(name = "producto_id")
    private Integer productoId;

    public ProductoRestauranteId() {
    }

    public ProductoRestauranteId(Integer restauranteId, Integer productoId) {
        this.restauranteId = restauranteId;
        this.productoId = productoId;
    }

    public Integer getRestauranteId() {
        return restauranteId;
    }

    public void setRestauranteId(Integer restauranteId) {
        this.restauranteId = restauranteId;
    }

    public Integer getProductoId() {
        return productoId;
    }

    public void setProductoId(Integer productoId) {
        this.productoId = productoId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof ProductoRestauranteId that)) return false;
        return Objects.equals(restauranteId, that.restauranteId)
                && Objects.equals(productoId, that.productoId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(restauranteId, productoId);
    }
}
