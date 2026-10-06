package com.reservaya.reservation.controller;

import com.reservaya.reservation.dto.*;
import com.reservaya.reservation.exception.InvalidOperationException;
import com.reservaya.reservation.security.AuthenticatedUser;
import com.reservaya.reservation.service.AvailabilityService;
import com.reservaya.reservation.service.BranchReservationService;
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
    private final BranchReservationService branchReservationService;

    public ReservationController(ReservationService reservationService,
                                  AvailabilityService availabilityService,
                                  BranchReservationService branchReservationService) {
        this.reservationService = reservationService;
        this.availabilityService = availabilityService;
        this.branchReservationService = branchReservationService;
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
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal AuthenticatedUser user) {
        if (branchId != null) {
            if (date == null && from == null && to == null) {
                throw new InvalidOperationException("El filtro por fecha requiere una fecha o un rango.");
            }
            LocalDate start = date != null ? date : from;
            LocalDate end = date != null ? date : to;
            return ResponseEntity.ok(branchReservationService.getByBranch(branchId, start, end, status, user));
        }
        if (date != null || from != null || to != null || status != null) {
            throw new InvalidOperationException("El filtro por fecha requiere una sede.");
        }
        return ResponseEntity.ok(reservationService.getMyReservations(user));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ReservationResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ReservationRequest request,
            @AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(reservationService.update(id, request, user));
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
        return ResponseEntity.ok(branchReservationService.updateStatus(id, request, user));
    }
}
