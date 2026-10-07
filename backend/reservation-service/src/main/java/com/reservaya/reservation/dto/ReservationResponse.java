package com.reservaya.reservation.dto;

<<<<<<< HEAD
import com.reservaya.reservation.client.UserClient.UserSummary;
import com.reservaya.reservation.entity.Reservation;
=======
>>>>>>> juan
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;

<<<<<<< HEAD
/** customerName y customerEmail solo se llenan en el panel del restaurante. */
=======
import com.reservaya.reservation.entity.Reservation;

>>>>>>> juan
public record ReservationResponse(Long id, Long userId, Long branchId,
                                   LocalDate reservationDate, LocalTime reservationTime,
                                   Integer partySize, String event, String confirmationCode, String status,
                                   String cancellationReason,
                                   OffsetDateTime createdAt, OffsetDateTime updatedAt,
                                   String customerName, String customerEmail) {

    public static ReservationResponse from(Reservation r) {
        return new ReservationResponse(r.getId(), r.getUserId(), r.getBranchId(),
                r.getReservationDate(), r.getReservationTime(),
<<<<<<< HEAD
                r.getPartySize(), r.getStatus().name(),
            r.getCancellationReason(), r.getCreatedAt(), r.getUpdatedAt(), null, null);
    }

    public ReservationResponse withCustomer(UserSummary customer) {
        if (customer == null) return this;
        return new ReservationResponse(id, userId, branchId, reservationDate, reservationTime,
                partySize, status, cancellationReason, createdAt, updatedAt,
                customer.name(), customer.email());
=======
                r.getPartySize(), r.getEvent(), r.getConfirmationCode(), r.getStatus().name(),
                r.getCancellationReason(), r.getCreatedAt(), r.getUpdatedAt());
>>>>>>> juan
    }
}
