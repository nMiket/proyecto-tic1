
package com.upbfood.Backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "administrador")
public class AdminUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "administrador_id")
    private Integer id;

    @Column(name = "es_top_global", nullable = false)
    private boolean esTopGlobal = false;

    @Column(name = "nombre_administrador", nullable = false, length = 50)
    private String nombre;

    @Column(name = "telefono_administrador", nullable = false, length = 20)
    private String telefono;

    @Column(name = "correo_administrador", nullable = false)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getNombre() { return nombre; }
    public void setNombre(String nombre) { this.nombre = nombre; }

    public String getTelefono() { return telefono; }
    public void setTelefono(String telefono) { this.telefono = telefono; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }
    public boolean isEsTopGlobal() { return esTopGlobal;}
    public void setEsTopGlobal(boolean esTopGlobal) { this.esTopGlobal = esTopGlobal; }
}
