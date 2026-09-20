package com.reservaya.reservation.service;

import com.reservaya.reservation.client.RestaurantClient;
import com.reservaya.reservation.dto.*;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import com.reservaya.reservation.repository.ReservationRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class AvailabilityService {

    private static final List<ReservationStatus> ACTIVE_STATUSES =
            List.of(ReservationStatus.PENDING, ReservationStatus.CONFIRMED);

    private final RestaurantClient restaurantClient;
    private final ReservationRepository reservationRepository;

    public AvailabilityService(RestaurantClient restaurantClient,
                               ReservationRepository reservationRepository) {
        this.restaurantClient = restaurantClient;
        this.reservationRepository = reservationRepository;
    }

    public AvailabilityResponse getAvailability(Long branchId, LocalDate date) {
        BranchInfoDto branch = restaurantClient.getBranch(branchId);

        if (!branch.getActive()) {
            throw new ResourceNotFoundException("La sede no está activa.");
        }

        int isoDayOfWeek = date.getDayOfWeek().getValue();
        ScheduleInfoDto schedule = branch.getSchedules().stream()
                .filter(s -> s.getDayOfWeek() == isoDayOfWeek)
                .findFirst()
                .orElse(null);

        if (schedule == null || schedule.getIsClosed()) {
            return new AvailabilityResponse(branchId, date, branch.getCapacity(), List.of());
        }

        List<TimeSlot> slots = new ArrayList<>();
        LocalTime current = schedule.getOpenTime();
        LocalTime close = schedule.getCloseTime();

        while (current.isBefore(close)) {
            int occupied = reservationRepository.sumPartySizeBySlot(
                    branchId, date, current, ACTIVE_STATUSES);
            int available = branch.getCapacity() - occupied;
            slots.add(new TimeSlot(current, Math.max(available, 0)));
            current = current.plusHours(1);
        }

        return new AvailabilityResponse(branchId, date, branch.getCapacity(), slots);
    }
}
