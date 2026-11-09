package com.reservaya.restaurant.repository;

import com.reservaya.restaurant.entity.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    /** Filtro vacío = "" (no null), igual que BranchRepository.search. */
    @Query("SELECT DISTINCT r FROM Restaurant r LEFT JOIN r.branches b " +
           "WHERE (:name = '' OR LOWER(r.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
           "AND (:city = '' OR LOWER(b.city) = LOWER(:city)) " +
           "AND (:cuisine = '' OR LOWER(r.cuisineType) LIKE LOWER(CONCAT('%', :cuisine, '%')))")
    List<Restaurant> search(@Param("name") String name,
                            @Param("city") String city,
                            @Param("cuisine") String cuisine);

    boolean existsByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCaseAndIdNot(String name, Long id);
}
