package com.reservaya.reservation.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.springframework.security.access.AccessDeniedException;

import com.reservaya.reservation.client.RestaurantClient;
import com.reservaya.reservation.config.ReservationProperties;
import com.reservaya.reservation.dto.BranchInfoDto;
import com.reservaya.reservation.dto.ReservationRequest;
import com.reservaya.reservation.dto.ReservationResponse;
import com.reservaya.reservation.dto.ScheduleInfoDto;
import com.reservaya.reservation.dto.StatusUpdateRequest;
import com.reservaya.reservation.dto.TimeSlot;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationAudit;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.InsufficientCapacityException;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.repository.ReservationAuditRepository;
import com.reservaya.reservation.repository.ReservationRepository;
import com.reservaya.reservation.security.AuthenticatedUser;

/** Disponibilidad (RF-05/HU-04) y creación con validación de cupo (RF-06/07), sin BD. */
class ReservationFlowTest {

    private static final LocalDate NEXT_WEEK = LocalDate.now(ZoneId.of("America/Bogota")).plusDays(7);

    private final RestaurantClient restaurantClient = mock(RestaurantClient.class);
    private final ReservationRepository repository = mock(ReservationRepository.class);
        private final ReservationAuditRepository auditRepository = mock(ReservationAuditRepository.class);
        private final ReservationNotifier notifier = mock(ReservationNotifier.class);
    private final AvailabilityService availability = new AvailabilityService(restaurantClient, repository);
    private final ReservationService reservations =
            new ReservationService(repository, auditRepository, availability,
                new ReservationProperties(), restaurantClient, notifier);
    private final AuthenticatedUser client = new AuthenticatedUser(3L, "ana@test.co", "CLIENT");

    @BeforeEach
    void setUp() {
        // Sede de 10 personas, abierta todos los días 12:00-15:00 salvo el día de NEXT_WEEK + 1.
        List<ScheduleInfoDto> schedules = new ArrayList<>();
        for (short day = 1; day <= 7; day++) {
            ScheduleInfoDto s = new ScheduleInfoDto();
            s.setDayOfWeek(day);
            s.setOpenTime(LocalTime.of(12, 0));
            s.setCloseTime(LocalTime.of(15, 0));
            s.setIsClosed(day == NEXT_WEEK.plusDays(1).getDayOfWeek().getValue());
            schedules.add(s);
        }
        BranchInfoDto branch = new BranchInfoDto();
        branch.setId(7L);
        branch.setRestaurantId(42L);
        branch.setCapacity(10);
        branch.setActive(true);
        branch.setSchedules(schedules);
        when(restaurantClient.getBranch(7L)).thenReturn(branch);

        when(repository.sumPartySizeBySlot(eq(7L), eq(NEXT_WEEK), eq(LocalTime.of(13, 0)), any()))
                .thenReturn(4);
        when(repository.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private ReservationRequest request(LocalTime time, int people) {
        ReservationRequest r = new ReservationRequest();
        r.setBranchId(7L);
        r.setReservationDate(NEXT_WEEK);
        r.setReservationTime(time);
        r.setPartySize(people);
        return r;
    }

    @Test
    void availabilityListsHourlySlotsWithRemainingCapacity() {
        List<TimeSlot> slots = availability.getAvailability(7L, NEXT_WEEK).slots();
        assertEquals(List.of(
                new TimeSlot(LocalTime.of(12, 0), 10),
                new TimeSlot(LocalTime.of(13, 0), 6),
                new TimeSlot(LocalTime.of(14, 0), 10)), slots);
    }

    @Test
    void availabilityIsEmptyForClosedDayAndPastDate() {
        assertTrue(availability.getAvailability(7L, NEXT_WEEK.plusDays(1)).slots().isEmpty());
        assertTrue(availability.getAvailability(7L, LocalDate.now().minusDays(1)).slots().isEmpty());
    }

    @Test
    void createRejectsTimeOutsideSchedule() {
        assertThrows(InvalidOperationException.class,
                () -> reservations.create(request(LocalTime.of(3, 0), 2), client));
        assertThrows(InvalidOperationException.class,
                () -> reservations.create(request(LocalTime.of(12, 30), 2), client));
    }

    @Test
    void createRejectsWhenSlotLacksCapacity() {
        assertThrows(InsufficientCapacityException.class,
                () -> reservations.create(request(LocalTime.of(13, 0), 7), client));
    }

    /** Reserva existente de Ana: 4 personas a las 13:00 (son los 4 ocupados del mock). */
    private Reservation existing(ReservationStatus status) {
        Reservation r = new Reservation();
        r.setId(55L);
        r.setUserId(3L);
        r.setBranchId(7L);
        r.setReservationDate(NEXT_WEEK);
        r.setReservationTime(LocalTime.of(13, 0));
        r.setPartySize(4);
        r.setStatus(status);
        r.setCustomerEmail("ana@test.co");
        when(repository.findById(55L)).thenReturn(Optional.of(r));
        return r;
    }

    @Test
    void updateInSameSlotCountsOwnSeatsAsFree() {
        existing(ReservationStatus.CONFIRMED);
        // Cupo libre 6 + sus propios 4 = 10.
        ReservationResponse updated = reservations.update(55L, request(LocalTime.of(13, 0), 10), client);
        assertEquals(10, updated.partySize());
        assertEquals("PENDING", updated.status(), "el restaurante debe aceptar el cambio");

        existing(ReservationStatus.CONFIRMED);
        assertThrows(InsufficientCapacityException.class,
                () -> reservations.update(55L, request(LocalTime.of(13, 0), 11), client));
    }

    @Test
    void updateToAnotherSlotUsesThatSlotCapacity() {
        existing(ReservationStatus.PENDING);
        assertEquals(LocalTime.of(14, 0),
                reservations.update(55L, request(LocalTime.of(14, 0), 10), client).reservationTime());
    }

    @Test
    void updateRejectsForeignOrClosedReservations() {
        existing(ReservationStatus.CONFIRMED);
        AuthenticatedUser stranger = new AuthenticatedUser(99L, "x@test.co", "CLIENT");
        assertThrows(InvalidOperationException.class,
                () -> reservations.update(55L, request(LocalTime.of(14, 0), 2), stranger));

        existing(ReservationStatus.CANCELLED);
        assertThrows(InvalidOperationException.class,
                () -> reservations.update(55L, request(LocalTime.of(14, 0), 2), client));
    }

    @Test
    void createSavesPendingReservationWhenThereIsRoom() {
        ReservationResponse saved = reservations.create(request(LocalTime.of(13, 0), 6), client);
        assertEquals("PENDING", saved.status());
        assertEquals(3L, saved.userId());
        assertEquals("ana@test.co", saved.customerEmail());
        verify(repository).save(any(Reservation.class));
        verify(auditRepository).save(any(ReservationAudit.class));
        }

        @Test
        void administratorCanFilterOwnedBranchByDateRangeAndStatus() {
        AuthenticatedUser admin = new AuthenticatedUser(9L, "admin@test.co", "RESTAURANT_ADMIN");
        when(restaurantClient.isAdminOfRestaurant(9L, 42L)).thenReturn(true);
        LocalDate through = NEXT_WEEK.plusDays(4);

        List<ReservationResponse> found = reservations.getByBranch(
            7L, NEXT_WEEK, through, "CONFIRMED", admin);

        assertTrue(found.isEmpty());
        verify(repository).searchByBranchAndDateRange(7L, NEXT_WEEK, through, ReservationStatus.CONFIRMED);
        }

        @Test
        void clientsAndAdminsOfOtherRestaurantsCannotReadBranchReservations() {
        assertThrows(AccessDeniedException.class,
            () -> reservations.getByBranch(7L, NEXT_WEEK, NEXT_WEEK, null, client));

        AuthenticatedUser otherAdmin = new AuthenticatedUser(10L, "other@test.co", "RESTAURANT_ADMIN");
        assertThrows(AccessDeniedException.class,
            () -> reservations.getByBranch(7L, NEXT_WEEK, NEXT_WEEK, null, otherAdmin));
        }

        @Test
        void administratorStatusChangeIsAuditedAndNotifiesTheCustomer() {
        Reservation reservation = existing(ReservationStatus.PENDING);
        AuthenticatedUser admin = new AuthenticatedUser(9L, "admin@test.co", "RESTAURANT_ADMIN");
        when(restaurantClient.isAdminOfRestaurant(9L, 42L)).thenReturn(true);
        StatusUpdateRequest request = new StatusUpdateRequest();
        request.setStatus("CONFIRMED");

        ReservationResponse updated = reservations.updateStatus(55L, request, admin);

        assertEquals("CONFIRMED", updated.status());
        verify(auditRepository).save(argThat(audit ->
            audit.getReservationId().equals(55L)
                && audit.getActorUserId().equals(9L)
                && audit.getAction().equals("STATUS_CHANGED")
                && audit.getPreviousStatus() == ReservationStatus.PENDING
                && audit.getNewStatus() == ReservationStatus.CONFIRMED));
        verify(notifier).notifyCustomer(reservation, "Estado de reserva actualizado",
            "El estado de tu reserva #55 cambió de pendiente a confirmada.");
        }

        @Test
        void clientCannotModifyReservationInsideMinimumTimeWindow() {
        Reservation reservation = existing(ReservationStatus.CONFIRMED);
        var soon = java.time.LocalDateTime.now(ZoneId.of("America/Bogota")).plusMinutes(45);
        reservation.setReservationDate(soon.toLocalDate());
        reservation.setReservationTime(soon.toLocalTime());

        assertThrows(InvalidOperationException.class,
            () -> reservations.cancel(55L, "Cambio de planes", client));
    }
}
