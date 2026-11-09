package com.reservaya.auth.dto;

public record AuthResponse(String token, UserResponse user) {
}
