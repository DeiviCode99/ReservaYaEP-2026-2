package com.reservaya.restaurant.service;

import com.reservaya.restaurant.dto.BranchRequest;
import com.reservaya.restaurant.dto.BranchResponse;
import com.reservaya.restaurant.dto.ScheduleRequest;
import com.reservaya.restaurant.entity.Branch;
import com.reservaya.restaurant.entity.Restaurant;
import com.reservaya.restaurant.entity.Schedule;
import com.reservaya.restaurant.exception.BadRequestException;
import com.reservaya.restaurant.exception.DuplicateResourceException;
import com.reservaya.restaurant.repository.BranchRepository;
import com.reservaya.restaurant.repository.RestaurantRepository;
import com.reservaya.restaurant.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Editar una sede (RF-13) sin chocar con la restricción única (branch_id, day_of_week). */
class BranchUpdateTest {

    private final BranchRepository branchRepository = mock(BranchRepository.class);
    private final BranchService service = new BranchService(
            branchRepository, mock(RestaurantRepository.class), mock(RestaurantService.class));
    private final AuthenticatedUser owner = new AuthenticatedUser(5L, "dueno@test.co", "RESTAURANT_ADMIN");
    private Branch branch;
    private List<Schedule> original;

    @BeforeEach
    void setUp() {
        Restaurant restaurant = new Restaurant();
        restaurant.setId(1L);
        restaurant.setName("Doña Marta");
        restaurant.setCuisineType("Santandereana");

        branch = new Branch();
        branch.setId(7L);
        branch.setRestaurant(restaurant);
        for (short day = 1; day <= 7; day++) {
            Schedule s = new Schedule();
            s.setBranch(branch);
            s.setDayOfWeek(day);
            s.setOpenTime(LocalTime.of(12, 0));
            s.setCloseTime(LocalTime.of(22, 0));
            s.setIsClosed(false);
            branch.getSchedules().add(s);
        }
        original = new ArrayList<>(branch.getSchedules());

        when(branchRepository.findByIdAndRestaurantId(7L, 1L)).thenReturn(Optional.of(branch));
        when(branchRepository.save(any(Branch.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static ScheduleRequest day(int dayOfWeek, int open, int close, boolean closed) {
        ScheduleRequest s = new ScheduleRequest();
        s.setDayOfWeek((short) dayOfWeek);
        s.setOpenTime(LocalTime.of(open, 0));
        s.setCloseTime(LocalTime.of(close, 0));
        s.setIsClosed(closed);
        return s;
    }

    private static BranchRequest request(List<ScheduleRequest> schedules, boolean active) {
        BranchRequest r = new BranchRequest();
        r.setName("Sede Cabecera");
        r.setAddress("Cra 33 #45-10");
        r.setCity("Bucaramanga");
        r.setCapacity(40);
        r.setActive(active);
        r.setSchedules(schedules);
        return r;
    }

    @Test
    void editingSchedulesUpdatesTheSameRowsInsteadOfRecreatingThem() {
        List<ScheduleRequest> week = new ArrayList<>();
        week.add(day(1, 9, 15, false));   // lunes cambia de horario
        for (int d = 2; d <= 6; d++) week.add(day(d, 12, 22, false));
        week.add(day(7, 12, 22, true));   // domingo pasa a cerrado

        BranchResponse updated = service.update(1L, 7L, request(week, false), owner);

        assertEquals(7, branch.getSchedules().size());
        for (int i = 0; i < 7; i++) {
            assertSame(original.get(i), branch.getSchedules().get(i), "mismo registro, no uno nuevo por día");
        }
        assertEquals(LocalTime.of(9, 0), branch.getSchedules().get(0).getOpenTime());
        assertTrue(branch.getSchedules().get(6).getIsClosed());
        assertFalse(updated.active(), "la sede se puede desactivar");
        assertEquals("Doña Marta", updated.restaurantName());
    }

    @Test
    void invalidSchedulesAndDuplicateNamesAreRejectedBeforeTouchingTheDb() {
        assertThrows(BadRequestException.class, () -> service.update(1L, 7L,
                request(List.of(day(1, 22, 12, false)), true), owner));
        assertThrows(BadRequestException.class, () -> service.update(1L, 7L,
                request(List.of(day(1, 12, 22, false), day(1, 12, 22, false)), true), owner));

        when(branchRepository.existsByRestaurantIdAndNameIgnoreCaseAndIdNot(1L, "Sede Cabecera", 7L)).thenReturn(true);
        assertThrows(DuplicateResourceException.class, () -> service.update(1L, 7L,
                request(List.of(day(1, 12, 22, false)), true), owner));
        verify(branchRepository, never()).save(any());
    }

    @Test
    void closedDayWithoutHoursStoresMidnight() {
        ScheduleRequest closed = new ScheduleRequest();
        closed.setDayOfWeek((short) 1);
        closed.setIsClosed(true);

        service.update(1L, 7L, request(List.of(closed), true), owner);

        assertEquals(LocalTime.MIDNIGHT, branch.getSchedules().get(0).getOpenTime());
        assertTrue(branch.getSchedules().get(0).getIsClosed());
    }

    @Test
    void daysLeftOutAreRemovedAndNewDaysAdded() {
        branch.getSchedules().removeIf(s -> s.getDayOfWeek() == 7);

        service.update(1L, 7L, request(List.of(day(1, 12, 22, false), day(7, 10, 14, false)), true), owner);

        assertEquals(List.of((short) 1, (short) 7),
                branch.getSchedules().stream().map(Schedule::getDayOfWeek).toList());
        assertSame(original.get(0), branch.getSchedules().get(0));
    }
}
