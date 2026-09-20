package com.reservaya.reservation.controller;

import com.reservaya.reservation.dto.*;
import com.reservaya.reservation.security.AuthenticatedUser;
import com.reservaya.reservation.service.AvailabilityService;
import com.reservaya.reservation.service.ReservationService;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/reservations")
public class ReservationController {

    private final ReservationService reservationService;
    private final AvailabilityService availabilityService;

    public ReservationController(ReservationService reservationService,
                                  AvailabilityService availabilityService) {
        this.reservationService = reservationService;
        this.availabilityService = availabilityService;
    }

    @GetMapping("/availability")
    public ResponseEntity<AvailabilityResponse> availability(
            @RequestParam Long branchId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return ResponseEntity.ok(availabilityService.getAvailability(branchId, date));
    }

    @PostMapping
    public ResponseEntity<ReservationResponse> create(
            @Valid @RequestBody ReservationRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.status(HttpStatus.CREATED).body(reservationService.create(request, user));
    }

    @GetMapping
    public ResponseEntity<List<ReservationResponse>> list(
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal AuthenticatedUser user) {
        if (branchId != null && date != null) {
            return ResponseEntity.ok(reservationService.getByBranch(branchId, date, status));
        }
        return ResponseEntity.ok(reservationService.getMyReservations(user));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ReservationResponse> cancel(
            @PathVariable Long id,
            @RequestBody(required = false) StatusUpdateRequest body,
            @AuthenticationPrincipal AuthenticatedUser user) {
        String reason = body != null ? body.getCancellationReason() : null;
        return ResponseEntity.ok(reservationService.cancel(id, reason, user));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ReservationResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody StatusUpdateRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(reservationService.updateStatus(id, request, user));
    }
}
