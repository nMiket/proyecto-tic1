
package com.upbfood.Backend.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "solicitud_registro_restaurante")
public class SolicitudRegistroRestaurante {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "solicitud_id")
    private Long id;

    @Column(name = "nombre_solicitante", nullable = false, length = 100)
    private String nombreSolicitante;

    @Column(name = "telefono_solicitante", nullable = false, length = 20)
    private String telefonoSolicitante;

    @Column(name = "correo_solicitante", nullable = false, length = 255)
    private String correoSolicitante;

    @Column(name = "nombre_restaurante", nullable = false, length = 50)
    private String nombreRestaurante;

    @Column(name = "ubicacion_restaurante", nullable = false, length = 50)
    private String ubicacionRestaurante;

    @Column(name = "tiempo_preparacion_min", nullable = false)
    private Integer tiempoPreparacionMin;

    @Column(name = "estado", nullable = false, length = 15)
    private String estado = "PENDIENTE";

    @Column(name = "fecha_solicitud", nullable = false)
    private LocalDateTime fechaSolicitud;

    @Column(name = "fecha_revision")
    private LocalDateTime fechaRevision;

    @Column(name = "observacion_revision", length = 500)
    private String observacionRevision;

    @PrePersist
    protected void alCrear() {
        if (fechaSolicitud == null) {
            fechaSolicitud = LocalDateTime.now();
        }
        if (estado == null) {
            estado = "PENDIENTE";
        }
    }

    public Long getId() {
        return id;
    }

    public String getNombreSolicitante() {
        return nombreSolicitante;
    }

    public void setNombreSolicitante(String nombreSolicitante) {
        this.nombreSolicitante = nombreSolicitante;
    }

    public String getTelefonoSolicitante() {
        return telefonoSolicitante;
    }

    public void setTelefonoSolicitante(String telefonoSolicitante) {
        this.telefonoSolicitante = telefonoSolicitante;
    }

    public String getCorreoSolicitante() {
        return correoSolicitante;
    }

    public void setCorreoSolicitante(String correoSolicitante) {
        this.correoSolicitante = correoSolicitante;
    }

    public String getNombreRestaurante() {
        return nombreRestaurante;
    }

    public void setNombreRestaurante(String nombreRestaurante) {
        this.nombreRestaurante = nombreRestaurante;
    }

    public String getUbicacionRestaurante() {
        return ubicacionRestaurante;
    }

    public void setUbicacionRestaurante(String ubicacionRestaurante) {
        this.ubicacionRestaurante = ubicacionRestaurante;
    }

    public Integer getTiempoPreparacionMin() {
        return tiempoPreparacionMin;
    }

    public void setTiempoPreparacionMin(Integer tiempoPreparacionMin) {
        this.tiempoPreparacionMin = tiempoPreparacionMin;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public LocalDateTime getFechaSolicitud() {
        return fechaSolicitud;
    }

    public LocalDateTime getFechaRevision() {
        return fechaRevision;
    }

    public void setFechaRevision(LocalDateTime fechaRevision) {
        this.fechaRevision = fechaRevision;
    }

    public String getObservacionRevision() {
        return observacionRevision;
    }

    public void setObservacionRevision(String observacionRevision) {
        this.observacionRevision = observacionRevision;
    }
}
