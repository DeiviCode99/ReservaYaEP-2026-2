package com.reservaya.reservation.service;

import com.reservaya.reservation.client.UserClient;
import com.reservaya.reservation.client.UserClient.UserSummary;
import com.reservaya.reservation.dto.ReservationResponse;
import com.reservaya.reservation.dto.StatusUpdateRequest;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import com.reservaya.reservation.repository.ReservationRepository;
import com.reservaya.reservation.security.AuthenticatedUser;
import com.reservaya.reservation.security.BranchAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Casos de uso del restaurante sobre las reservas de sus sedes:
 * verlas por fecha (RF-10) y aceptarlas, rechazarlas o completarlas (RF-11).
 */
@Service
public class BranchReservationService {

    private final ReservationRepository reservationRepository;
    private final BranchAccess branchAccess;
    private final UserClient userClient;

    public BranchReservationService(ReservationRepository reservationRepository,
                                    BranchAccess branchAccess,
                                    UserClient userClient) {
        this.reservationRepository = reservationRepository;
        this.branchAccess = branchAccess;
        this.userClient = userClient;
    }

    public List<ReservationResponse> getByBranch(Long branchId, LocalDate date, String status,
                                                 AuthenticatedUser user) {
        branchAccess.requireAdmin(branchId, user);

        List<Reservation> reservations = status == null || status.isBlank()
                ? reservationRepository.findByBranchIdAndReservationDate(branchId, date)
                : reservationRepository.findByBranchIdAndReservationDateAndStatusIn(
                        branchId, date, List.of(parseStatus(status)));

        Set<Long> customerIds = reservations.stream().map(Reservation::getUserId).collect(Collectors.toSet());
        Map<Long, UserSummary> customers = userClient.findByIds(customerIds);

        return reservations.stream()
                .sorted(Comparator.comparing(Reservation::getReservationTime))
                .map(r -> ReservationResponse.from(r).withCustomer(customers.get(r.getUserId())))
                .toList();
    }

    @Transactional
    public ReservationResponse updateStatus(Long id, StatusUpdateRequest request, AuthenticatedUser user) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada."));
        branchAccess.requireAdmin(reservation.getBranchId(), user);

        ReservationStatus next = parseStatus(request.getStatus());
        if (!reservation.getStatus().canBeChangedByRestaurantTo(next)) {
            throw new InvalidOperationException(
                    "Una reserva " + reservation.getStatus() + " no puede pasar a " + next + ".");
        }

        reservation.setStatus(next);
        if (request.getCancellationReason() != null && !request.getCancellationReason().isBlank()) {
            reservation.setCancellationReason(request.getCancellationReason().trim());
        }
        return ReservationResponse.from(reservationRepository.save(reservation));
    }

    private static ReservationStatus parseStatus(String status) {
        try {
            return ReservationStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidOperationException("Estado de reserva no válido: " + status);
        }
    }
}
