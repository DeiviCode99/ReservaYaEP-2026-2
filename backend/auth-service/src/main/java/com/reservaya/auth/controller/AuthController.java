package com.reservaya.auth.controller;

import com.reservaya.auth.dto.*;
import com.reservaya.auth.security.AuthenticatedUser;
import com.reservaya.auth.security.GoogleTokenVerifier;
import com.reservaya.auth.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final GoogleTokenVerifier googleTokenVerifier;

    public AuthController(AuthService authService, GoogleTokenVerifier googleTokenVerifier) {
        this.authService = authService;
        this.googleTokenVerifier = googleTokenVerifier;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /** Datos públicos que necesita el frontend (vacío = Google deshabilitado). */
    @GetMapping("/config")
    public ResponseEntity<Map<String, String>> config() {
        return ResponseEntity.ok(Map.of("googleClientId", googleTokenVerifier.getClientId()));
    }

    @PostMapping("/google")
    public ResponseEntity<AuthResponse> google(@Valid @RequestBody AccountRequests.GoogleLogin request) {
        return ResponseEntity.ok(authService.google(request));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(
            @Valid @RequestBody AccountRequests.ForgotPassword request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(Map.of("message",
                "Si el correo está registrado, te enviamos un enlace para recuperar tu cuenta."));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<AuthResponse> resetPassword(@Valid @RequestBody AccountRequests.ResetPassword request) {
        return ResponseEntity.ok(authService.resetPassword(request));
    }

    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(@AuthenticationPrincipal AuthenticatedUser user) {
        return ResponseEntity.ok(authService.me(user));
    }
}
