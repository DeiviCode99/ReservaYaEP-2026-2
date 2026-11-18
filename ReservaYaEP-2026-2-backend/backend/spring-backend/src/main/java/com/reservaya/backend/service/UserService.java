package com.reservaya.backend.service;

import com.reservaya.backend.dto.RegisterRequest;
import com.reservaya.backend.dto.UserRequest;
import com.reservaya.backend.dto.UserResponse;
import com.reservaya.backend.exception.DuplicateResourceException;
import com.reservaya.backend.exception.ResourceNotFoundException;
import com.reservaya.backend.model.Credential;
import com.reservaya.backend.model.User;
import com.reservaya.backend.repository.CredentialRepository;
import com.reservaya.backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class UserService {
    private final UserRepository userRepository;
    private final CredentialRepository credentialRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository,
                       CredentialRepository credentialRepository,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.credentialRepository = credentialRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public List<UserResponse> findAll() {
        return userRepository.findAll().stream().map(UserResponse::from).toList();
    }

    public User findEntityById(String id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado."));
    }

    public UserResponse findById(String id) {
        return UserResponse.from(findEntityById(id));
    }

    public User create(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new DuplicateResourceException("Ya existe una cuenta con ese correo.");
        }
        if (request.getRole() == null) {
            throw new IllegalArgumentException("El rol es obligatorio.");
        }
        User user = User.builder()
                .name(request.getName().trim())
                .email(email)
                .phone(request.getPhone())
                .role(request.getRole())
                .active(true)
                .build();
        user = userRepository.save(user);
        credentialRepository.save(Credential.builder()
                .userId(user.getId())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .build());
        return user;
    }

    public UserResponse update(String id, UserRequest request) {
        User user = findEntityById(id);
        String email = request.getEmail().trim().toLowerCase();
        userRepository.findByEmailIgnoreCase(email).ifPresent(existing -> {
            if (!existing.getId().equals(id)) {
                throw new DuplicateResourceException("Ya existe una cuenta con ese correo.");
            }
        });

        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setPhone(request.getPhone());
        user.setRole(request.getRole());
        if (request.getActive() != null) {
            user.setActive(request.getActive());
        }
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            Credential credential = credentialRepository.findByUserId(id)
                    .orElseGet(() -> Credential.builder().userId(id).build());
            credential.setPasswordHash(passwordEncoder.encode(request.getPassword()));
            credentialRepository.save(credential);
        }
        return UserResponse.from(user);
    }

    public void delete(String id) {
        findEntityById(id);
        credentialRepository.findByUserId(id).ifPresent(credentialRepository::delete);
        userRepository.deleteById(id);
    }
}
