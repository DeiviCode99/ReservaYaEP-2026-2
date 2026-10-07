package com.reservaya.reservation.dto;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

import com.reservaya.reservation.entity.Reservation;

public record ReservationResponse(Long id, Long userId, Long branchId,
                                   LocalDate reservationDate, LocalTime reservationTime,
                                   Integer partySize, String event, String confirmationCode, String status,
                                   String cancellationReason,
                                   OffsetDateTime createdAt, OffsetDateTime updatedAt) {

    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(r.getId(), r.getUserId(), r.getBranchId(),
                r.getReservationDate(), r.getReservationTime(),
                r.getPartySize(), r.getEvent(), r.getConfirmationCode(), r.getStatus().name(),
                r.getCancellationReason(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
