
package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.SolicitudRegistroRestaurante;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.List;

public interface SolicitudRegistroRestauranteRepository
        extends JpaRepository<SolicitudRegistroRestaurante, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT s
            FROM SolicitudRegistroRestaurante s
            WHERE s.id = :id
            """)
    Optional<SolicitudRegistroRestaurante> buscarPorIdParaRevision(
            @Param("id") Long id);

    List<SolicitudRegistroRestaurante> findByEstadoOrderByFechaSolicitudDesc(
            String estado);
}
