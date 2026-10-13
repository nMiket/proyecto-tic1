
package com.upbfood.Backend.repository;

import com.upbfood.Backend.entity.AdministradorRestaurante;
import com.upbfood.Backend.entity.AdministradorRestauranteId;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdministradorRestauranteRepository
                extends JpaRepository<AdministradorRestaurante, AdministradorRestauranteId> {

        List<AdministradorRestaurante> findByIdAdministradorId(
                        Integer administradorId);

        List<AdministradorRestaurante> findByIdAdministradorIdAndEstado(
                        Integer administradorId, String estado);

        List<AdministradorRestaurante> findByIdRestauranteIdAndTipoAdministradorIdAndEstado(
                        Integer restauranteId,
                        Integer tipoAdministradorId,
                        String estado);

        Optional<AdministradorRestaurante> findByIdAdministradorIdAndIdRestauranteId(
                        Integer administradorId,
                        Integer restauranteId);
}
