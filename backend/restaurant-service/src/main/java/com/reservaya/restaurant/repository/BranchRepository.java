package com.reservaya.restaurant.repository;

import com.reservaya.restaurant.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Long> {

    List<Branch> findByRestaurantId(Long restaurantId);

    Optional<Branch> findByIdAndRestaurantId(Long id, Long restaurantId);
}
