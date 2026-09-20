package com.reservaya.restaurant.repository;

import com.reservaya.restaurant.entity.Restaurant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {

    @Query("SELECT DISTINCT r FROM Restaurant r LEFT JOIN r.branches b " +
           "WHERE (:name IS NULL OR LOWER(r.name) LIKE LOWER(CONCAT('%', :name, '%'))) " +
           "AND (:city IS NULL OR LOWER(b.city) = LOWER(:city)) " +
           "AND (:cuisine IS NULL OR LOWER(r.cuisineType) = LOWER(:cuisine))")
    List<Restaurant> search(@Param("name") String name,
                            @Param("city") String city,
                            @Param("cuisine") String cuisine);

    boolean existsByName(String name);
}
