package com.reservaya.auth.service;

import com.reservaya.auth.dto.*;
import com.reservaya.auth.entity.Role;
import com.reservaya.auth.entity.User;
import com.reservaya.auth.exception.BadRequestException;
import com.reservaya.auth.exception.EmailAlreadyExistsException;
import com.reservaya.auth.exception.InvalidCredentialsException;
import com.reservaya.auth.repository.UserRepository;
import com.reservaya.auth.security.AuthenticatedUser;
import com.reservaya.auth.security.GoogleTokenVerifier;
import com.reservaya.auth.security.GoogleTokenVerifier.GoogleUser;
import com.reservaya.auth.security.JwtProvider;
import com.reservaya.auth.security.PasswordResetTokens;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtProvider jwtProvider;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final PasswordResetTokens resetTokens;
    private final ResetMailer resetMailer;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtProvider jwtProvider,
                       GoogleTokenVerifier googleTokenVerifier, PasswordResetTokens resetTokens,
                       ResetMailer resetMailer) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtProvider = jwtProvider;
        this.googleTokenVerifier = googleTokenVerifier;
        this.resetTokens = resetTokens;
        this.resetMailer = resetMailer;
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
        user.setRole(selfServiceRole(request.getRole()));

        return session(userRepository.save(user));
    }

    public AuthResponse login(LoginRequest request) {
        String email = request.getEmail().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        return session(user);
    }

    /**
     * Entrar o registrarse con Google. Google ya verificó el correo, así que si
     * existe una cuenta con él se usa esa; si no, se crea con el rol elegido.
     */
    public AuthResponse google(AccountRequests.GoogleLogin request) {
        GoogleUser google = googleTokenVerifier.verify(request.credential());
        User user = userRepository.findByEmail(google.email()).orElseGet(() -> {
            User created = new User();
            created.setName(google.name());
            created.setEmail(google.email());
            // Sin contraseña propia: una aleatoria que nadie conoce. Si luego
            // quiere entrar con correo y contraseña, usa "¿Olvidaste tu contraseña?".
            created.setPasswordHash(passwordEncoder.encode(UUID.randomUUID() + UUID.randomUUID().toString()));
            created.setRole(selfServiceRole(request.role()));
            return userRepository.save(created);
        });
        return session(user);
    }

    /** Siempre responde igual, exista o no el correo, para no revelar cuentas. */
    public void forgotPassword(AccountRequests.ForgotPassword request) {
        userRepository.findByEmail(request.email().trim().toLowerCase())
                .ifPresent(user -> resetMailer.send(user, resetTokens.create(user)));
    }

    public AuthResponse resetPassword(AccountRequests.ResetPassword request) {
        User user = resetTokens.userId(request.token())
                .flatMap(userRepository::findById)
                .filter(candidate -> resetTokens.matches(request.token(), candidate))
                .orElseThrow(() -> new BadRequestException(
                        "El enlace no es válido o ya venció. Solicita uno nuevo."));

        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return session(userRepository.save(user));
    }

    public UserResponse me(AuthenticatedUser principal) {
        User user = userRepository.findById(principal.id())
                .orElseThrow(InvalidCredentialsException::new);
        return UserResponse.from(user);
    }

    private AuthResponse session(User user) {
        return new AuthResponse(jwtProvider.generateToken(user), UserResponse.from(user));
    }

    /** Solo se puede elegir cliente o administrador de restaurante; SYSTEM_ADMIN nunca. */
    static Role selfServiceRole(String role) {
        if (role == null || role.isBlank()) return Role.CLIENT;
        return switch (role.trim().toUpperCase()) {
            case "CLIENT" -> Role.CLIENT;
            case "RESTAURANT_ADMIN" -> Role.RESTAURANT_ADMIN;
            default -> throw new BadRequestException("Tipo de cuenta no válido.");
        };
    }
}
