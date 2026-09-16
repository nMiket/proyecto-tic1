package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {
    Optional<Client> findByCorreo(String correo);
}
