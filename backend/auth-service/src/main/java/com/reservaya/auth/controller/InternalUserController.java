package com.reservaya.auth.controller;

import com.reservaya.auth.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Consultas entre servicios. El gateway solo enruta /api/**, así que esta ruta
 * no es accesible desde internet; además exige un token de administrador
 * (ver SecurityConfig). La usa reservation-service para mostrarle al
 * restaurante quién hizo cada reserva.
 */
@RestController
@RequestMapping("/internal/users")
public class InternalUserController {

    private final UserRepository userRepository;

    public InternalUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<UserSummary>> findByIds(@RequestParam List<Long> ids) {
        return ResponseEntity.ok(userRepository.findAllById(ids).stream()
                .map(user -> new UserSummary(user.getId(), user.getName(), user.getEmail()))
                .toList());
    }

    public record UserSummary(Long id, String name, String email) {
    }
}
