package com.reservaya.reservation.security;

import com.reservaya.reservation.client.RestaurantClient;
import com.reservaya.reservation.exception.ForbiddenException;
import org.springframework.stereotype.Component;

/**
 * Única regla de autorización del lado del restaurante: solo quien administra
 * el restaurante dueño de la sede (o un SYSTEM_ADMIN) ve y gestiona sus reservas.
 */
@Component
public class BranchAccess {

    private final RestaurantClient restaurantClient;

    public BranchAccess(RestaurantClient restaurantClient) {
        this.restaurantClient = restaurantClient;
    }

    public void requireAdmin(Long branchId, AuthenticatedUser user) {
        if ("SYSTEM_ADMIN".equals(user.role())) return;
        if (!"RESTAURANT_ADMIN".equals(user.role())) {
            throw new ForbiddenException("Solo el restaurante puede gestionar las reservas de sus sedes.");
        }
        Long restaurantId = restaurantClient.getBranch(branchId).getRestaurantId();
        if (!restaurantClient.isAdminOfRestaurant(user.id(), restaurantId)) {
            throw new ForbiddenException("No administras esta sede.");
        }
    }
}
