package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClientRepository extends JpaRepository<Client, Long> {
	java.util.Optional<Client> findByCorreo(String correo);
}
