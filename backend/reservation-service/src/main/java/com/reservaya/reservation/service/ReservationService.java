package com.reservaya.reservation.service;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.reservaya.reservation.config.ReservationProperties;
import com.reservaya.reservation.dto.ReservationRequest;
import com.reservaya.reservation.dto.ReservationResponse;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationAudit;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.InsufficientCapacityException;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import com.reservaya.reservation.repository.ReservationAuditRepository;
import com.reservaya.reservation.repository.ReservationRepository;
import com.reservaya.reservation.security.AuthenticatedUser;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Casos de uso del cliente sobre sus propias reservas (RF-06 a RF-09).
 * Lo que hace el restaurante con las reservas de sus sedes vive en
 * {@link BranchReservationService}.
 */
@Service
@EnableConfigurationProperties(ReservationProperties.class)
public class ReservationService {

    private static final ZoneId ZONE = ZoneId.of("America/Bogota");

    private final ReservationRepository reservationRepository;
    private final ReservationAuditRepository auditRepository;
    private final AvailabilityService availabilityService;
    private final ReservationProperties reservationProperties;
    private final ReservationNotifier notifier;

    public ReservationService(ReservationRepository reservationRepository,
                              ReservationAuditRepository auditRepository,
                              AvailabilityService availabilityService,
                              ReservationProperties reservationProperties,
                              ReservationNotifier notifier) {
        this.reservationRepository = reservationRepository;
        this.auditRepository = auditRepository;
        this.availabilityService = availabilityService;
        this.reservationProperties = reservationProperties;
        this.notifier = notifier;
    }

    @Transactional
    public ReservationResponse create(ReservationRequest request, AuthenticatedUser user) {
        requireSeats(request, availableSeats(request));

        Reservation reservation = new Reservation();
        reservation.setUserId(user.id());
        reservation.setCustomerEmail(user.email());
        apply(reservation, request);
        Reservation saved = reservationRepository.save(reservation);
        recordAudit(saved, user, "CREATED", null, saved.getStatus(), "Reserva creada por el cliente.");
        return ReservationResponse.from(saved);
    }

    /**
     * RF-09: cambia sede, fecha, hora o personas de una reserva propia. Vuelve
     * a PENDING porque el restaurante debe aceptar el nuevo horario.
     */
    @Transactional
    public ReservationResponse update(Long id, ReservationRequest request, AuthenticatedUser user) {
        Reservation reservation = findChangeable(id, user, "modificar");
        ReservationStatus previousStatus = reservation.getStatus();

        // Si se queda en la misma franja, sus propios puestos cuentan como libres.
        boolean sameSlot = reservation.getBranchId().equals(request.getBranchId())
                && reservation.getReservationDate().equals(request.getReservationDate())
                && reservation.getReservationTime().equals(request.getReservationTime());
        int ownSeats = 0;
        if (sameSlot) {
            Integer reservedPartySize = reservation.getPartySize();
            if (reservedPartySize != null) ownSeats = reservedPartySize;
        }
        requireSeats(request, availableSeats(request) + ownSeats);

        apply(reservation, request);
        Reservation saved = reservationRepository.save(reservation);
        recordAudit(saved, user, "MODIFIED", previousStatus, saved.getStatus(),
            "Fecha, hora, sede o número de personas modificados por el cliente.");
        notifier.notifyCustomer(saved, "Reserva modificada",
            "Tu reserva #" + saved.getId() + " fue modificada y quedó pendiente de confirmación.");
        return ReservationResponse.from(saved);
    }

    /**
     * Cupo de la franja pedida. Usa las mismas franjas que ve el cliente:
     * dentro del horario de la sede y aún no iniciadas.
     */
    private int availableSeats(ReservationRequest request) {
        return availabilityService
                .getAvailability(request.getBranchId(), request.getReservationDate())
                .slots().stream()
                .filter(slot -> slot.time().equals(request.getReservationTime()))
                .findFirst()
                .orElseThrow(() -> new InvalidOperationException(
                        "La sede no atiende a esa hora o la franja ya pasó."))
                .available();
    }

    private static void requireSeats(ReservationRequest request, int available) {
        if (available < request.getPartySize()) {
            throw new InsufficientCapacityException(
                    "No hay cupo suficiente. Disponible: " + available + " personas.");
        }
    }

    private static void apply(Reservation reservation, ReservationRequest request) {
        reservation.setBranchId(request.getBranchId());
        reservation.setReservationDate(request.getReservationDate());
        reservation.setReservationTime(request.getReservationTime());
        reservation.setPartySize(request.getPartySize());
        reservation.setStatus(ReservationStatus.PENDING);
    }

    public List<ReservationResponse> getMyReservations(AuthenticatedUser user) {
        return reservationRepository
                .findByUserIdOrderByReservationDateDescReservationTimeDesc(user.id())
                .stream().map(ReservationResponse::from).toList();
    }

    @Transactional
    public ReservationResponse cancel(Long id, String reason, AuthenticatedUser user) {
        Reservation reservation = findChangeable(id, user, "cancelar");
        ReservationStatus previousStatus = reservation.getStatus();
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservation.setCancellationReason(reason);
        Reservation saved = reservationRepository.save(reservation);
        recordAudit(saved, user, "CANCELLED", previousStatus, saved.getStatus(), reason);
        notifier.notifyCustomer(saved, "Reserva cancelada",
            "Tu reserva #" + saved.getId() + " fue cancelada correctamente.");
        return ReservationResponse.from(saved);
    }

    /** Reglas comunes de RF-09: reserva propia, activa y con la anticipación mínima. */
    private Reservation findChangeable(Long id, AuthenticatedUser user, String action) {
        if (user == null || !"CLIENT".equals(user.role())) {
            throw new AccessDeniedException("Solo el cliente puede " + action + " sus reservas.");
        }
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada."));

        if (!reservation.getUserId().equals(user.id())) {
            throw new InvalidOperationException("No puedes " + action + " una reserva que no es tuya.");
        }

        if (!reservation.getStatus().isActive()) {
            throw new InvalidOperationException("Solo se pueden " + action + " reservas pendientes o confirmadas.");
        }

        LocalDateTime reservationDateTime = LocalDateTime.of(
                reservation.getReservationDate(), reservation.getReservationTime());
        LocalDateTime now = LocalDateTime.now(ZONE);
        long hoursUntil = ChronoUnit.HOURS.between(now, reservationDateTime);

        if (hoursUntil < reservationProperties.getMinHoursBeforeCancel()) {
            throw new InvalidOperationException(
                    "No se puede " + action + " con menos de " + reservationProperties.getMinHoursBeforeCancel()
                            + " horas de anticipación.");
        }
        return reservation;
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
}
