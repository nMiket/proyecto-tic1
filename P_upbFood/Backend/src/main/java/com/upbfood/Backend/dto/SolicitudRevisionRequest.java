package com.upbfood.Backend.dto;

import jakarta.validation.constraints.Size;

public class SolicitudRevisionRequest {

    @Size(max = 500)
    private String observacion;

    public String getObservacion() {
        return observacion;
    }

    public void setObservacion(String observacion) {
        this.observacion = observacion;
    }
}