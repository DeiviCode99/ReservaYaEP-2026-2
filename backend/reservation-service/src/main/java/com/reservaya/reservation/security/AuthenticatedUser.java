package com.reservaya.reservation.security;

public record AuthenticatedUser(Long id, String email, String role) {
}
