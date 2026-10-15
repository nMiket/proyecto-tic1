
package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.InvitacionAdministrador;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InvitacionAdministradorRepository
        extends JpaRepository<InvitacionAdministrador, Long> {

    Optional<InvitacionAdministrador> findByTokenHash(String tokenHash);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT i
        FROM InvitacionAdministrador i
        WHERE i.tokenHash = :tokenHash
        """)
    Optional<InvitacionAdministrador> buscarPorHashParaUso(
            @Param("tokenHash") String tokenHash
    );
}
