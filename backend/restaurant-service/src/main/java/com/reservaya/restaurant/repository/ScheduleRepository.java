package com.reservaya.restaurant.repository;

import com.reservaya.restaurant.entity.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    List<Schedule> findByBranchId(Long branchId);
}
