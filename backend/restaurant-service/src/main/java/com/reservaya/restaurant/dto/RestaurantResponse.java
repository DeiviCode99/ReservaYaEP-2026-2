package com.reservaya.restaurant.dto;

import com.reservaya.restaurant.entity.Restaurant;
import java.time.OffsetDateTime;

public record RestaurantResponse(Long id, String name, String cuisineType,
                                  String description, String logoUrl,
                                  OffsetDateTime createdAt, OffsetDateTime updatedAt) {

    public static RestaurantResponse from(Restaurant r) {
        return new RestaurantResponse(r.getId(), r.getName(), r.getCuisineType(),
                r.getDescription(), r.getLogoUrl(), r.getCreatedAt(), r.getUpdatedAt());
    }
}
