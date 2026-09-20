package com.reservaya.auth.service;

import com.reservaya.auth.dto.*;
import com.reservaya.auth.entity.Role;
import com.reservaya.auth.entity.User;
import com.reservaya.auth.exception.EmailAlreadyExistsException;
import com.reservaya.auth.exception.InvalidCredentialsException;
import com.reservaya.auth.repository.UserRepository;
import com.reservaya.auth.security.AuthenticatedUser;
import com.reservaya.auth.security.JwtProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtProvider jwtProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
    }

    public AuthResponse register(RegisterRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new EmailAlreadyExistsException(email);
        }

        User user = new User();
        user.setName(request.getName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        if (request.getRole() != null) {
            user.setRole(Role.valueOf(request.getRole().toUpperCase()));
        }

        user = userRepository.save(user);
        String token = jwtProvider.generateToken(user);
        return new AuthResponse(token, UserResponse.from(user));
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        String token = jwtProvider.generateToken(user);
        return new AuthResponse(token, UserResponse.from(user));
    }

    public UserResponse me(AuthenticatedUser principal) {
        User user = userRepository.findById(principal.id())
                .orElseThrow(InvalidCredentialsException::new);
        return UserResponse.from(user);
    }
}
