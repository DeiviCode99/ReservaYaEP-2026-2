package com.reservaya.reservation.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import com.reservaya.reservation.entity.Reservation;

public record ReservationResponse(Long id, Long userId, String customerEmail, Long branchId,
                                   LocalDate reservationDate, LocalTime reservationTime,
                                   Integer partySize, String status,
                                   String cancellationReason,
                                   OffsetDateTime createdAt, OffsetDateTime updatedAt) {

    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(r.getId(), r.getUserId(), r.getCustomerEmail(), r.getBranchId(),
                r.getReservationDate(), r.getReservationTime(),
                r.getPartySize(), r.getStatus().name(),
                r.getCancellationReason(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
