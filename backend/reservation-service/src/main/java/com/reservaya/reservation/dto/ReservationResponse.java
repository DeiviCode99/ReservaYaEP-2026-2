package com.reservaya.reservation.dto;

import com.reservaya.reservation.entity.Reservation;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

public record ReservationResponse(Long id, Long userId, Long branchId,
                                   LocalDate reservationDate, LocalTime reservationTime,
                                   Integer partySize, String status,
                                   String cancellationReason,
                                   OffsetDateTime createdAt, OffsetDateTime updatedAt) {

    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(r.getId(), r.getUserId(), r.getBranchId(),
                r.getReservationDate(), r.getReservationTime(),
                r.getPartySize(), r.getStatus().name(),
                r.getCancellationReason(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
