package com.upbfood.Backend.entity;

import jakarta.persistence.*;



import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import com.fasterxml.jackson.annotation.JsonManagedReference;

@Entity
@Table(name = "pedidos")



public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "restaurante_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Client client;

    @Column(nullable = false, length = 30)
    @Enumerated(EnumType.STRING)
    private EstadoPedido estado = EstadoPedido.PENDIENTE;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal total;

    @Column(name = "fecha_creacion", insertable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @Column(name = "codigo_seguimiento", nullable = false, unique = true)
    private UUID codigoSeguimiento;

    @Column(name = "hora_recogida")
    private LocalDateTime horaRecogida;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    @JsonManagedReference
    private List<OrderDetail> details;


    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }
    public Client getClient() { return client; }
    public void setClient(Client client) { this.client = client; }
    public EstadoPedido getEstado() { return estado; }
    public void setEstado(EstadoPedido estado) { this.estado = estado; }
    public BigDecimal getTotal() { return total; }
    public void setTotal(BigDecimal total) { this.total = total; }
    public LocalDateTime getFechaCreacion() { return fechaCreacion; }
    public void setFechaCreacion(LocalDateTime fechaCreacion) { this.fechaCreacion = fechaCreacion; }
    public UUID getCodigoSeguimiento() { return codigoSeguimiento; }
    public void setCodigoSeguimiento(UUID codigoSeguimiento) { this.codigoSeguimiento = codigoSeguimiento; }
    public LocalDateTime getHoraRecogida() { return horaRecogida; }
    public void setHoraRecogida(LocalDateTime horaRecogida) { this.horaRecogida = horaRecogida; }
    public List<OrderDetail> getDetails() { return details; }
    public void setDetails(List<OrderDetail> details) { this.details = details; }


}
