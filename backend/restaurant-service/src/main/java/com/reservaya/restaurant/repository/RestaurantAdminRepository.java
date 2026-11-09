package com.reservaya.restaurant.repository;

import com.reservaya.restaurant.entity.RestaurantAdmin;
import com.reservaya.restaurant.entity.RestaurantAdminId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RestaurantAdminRepository extends JpaRepository<RestaurantAdmin, RestaurantAdminId> {

    List<RestaurantAdmin> findByIdUserId(Long userId);
}
