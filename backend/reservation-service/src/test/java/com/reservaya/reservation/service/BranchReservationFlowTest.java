package com.reservaya.reservation.service;

import com.reservaya.reservation.client.RestaurantClient;
import com.reservaya.reservation.client.UserClient;
import com.reservaya.reservation.client.UserClient.UserSummary;
import com.reservaya.reservation.dto.BranchInfoDto;
import com.reservaya.reservation.dto.ReservationResponse;
import com.reservaya.reservation.dto.StatusUpdateRequest;
import com.reservaya.reservation.entity.Reservation;
import com.reservaya.reservation.entity.ReservationStatus;
import com.reservaya.reservation.exception.ForbiddenException;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.repository.ReservationAuditRepository;
import com.reservaya.reservation.repository.ReservationRepository;
import com.reservaya.reservation.security.AuthenticatedUser;
import com.reservaya.reservation.security.BranchAccess;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Panel del restaurante: RF-10 (ver por fecha) y RF-11 (cambiar estado), sin BD. */
class BranchReservationFlowTest {

    private static final LocalDate DAY = LocalDate.of(2026, 10, 1);

    private final ReservationRepository repository = mock(ReservationRepository.class);
    private final ReservationAuditRepository auditRepository = mock(ReservationAuditRepository.class);
    private final RestaurantClient restaurantClient = mock(RestaurantClient.class);
    private final UserClient userClient = mock(UserClient.class);
    private final ReservationNotifier notifier = mock(ReservationNotifier.class);
    private final BranchReservationService service =
            new BranchReservationService(repository, auditRepository, new BranchAccess(restaurantClient),
                userClient, notifier);

    private final AuthenticatedUser owner = new AuthenticatedUser(5L, "dueno@test.co", "RESTAURANT_ADMIN");
    private final AuthenticatedUser otherOwner = new AuthenticatedUser(6L, "otro@test.co", "RESTAURANT_ADMIN");
    private final AuthenticatedUser client = new AuthenticatedUser(3L, "ana@test.co", "CLIENT");

    @BeforeEach
    void setUp() {
        // Sede 7 pertenece al restaurante 1, que administra el usuario 5.
        BranchInfoDto branch = new BranchInfoDto();
        branch.setId(7L);
        branch.setRestaurantId(1L);
        when(restaurantClient.getBranch(7L)).thenReturn(branch);
        when(restaurantClient.isAdminOfRestaurant(5L, 1L)).thenReturn(true);
        when(repository.save(any(Reservation.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private Reservation reservation(long id, int hour, ReservationStatus status) {
        Reservation r = new Reservation();
        r.setId(id);
        r.setUserId(3L);
        r.setBranchId(7L);
        r.setReservationDate(DAY);
        r.setReservationTime(LocalTime.of(hour, 0));
        r.setPartySize(2);
        r.setCustomerEmail("ana@test.co");
        r.setStatus(status);
        when(repository.findById(id)).thenReturn(Optional.of(r));
        return r;
    }

    private static StatusUpdateRequest to(String status, String reason) {
        StatusUpdateRequest request = new StatusUpdateRequest();
        request.setStatus(status);
        request.setCancellationReason(reason);
        return request;
    }

    @Test
    void ownerSeesDayReservationsSortedByTimeWithCustomerData() {
        List<Reservation> reservations = List.of(
                reservation(2, 20, ReservationStatus.PENDING),
                reservation(1, 13, ReservationStatus.CONFIRMED));
        when(repository.searchByBranchAndDateRange(7L, DAY, DAY, null)).thenReturn(reservations);
        when(userClient.findByIds(any())).thenReturn(Map.of(3L, new UserSummary(3L, "Ana Gómez", "ana@test.co")));

        List<ReservationResponse> day = service.getByBranch(7L, DAY, DAY, null, owner);

        assertEquals(List.of(1L, 2L), day.stream().map(ReservationResponse::id).toList(), "ordenadas por hora");
        assertEquals("Ana Gómez", day.get(0).customerName());
        assertEquals("ana@test.co", day.get(0).customerEmail());
    }

    @Test
    void ownerCanFilterAReservationRangeByStatus() {
        Reservation pending = reservation(1, 13, ReservationStatus.PENDING);
        when(repository.searchByBranchAndDateRange(7L, DAY, DAY.plusDays(2), ReservationStatus.PENDING))
            .thenReturn(List.of(pending));
        when(userClient.findByIds(any())).thenReturn(Map.of());

        List<ReservationResponse> found = service.getByBranch(7L, DAY, DAY.plusDays(2), "PENDING", owner);

        assertEquals(1, found.size());
        verify(repository).searchByBranchAndDateRange(7L, DAY, DAY.plusDays(2), ReservationStatus.PENDING);
    }

    @Test
    void listStillWorksIfCustomerDataIsUnavailable() {
        List<Reservation> one = List.of(reservation(1, 13, ReservationStatus.PENDING));
        when(repository.searchByBranchAndDateRange(7L, DAY, DAY, null)).thenReturn(one);
        when(userClient.findByIds(any())).thenReturn(Map.of());

        assertNull(service.getByBranch(7L, DAY, DAY, null, owner).get(0).customerName());
    }

    @Test
    void onlyTheBranchOwnerCanSeeOrChangeItsReservations() {
        reservation(1, 13, ReservationStatus.PENDING);

        assertThrows(ForbiddenException.class, () -> service.getByBranch(7L, DAY, DAY, null, otherOwner));
        assertThrows(ForbiddenException.class, () -> service.getByBranch(7L, DAY, DAY, null, client));
        assertThrows(ForbiddenException.class, () -> service.updateStatus(1L, to("CONFIRMED", null), client));
        assertThrows(ForbiddenException.class, () -> service.updateStatus(1L, to("CONFIRMED", null), otherOwner));
        verify(repository, never()).save(any());
    }

    @Test
    void restaurantFollowsTheStatusLifecycle() {
        reservation(1, 13, ReservationStatus.PENDING);
        assertEquals("CONFIRMED", service.updateStatus(1L, to("confirmed", null), owner).status());
        assertEquals("COMPLETED", service.updateStatus(1L, to("COMPLETED", null), owner).status());
        assertThrows(InvalidOperationException.class, () -> service.updateStatus(1L, to("PENDING", null), owner));

        reservation(2, 14, ReservationStatus.PENDING);
        ReservationResponse rejected = service.updateStatus(2L, to("REJECTED", "  Sede cerrada por evento  "), owner);
        assertEquals("REJECTED", rejected.status());
        assertEquals("Sede cerrada por evento", rejected.cancellationReason());
        verify(auditRepository, times(3)).save(any());
        verify(notifier, times(3)).notifyCustomer(any(Reservation.class), any(), any());

        reservation(3, 15, ReservationStatus.PENDING);
        assertThrows(InvalidOperationException.class, () -> service.updateStatus(3L, to("COMPLETED", null), owner),
                "no se completa sin confirmar");
        assertThrows(InvalidOperationException.class, () -> service.updateStatus(3L, to("VOLANDO", null), owner),
                "estado inexistente: 422 y no 500");
    }

    @Test
    void systemAdminCanManageAnyBranch() {
        reservation(1, 13, ReservationStatus.PENDING);
        AuthenticatedUser root = new AuthenticatedUser(1L, "root@test.co", "SYSTEM_ADMIN");
        assertEquals("CONFIRMED", service.updateStatus(1L, to("CONFIRMED", null), root).status());
    }
}
