
package com.upbfood.Backend.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class SolicitudRegistroRestauranteRequest {

    @NotBlank
    @Size(max = 100)
    private String nombreSolicitante;

    @NotBlank
    @Size(max = 20)
    private String telefonoSolicitante;

    @NotBlank
    @Email
    @Size(max = 255)
    private String correoSolicitante;

    @NotBlank
    @Size(max = 50)
    private String nombreRestaurante;

    @NotBlank
    @Size(max = 50)
    private String ubicacionRestaurante;

    @NotNull
    @Min(1)
    @Max(1440)
    private Integer tiempoPreparacionMin;

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
}
