
package com.upbfood.Backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "restaurante")
public class Restaurant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "restaurante_id")
    private Integer id;

    @Column(name = "nombre_restaurante", nullable = false, length = 50)
    private String nombre;

    @Column(name = "ubicacion_restaurante", nullable = false, length = 50)
    private String ubicacion;

    @Column(name = "estado", nullable = false, length = 20)
    private String estado = "Abierto";

    @Column(name = "tiempo_pedido", nullable = false)
    private Integer tiempoEstimadoMin = 15;

    @Column(name = "imagen_url", columnDefinition = "TEXT")
    private String imagenUrl;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getUbicacion() {
        return ubicacion;
    }

    public void setUbicacion(String ubicacion) {
        this.ubicacion = ubicacion;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public Integer getTiempoEstimadoMin() {
        return tiempoEstimadoMin;
    }

    public void setTiempoEstimadoMin(Integer tiempoEstimadoMin) {
        this.tiempoEstimadoMin = tiempoEstimadoMin;
    }

    public String getImagenUrl() {
        return imagenUrl;
    }

    public void setImagenUrl(String imagenUrl) {
        this.imagenUrl = imagenUrl;
    }

    public String getImagen() {
        return imagenUrl;
    }

    public void setImagen(String imagen) {
        this.imagenUrl = imagen;
    }
}
