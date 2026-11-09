package com.reservaya.restaurant.security;

public record AuthenticatedUser(Long id, String email, String role) {
}
