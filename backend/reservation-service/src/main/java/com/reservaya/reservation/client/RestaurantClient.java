package com.reservaya.reservation.client;

import com.reservaya.reservation.dto.BranchInfoDto;
import com.reservaya.reservation.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Component
public class RestaurantClient {

    private final RestClient restClient;
    private final String restaurantUrl;

    public RestaurantClient(RestClient restClient,
                            @Value("${reservaya.services.restaurant-url}") String restaurantUrl) {
        this.restClient = restClient;
        this.restaurantUrl = restaurantUrl;
    }

    public BranchInfoDto getBranch(Long branchId) {
        BranchInfoDto branch = restClient.get()
                .uri(restaurantUrl + "/api/restaurants/branches/{branchId}", branchId)
                .retrieve()
                .onStatus(status -> status.value() == 404, (req, res) -> {
                    throw new ResourceNotFoundException("Sede no encontrada (id=" + branchId + ").");
                })
                .body(BranchInfoDto.class);
        if (branch == null) {
            throw new ResourceNotFoundException("Sede no encontrada (id=" + branchId + ").");
        }
        return branch;
    }

    public boolean isAdminOfRestaurant(Long userId, Long restaurantId) {
        Map<String, Boolean> result = restClient.get()
                .uri(restaurantUrl + "/api/restaurants/{restaurantId}/verify-admin?userId={userId}",
                        restaurantId, userId)
                .retrieve()
                .body(new ParameterizedTypeReference<>() {});
        return result != null && Boolean.TRUE.equals(result.get("isAdmin"));
    }
}
