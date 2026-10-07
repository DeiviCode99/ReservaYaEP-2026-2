package com.reservaya.reservation.service;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Locale;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.reservaya.reservation.client.RestaurantClient;
import com.reservaya.reservation.config.ReservationProperties;
import com.reservaya.reservation.dto.ReservationRequest;
import com.reservaya.reservation.dto.ReservationResponse;
import com.reservaya.reservation.dto.StatusUpdateRequest;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.InsufficientCapacityException;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import com.reservaya.reservation.repository.ReservationRepository;
import com.reservaya.reservation.security.AuthenticatedUser;

@Service
@EnableConfigurationProperties(ReservationProperties.class)
public class ReservationService {

    private static final ZoneId ZONE = ZoneId.of("America/Bogota");

    private final ReservationRepository reservationRepository;
    private final AvailabilityService availabilityService;
    private final ReservationProperties reservationProperties;
    private final RestaurantClient restaurantClient;

    public ReservationService(ReservationRepository reservationRepository,
                              AvailabilityService availabilityService,
                              ReservationProperties reservationProperties,
                              RestaurantClient restaurantClient) {
        this.reservationRepository = reservationRepository;
        this.availabilityService = availabilityService;
        this.reservationProperties = reservationProperties;
        this.restaurantClient = restaurantClient;
    }

    public ReservationService(ReservationRepository reservationRepository,
                              AvailabilityService availabilityService,
                              ReservationProperties reservationProperties) {
        this(reservationRepository, availabilityService, reservationProperties, null);
    }

    @Transactional
    public ReservationResponse create(ReservationRequest request, AuthenticatedUser user) {
        requireSeats(request, availableSeats(request));

        Reservation reservation = new Reservation();
        reservation.setUserId(user.id());
        String restaurantName = restaurantClient == null
            ? "ReservaYa"
            : restaurantClient.getBranch(request.getBranchId()).getRestaurantName();
        reservation.setConfirmationCode(createConfirmationCode(user.name(), restaurantName));
        apply(reservation, request);
        return ReservationResponse.from(reservationRepository.save(reservation));
    }

    /**
     * RF-09: cambia sede, fecha, hora o personas de una reserva propia. Vuelve
     * a PENDING porque el restaurante debe aceptar el nuevo horario.
     */
    @Transactional
    public ReservationResponse update(Long id, ReservationRequest request, AuthenticatedUser user) {
        Reservation reservation = findChangeable(id, user, "modificar");

        // Si se queda en la misma franja, sus propios puestos cuentan como libres.
        boolean sameSlot = reservation.getBranchId().equals(request.getBranchId())
                && reservation.getReservationDate().equals(request.getReservationDate())
                && reservation.getReservationTime().equals(request.getReservationTime());
        requireSeats(request, availableSeats(request) + (sameSlot ? reservation.getPartySize() : 0));

        apply(reservation, request);
        return ReservationResponse.from(reservationRepository.save(reservation));
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
        reservation.setEvent(request.getEvent());
        reservation.setStatus(ReservationStatus.PENDING);
    }

    private static String createConfirmationCode(String customerName, String restaurantName) {
        int number = java.util.concurrent.ThreadLocalRandom.current().nextInt(100000, 1000000);
        return initials(customerName) + "-" + initials(restaurantName) + "-" + number;
    }

    private static String initials(String value) {
        if (value == null || value.isBlank()) return "RY";
        String normalized = Normalizer.normalize(value.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replaceAll("[^A-Za-z0-9 ]", " ")
                .trim().toUpperCase(Locale.ROOT);
        String[] words = normalized.split("\\s+");
        if (words.length == 1) return words[0].substring(0, Math.min(3, words[0].length()));
        return "" + words[0].charAt(0) + words[words.length - 1].charAt(0);
    }

    public List<ReservationResponse> getMyReservations(AuthenticatedUser user) {
        return reservationRepository
                .findByUserIdOrderByReservationDateDescReservationTimeDesc(user.id())
                .stream().map(ReservationResponse::from).toList();
    }

    public List<ReservationResponse> getByBranch(Long branchId, LocalDate date, String status) {
        if (status != null && !status.isBlank()) {
            ReservationStatus rs = ReservationStatus.valueOf(status.toUpperCase());
            return reservationRepository
                    .findByBranchIdAndReservationDateAndStatusIn(branchId, date, List.of(rs))
                    .stream().map(ReservationResponse::from).toList();
        }
        return reservationRepository
                .findByBranchIdAndReservationDate(branchId, date)
                .stream().map(ReservationResponse::from).toList();
    }

    @Transactional
    public ReservationResponse cancel(Long id, String reason, AuthenticatedUser user) {
        Reservation reservation = findChangeable(id, user, "cancelar");
        reservation.setStatus(ReservationStatus.CANCELLED);
        reservation.setCancellationReason(reason);
        return ReservationResponse.from(reservationRepository.save(reservation));
    }

    /** Reglas comunes de RF-09: reserva propia, activa y con la anticipación mínima. */
    private Reservation findChangeable(Long id, AuthenticatedUser user, String action) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada."));

        if (!reservation.getUserId().equals(user.id())) {
            throw new InvalidOperationException("No puedes " + action + " una reserva que no es tuya.");
        }

        if (reservation.getStatus() != ReservationStatus.PENDING
                && reservation.getStatus() != ReservationStatus.CONFIRMED) {
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

    @Transactional
    public ReservationResponse updateStatus(Long id, StatusUpdateRequest request, AuthenticatedUser user) {
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada."));

        ReservationStatus newStatus = ReservationStatus.valueOf(request.getStatus().toUpperCase());
        ReservationStatus current = reservation.getStatus();

        boolean validTransition =
                (current == ReservationStatus.PENDING &&
                        (newStatus == ReservationStatus.CONFIRMED || newStatus == ReservationStatus.REJECTED))
                || (current == ReservationStatus.CONFIRMED && newStatus == ReservationStatus.COMPLETED);

        if (!validTransition) {
            throw new InvalidOperationException(
                    "Transición de estado inválida: " + current + " → " + newStatus);
        }

        reservation.setStatus(newStatus);
        if (request.getCancellationReason() != null) {
            reservation.setCancellationReason(request.getCancellationReason());
        }

        return ReservationResponse.from(reservationRepository.save(reservation));
    }
}
