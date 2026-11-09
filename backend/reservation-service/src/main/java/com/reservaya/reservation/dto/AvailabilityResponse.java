package com.reservaya.reservation.dto;

import java.time.LocalDate;
import java.util.List;

public record AvailabilityResponse(Long branchId, LocalDate date, int capacity, List<TimeSlot> slots) {
}
