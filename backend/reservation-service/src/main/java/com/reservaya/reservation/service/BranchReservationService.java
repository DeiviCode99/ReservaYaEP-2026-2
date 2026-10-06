package com.reservaya.reservation.service;

import com.reservaya.reservation.client.UserClient;
import com.reservaya.reservation.client.UserClient.UserSummary;
import com.reservaya.reservation.dto.ReservationResponse;
import com.reservaya.reservation.dto.StatusUpdateRequest;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationAudit;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import com.reservaya.reservation.repository.ReservationAuditRepository;
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
    private final ReservationAuditRepository auditRepository;
    private final BranchAccess branchAccess;
    private final UserClient userClient;
    private final ReservationNotifier notifier;

    public BranchReservationService(ReservationRepository reservationRepository,
                                    ReservationAuditRepository auditRepository,
                                    BranchAccess branchAccess,
                                    UserClient userClient,
                                    ReservationNotifier notifier) {
        this.reservationRepository = reservationRepository;
        this.auditRepository = auditRepository;
        this.branchAccess = branchAccess;
        this.userClient = userClient;
        this.notifier = notifier;
    }

    public List<ReservationResponse> getByBranch(Long branchId, LocalDate from, LocalDate to, String status,
                                                 AuthenticatedUser user) {
        branchAccess.requireAdmin(branchId, user);
        if (from == null && to == null) {
            throw new InvalidOperationException("Indica una fecha o un rango de fechas.");
        }
        // Con una sola fecha del rango, se consulta ese día.
        LocalDate start = from != null ? from : to;
        LocalDate end = to != null ? to : from;
        if (start.isAfter(end)) {
            throw new InvalidOperationException("La fecha inicial no puede ser posterior a la fecha final.");
        }

        List<ReservationStatus> statuses = status == null || status.isBlank()
                ? List.of(ReservationStatus.values())
                : List.of(parseStatus(status));
        List<Reservation> reservations = reservationRepository
                .searchByBranchAndDateRange(branchId, start, end, statuses);

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
        ReservationStatus previous = reservation.getStatus();
        if (!previous.canBeChangedByRestaurantTo(next)) {
            throw new InvalidOperationException(
                "Una reserva " + previous + " no puede pasar a " + next + ".");
        }

        reservation.setStatus(next);
        if (request.getCancellationReason() != null && !request.getCancellationReason().isBlank()) {
            reservation.setCancellationReason(request.getCancellationReason().trim());
        }
        Reservation saved = reservationRepository.save(reservation);
        recordAudit(saved, user, "STATUS_CHANGED", previous, next, request.getCancellationReason());
        notifier.notifyCustomer(saved, "Estado de reserva actualizado",
            "El estado de tu reserva #" + saved.getId() + " cambió de " + statusLabel(previous)
                + " a " + statusLabel(next) + ".");
        return ReservationResponse.from(saved);
    }

    private static ReservationStatus parseStatus(String status) {
        try {
            return ReservationStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new InvalidOperationException("Estado de reserva no válido: " + status);
        }
    }

    private void recordAudit(Reservation reservation, AuthenticatedUser actor, String action,
                             ReservationStatus previousStatus, ReservationStatus newStatus, String details) {
        ReservationAudit audit = new ReservationAudit();
        audit.setReservationId(reservation.getId());
        audit.setActorUserId(actor.id());
        audit.setActorRole(actor.role());
        audit.setAction(action);
        audit.setPreviousStatus(previousStatus);
        audit.setNewStatus(newStatus);
        audit.setDetails(details);
        auditRepository.save(audit);
    }

    private static String statusLabel(ReservationStatus status) {
        return switch (status) {
            case PENDING -> "pendiente";
            case CONFIRMED -> "confirmada";
            case CANCELLED -> "cancelada";
            case REJECTED -> "rechazada";
            case COMPLETED -> "completada";
        };
    }
}
