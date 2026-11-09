package com.reservaya.auth.dto;

import com.reservaya.auth.entity.User;
import java.time.OffsetDateTime;

public record UserResponse(Long id, String name, String email, String role, OffsetDateTime createdAt) {

    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole().name(),
                user.getCreatedAt()
        );
    }
}
