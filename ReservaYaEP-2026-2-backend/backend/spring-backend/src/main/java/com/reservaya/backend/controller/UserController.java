package com.reservaya.backend.controller;

import com.reservaya.backend.dto.UserRequest;
import com.reservaya.backend.dto.UserResponse;
import com.reservaya.backend.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping
    @Operation(summary = "Listar usuarios")
    public ResponseEntity<List<UserResponse>> findAll() {
        return ResponseEntity.ok(userService.findAll());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Consultar un usuario")
    public ResponseEntity<UserResponse> findById(@PathVariable String id) {
        return ResponseEntity.ok(userService.findById(id));
    }

    @PostMapping
    @Operation(summary = "Crear un usuario")
    public ResponseEntity<UserResponse> create(@Valid @RequestBody com.reservaya.backend.dto.RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(UserResponse.from(userService.create(request)));
    }

    @PutMapping("/{id}")
    @Operation(summary = "Actualizar un usuario")
    public ResponseEntity<UserResponse> update(@PathVariable String id,
                                               @Valid @RequestBody UserRequest request) {
        return ResponseEntity.ok(userService.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Eliminar un usuario")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        userService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
