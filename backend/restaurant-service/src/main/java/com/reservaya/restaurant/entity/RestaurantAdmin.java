package com.reservaya.restaurant.entity;

import jakarta.persistence.*;
import java.time.OffsetDateTime;
import java.time.ZoneId;

@Entity
@Table(name = "restaurant_admins")
public class RestaurantAdmin {

    private static final ZoneId ZONE = ZoneId.of("America/Bogota");

    @EmbeddedId
    private RestaurantAdminId id;

    @ManyToOne(fetch = FetchType.LAZY)
    @MapsId("restaurantId")
    @JoinColumn(name = "restaurant_id")
    private Restaurant restaurant;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = OffsetDateTime.now(ZONE);
    }

    public RestaurantAdmin() {}

    public RestaurantAdmin(Long userId, Restaurant restaurant) {
        this.id = new RestaurantAdminId(userId, restaurant.getId());
        this.restaurant = restaurant;
    }

    public RestaurantAdminId getId() { return id; }
    public void setId(RestaurantAdminId id) { this.id = id; }

    public Restaurant getRestaurant() { return restaurant; }
    public void setRestaurant(Restaurant restaurant) { this.restaurant = restaurant; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
