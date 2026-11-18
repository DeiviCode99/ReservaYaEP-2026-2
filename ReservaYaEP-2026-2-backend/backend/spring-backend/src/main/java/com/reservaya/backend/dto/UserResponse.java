package com.reservaya.backend.dto;

import com.reservaya.backend.model.Role;
import com.reservaya.backend.model.User;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class UserResponse {
    private String id;
    private String name;
    private String email;
    private String phone;
    private Role role;
    private boolean active;
    private Instant createdAt;
    private Instant updatedAt;

    public static UserResponse from(User user) {
        return UserResponse.builder()
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .phone(user.getPhone())
                .role(user.getRole())
                .active(user.isActive())
                .createdAt(user.getCreatedAt())
                .updatedAt(user.getUpdatedAt())
                .build();
    }
}
