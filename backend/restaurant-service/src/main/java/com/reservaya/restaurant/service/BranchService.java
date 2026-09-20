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

import java.util.List;

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

    public List<BranchResponse> getByRestaurant(Long restaurantId) {
        return branchRepository.findByRestaurantId(restaurantId).stream()
                .map(BranchResponse::from)
                .toList();
    }

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
            branch.getSchedules().clear();
            for (ScheduleRequest sr : request.getSchedules()) {
                Schedule schedule = toScheduleEntity(sr, branch);
                branch.getSchedules().add(schedule);
            }
        }

        return BranchResponse.from(branchRepository.save(branch));
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
        s.setOpenTime(sr.getOpenTime());
        s.setCloseTime(sr.getCloseTime());
        s.setIsClosed(sr.getIsClosed() != null && sr.getIsClosed());
        return s;
    }
}
