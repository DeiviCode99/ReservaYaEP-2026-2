package com.reservaya.restaurant.dto;

import com.reservaya.restaurant.entity.Branch;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public record BranchResponse(Long id, Long restaurantId, String name, String address,
                              String city, String phone, BigDecimal latitude, BigDecimal longitude,
                              Integer capacity, Boolean active,
                              List<ScheduleResponse> schedules,
                              OffsetDateTime createdAt, OffsetDateTime updatedAt) {

    public static BranchResponse from(Branch b) {
        List<ScheduleResponse> scheduleList = b.getSchedules().stream()
                .map(ScheduleResponse::from)
                .toList();
        return new BranchResponse(b.getId(), b.getRestaurant().getId(), b.getName(),
                b.getAddress(), b.getCity(), b.getPhone(),
                b.getLatitude(), b.getLongitude(), b.getCapacity(), b.getActive(),
                scheduleList, b.getCreatedAt(), b.getUpdatedAt());
    }
}
