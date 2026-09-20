package com.reservaya.reservation.service;

import com.reservaya.reservation.client.RestaurantClient;
import com.reservaya.reservation.config.ReservationProperties;
import com.reservaya.reservation.dto.*;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.InsufficientCapacityException;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import com.reservaya.reservation.repository.ReservationRepository;
import com.reservaya.reservation.security.AuthenticatedUser;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@EnableConfigurationProperties(ReservationProperties.class)
public class ReservationService {

    private static final ZoneId ZONE = ZoneId.of("America/Bogota");
    private static final List<ReservationStatus> ACTIVE_STATUSES =
            List.of(ReservationStatus.PENDING, ReservationStatus.CONFIRMED);

    private final ReservationRepository reservationRepository;
    private final RestaurantClient restaurantClient;
    private final ReservationProperties reservationProperties;

    public ReservationService(ReservationRepository reservationRepository,
                              RestaurantClient restaurantClient,
                              ReservationProperties reservationProperties) {
        this.reservationRepository = reservationRepository;
        this.restaurantClient = restaurantClient;
        this.reservationProperties = reservationProperties;
    }

    @Transactional
    public ReservationResponse create(ReservationRequest request, AuthenticatedUser user) {
        BranchInfoDto branch = restaurantClient.getBranch(request.getBranchId());
        if (!branch.getActive()) {
            throw new InvalidOperationException("La sede no está activa.");
        }

        int occupied = reservationRepository.sumPartySizeBySlot(
                request.getBranchId(), request.getReservationDate(),
                request.getReservationTime(), ACTIVE_STATUSES);
        int available = branch.getCapacity() - occupied;

        if (available < request.getPartySize()) {
            throw new InsufficientCapacityException(
                    "No hay cupo suficiente. Disponible: " + available + " personas.");
        }

        Reservation reservation = new Reservation();
        reservation.setUserId(user.id());
        reservation.setBranchId(request.getBranchId());
        reservation.setReservationDate(request.getReservationDate());
        reservation.setReservationTime(request.getReservationTime());
        reservation.setPartySize(request.getPartySize());
        reservation.setStatus(ReservationStatus.PENDING);

        return ReservationResponse.from(reservationRepository.save(reservation));
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
        Reservation reservation = reservationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada."));

        if (!reservation.getUserId().equals(user.id())) {
            throw new InvalidOperationException("No puedes cancelar una reserva que no es tuya.");
        }

        if (reservation.getStatus() != ReservationStatus.PENDING
                && reservation.getStatus() != ReservationStatus.CONFIRMED) {
            throw new InvalidOperationException("Solo se pueden cancelar reservas pendientes o confirmadas.");
        }

        LocalDateTime reservationDateTime = LocalDateTime.of(
                reservation.getReservationDate(), reservation.getReservationTime());
        LocalDateTime now = LocalDateTime.now(ZONE);
        long hoursUntil = ChronoUnit.HOURS.between(now, reservationDateTime);

        if (hoursUntil < reservationProperties.getMinHoursBeforeCancel()) {
            throw new InvalidOperationException(
                    "No se puede cancelar con menos de " + reservationProperties.getMinHoursBeforeCancel()
                            + " horas de anticipación.");
        }

        reservation.setStatus(ReservationStatus.CANCELLED);
        reservation.setCancellationReason(reason);
        return ReservationResponse.from(reservationRepository.save(reservation));
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
