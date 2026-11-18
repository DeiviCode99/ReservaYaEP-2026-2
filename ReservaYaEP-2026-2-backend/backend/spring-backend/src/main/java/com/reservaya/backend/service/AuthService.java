package com.reservaya.backend.service;

import com.reservaya.backend.dto.AuthResponse;
import com.reservaya.backend.dto.LoginRequest;
import com.reservaya.backend.dto.RegisterRequest;
import com.reservaya.backend.dto.UserResponse;
import com.reservaya.backend.exception.BadCredentialsException;
import com.reservaya.backend.model.Credential;
import com.reservaya.backend.model.User;
import com.reservaya.backend.repository.CredentialRepository;
import com.reservaya.backend.repository.UserRepository;
import com.reservaya.backend.security.JwtService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final CredentialRepository credentialRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserService userService;

    public AuthService(UserRepository userRepository,
                       CredentialRepository credentialRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       UserService userService) {
        this.userRepository = userRepository;
        this.credentialRepository = credentialRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.userService = userService;
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmailIgnoreCase(request.getEmail().trim().toLowerCase())
                .orElseThrow(() -> new BadCredentialsException("Correo o contraseña incorrectos."));
        if (!user.isActive()) {
            throw new BadCredentialsException("La cuenta está desactivada.");
        }
        Credential credential = credentialRepository.findByUserId(user.getId())
                .orElseThrow(() -> new BadCredentialsException("Correo o contraseña incorrectos."));
        if (!passwordEncoder.matches(request.getPassword(), credential.getPasswordHash())) {
            throw new BadCredentialsException("Correo o contraseña incorrectos.");
        }
        return new AuthResponse(jwtService.generateToken(user), UserResponse.from(user));
    }

    public AuthResponse register(RegisterRequest request) {
        if (request.getRole() == null || request.getRole().name().equals("SYSTEM_ADMIN")) {
            throw new IllegalArgumentException("El rol solicitado no está permitido en el registro público.");
        }
        User user = userService.create(request);
        return new AuthResponse(jwtService.generateToken(user), UserResponse.from(user));
    }

    public UserResponse me(String userId) {
        return UserResponse.from(userService.findEntityById(userId));
    }
}
