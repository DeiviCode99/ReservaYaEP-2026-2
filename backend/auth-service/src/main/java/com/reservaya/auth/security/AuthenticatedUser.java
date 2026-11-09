package com.reservaya.auth.security;

public record AuthenticatedUser(Long id, String email, String role) {
}
