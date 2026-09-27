package com.reservaya.restaurant.service;

import com.reservaya.restaurant.dto.BranchRequest;
import com.reservaya.restaurant.dto.BranchResponse;
import com.reservaya.restaurant.dto.ScheduleRequest;
import com.reservaya.restaurant.entity.Branch;
import com.reservaya.restaurant.entity.Restaurant;
import com.reservaya.restaurant.entity.Schedule;
import com.reservaya.restaurant.exception.ResourceNotFoundException;
import com.reservaya.restaurant.repository.BranchRepository;
import com.reservaya.restaurant.repository.RestaurantRepository;
import com.reservaya.restaurant.security.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class BranchService {

    private final BranchRepository branchRepository;
    private final RestaurantRepository restaurantRepository;
    private final RestaurantService restaurantService;

    public BranchService(BranchRepository branchRepository,
                         RestaurantRepository restaurantRepository,
                         RestaurantService restaurantService) {
        this.branchRepository = branchRepository;
        this.restaurantRepository = restaurantRepository;
        this.restaurantService = restaurantService;
    }

    // readOnly: horarios y marca son LAZY y con open-in-view=false solo
    // se pueden leer dentro de una transacción.
    @Transactional(readOnly = true)
    public List<BranchResponse> getByRestaurant(Long restaurantId) {
        return branchRepository.findByRestaurantId(restaurantId).stream()
                .map(BranchResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BranchResponse> search(String name, String city, String cuisine) {
        return branchRepository.search(blankToNull(name), blankToNull(city), blankToNull(cuisine)).stream()
                .map(BranchResponse::from)
                .toList();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Transactional(readOnly = true)
    public BranchResponse getById(Long branchId) {
        Branch branch = branchRepository.findById(branchId)
                .orElseThrow(() -> new ResourceNotFoundException("Sede no encontrada."));
        return BranchResponse.from(branch);
    }

    @Transactional
    public BranchResponse create(Long restaurantId, BranchRequest request, AuthenticatedUser user) {
        Restaurant restaurant = restaurantRepository.findById(restaurantId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado."));
        restaurantService.verifyAdmin(user, restaurantId);

        Branch branch = new Branch();
        branch.setRestaurant(restaurant);
        applyFields(branch, request);

        if (request.getSchedules() != null) {
            for (ScheduleRequest sr : request.getSchedules()) {
                Schedule schedule = toScheduleEntity(sr, branch);
                branch.getSchedules().add(schedule);
            }
        }

        return BranchResponse.from(branchRepository.save(branch));
    }

    @Transactional
    public BranchResponse update(Long restaurantId, Long branchId, BranchRequest request, AuthenticatedUser user) {
        restaurantService.verifyAdmin(user, restaurantId);

        Branch branch = branchRepository.findByIdAndRestaurantId(branchId, restaurantId)
                .orElseThrow(() -> new ResourceNotFoundException("Sede no encontrada."));

        applyFields(branch, request);

        if (request.getSchedules() != null) {
            replaceSchedules(branch, request.getSchedules());
        }

        return BranchResponse.from(branchRepository.save(branch));
    }

    /**
     * Actualiza en su sitio el horario de cada día que ya existe. Borrar todos y
     * volver a crearlos falla: Hibernate inserta antes de borrar y choca con
     * la restricción única (branch_id, day_of_week).
     */
    private void replaceSchedules(Branch branch, List<ScheduleRequest> requested) {
        Map<Short, Schedule> current = branch.getSchedules().stream()
                .collect(Collectors.toMap(Schedule::getDayOfWeek, Function.identity()));
        Set<Short> requestedDays = new HashSet<>();

        for (ScheduleRequest sr : requested) {
            requestedDays.add(sr.getDayOfWeek());
            Schedule existing = current.get(sr.getDayOfWeek());
            if (existing == null) {
                branch.getSchedules().add(toScheduleEntity(sr, branch));
            } else {
                applyScheduleFields(existing, sr);
            }
        }
        branch.getSchedules().removeIf(s -> !requestedDays.contains(s.getDayOfWeek()));
    }

    private void applyFields(Branch branch, BranchRequest request) {
        branch.setName(request.getName().trim());
        branch.setAddress(request.getAddress().trim());
        branch.setCity(request.getCity().trim());
        branch.setPhone(request.getPhone());
        branch.setLatitude(request.getLatitude());
        branch.setLongitude(request.getLongitude());
        branch.setCapacity(request.getCapacity());
        if (request.getActive() != null) {
            branch.setActive(request.getActive());
        }
    }

    private Schedule toScheduleEntity(ScheduleRequest sr, Branch branch) {
        Schedule s = new Schedule();
        s.setBranch(branch);
        s.setDayOfWeek(sr.getDayOfWeek());
        applyScheduleFields(s, sr);
        return s;
    }

    private static void applyScheduleFields(Schedule s, ScheduleRequest sr) {
        s.setOpenTime(sr.getOpenTime());
        s.setCloseTime(sr.getCloseTime());
        s.setIsClosed(sr.getIsClosed() != null && sr.getIsClosed());
    }
}
