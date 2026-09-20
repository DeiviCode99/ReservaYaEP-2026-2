package com.reservaya.restaurant.controller;

import com.reservaya.restaurant.dto.BranchRequest;
import com.reservaya.restaurant.dto.BranchResponse;
import com.reservaya.restaurant.security.AuthenticatedUser;
import com.reservaya.restaurant.service.BranchService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants")
public class BranchController {

    private final BranchService branchService;

    public BranchController(BranchService branchService) {
        this.branchService = branchService;
    }

    @GetMapping("/{restaurantId}/branches")
    public ResponseEntity<List<BranchResponse>> getByRestaurant(@PathVariable Long restaurantId) {
        return ResponseEntity.ok(branchService.getByRestaurant(restaurantId));
    }

    @GetMapping("/branches/{branchId}")
    public ResponseEntity<BranchResponse> getById(@PathVariable Long branchId) {
        return ResponseEntity.ok(branchService.getById(branchId));
    }

    @PostMapping("/{restaurantId}/branches")
    public ResponseEntity<BranchResponse> create(
            @PathVariable Long restaurantId,
            @Valid @RequestBody BranchRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(branchService.create(restaurantId, request, user));
    }

    @PutMapping("/{restaurantId}/branches/{branchId}")
    public ResponseEntity<BranchResponse> update(
            @PathVariable Long restaurantId,
            @PathVariable Long branchId,
            @Valid @RequestBody BranchRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(branchService.update(restaurantId, branchId, request, user));
    }
}
