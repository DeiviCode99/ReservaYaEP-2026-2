package com.reservaya.restaurant.controller;

import com.reservaya.restaurant.dto.RestaurantRequest;
import com.reservaya.restaurant.dto.RestaurantResponse;
import com.reservaya.restaurant.security.AuthenticatedUser;
import com.reservaya.restaurant.service.RestaurantService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/restaurants")
public class RestaurantController {

    private final RestaurantService restaurantService;

    public RestaurantController(RestaurantService restaurantService) {
        this.restaurantService = restaurantService;
    }

    @GetMapping
    public ResponseEntity<List<RestaurantResponse>> search(
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String cuisine) {
        return ResponseEntity.ok(restaurantService.search(name, city, cuisine));
    }

    @PostMapping
    public ResponseEntity<RestaurantResponse> create(
            @Valid @RequestBody RestaurantRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(restaurantService.create(request, user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<RestaurantResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody RestaurantRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(restaurantService.update(id, request, user));
    }

    @GetMapping("/{id}/verify-admin")
    public ResponseEntity<Map<String, Boolean>> verifyAdmin(
            @PathVariable Long id,
            @RequestParam Long userId) {
        return ResponseEntity.ok(Map.of("isAdmin", restaurantService.isAdmin(userId, id)));
    }
}
