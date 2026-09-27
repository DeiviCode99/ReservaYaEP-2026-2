package com.reservaya.restaurant.repository;

import com.reservaya.restaurant.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Long> {

    List<Branch> findByRestaurantId(Long restaurantId);

    /** Búsqueda del cliente (RF-04): solo sedes activas, con su marca en la misma consulta. */
    @Query("SELECT b FROM Branch b JOIN FETCH b.restaurant r WHERE b.active = true " +
           "AND (:name IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
           "AND (:city IS NULL OR LOWER(b.city) = LOWER(:city)) " +
           "AND (:cuisine IS NULL OR LOWER(r.cuisineType) LIKE LOWER(CONCAT('%', :cuisine, '%'))) " +
           "ORDER BY r.name, b.name")
    List<Branch> search(@Param("name") String name,
                        @Param("city") String city,
                        @Param("cuisine") String cuisine);

    Optional<Branch> findByIdAndRestaurantId(Long id, Long restaurantId);
}
