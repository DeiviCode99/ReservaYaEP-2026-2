package com.reservaya.auth.service;

import com.reservaya.auth.config.JwtProperties;
import com.reservaya.auth.dto.AccountRequests;
import com.reservaya.auth.dto.AuthResponse;
import com.reservaya.auth.dto.RegisterRequest;
import com.reservaya.auth.entity.Role;
import com.reservaya.auth.entity.User;
import com.reservaya.auth.exception.BadRequestException;
import com.reservaya.auth.repository.UserRepository;
import com.reservaya.auth.security.GoogleTokenVerifier;
import com.reservaya.auth.security.JwtProvider;
import com.reservaya.auth.security.PasswordResetTokens;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/** Google, recuperación de cuenta y roles permitidos, sin BD ni red. */
class AccountFlowTest {

    private final UserRepository repository = mock(UserRepository.class);
    private final GoogleTokenVerifier google = mock(GoogleTokenVerifier.class);
    private final ResetMailer mailer = mock(ResetMailer.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(4);
    private PasswordResetTokens tokens;
    private AuthService auth;
    private User ana;

    @BeforeEach
    void setUp() {
        JwtProperties jwt = new JwtProperties();
        jwt.setSecret("una-clave-de-pruebas-de-al-menos-32-bytes!!");
        tokens = new PasswordResetTokens(jwt, 30);
        auth = new AuthService(repository, encoder, new JwtProvider(jwt), google, tokens, mailer);

        ana = new User();
        ana.setId(3L);
        ana.setName("Ana");
        ana.setEmail("ana@test.co");
        ana.setPasswordHash(encoder.encode("vieja-clave"));
        when(repository.findById(3L)).thenReturn(Optional.of(ana));
        when(repository.findByEmail("ana@test.co")).thenReturn(Optional.of(ana));
        when(repository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            if (u.getId() == null) u.setId(10L);
            return u;
        });
    }

    @Test
    void resetLinkChangesPasswordAndWorksOnlyOnce() {
        String token = tokens.create(ana);
        AuthResponse session = auth.resetPassword(new AccountRequests.ResetPassword(token, "nueva-clave-123"));

        assertNotNull(session.token(), "queda con la sesión iniciada");
        assertTrue(encoder.matches("nueva-clave-123", ana.getPasswordHash()));
        assertThrows(BadRequestException.class,
                () -> auth.resetPassword(new AccountRequests.ResetPassword(token, "otra-clave-456")),
                "el mismo enlace no sirve dos veces");
    }

    @Test
    void resetRejectsTamperedExpiredAndForeignTokens() {
        String token = tokens.create(ana);
        String[] parts = token.split("\\.");

        assertFalse(tokens.matches(parts[0] + "." + (Long.parseLong(parts[1]) + 3600) + "." + parts[2], ana),
                "no se puede alargar la expiración");
        assertFalse(tokens.matches("3.1000." + parts[2], ana), "vencido");
        assertFalse(tokens.matches("basura", ana));
        assertThrows(BadRequestException.class,
                () -> auth.resetPassword(new AccountRequests.ResetPassword("99." + parts[1] + "." + parts[2], "x".repeat(8))));
    }

    @Test
    void forgotPasswordMailsOnlyExistingAccounts() {
        auth.forgotPassword(new AccountRequests.ForgotPassword("ANA@test.co "));
        verify(mailer).send(eq(ana), anyString());

        auth.forgotPassword(new AccountRequests.ForgotPassword("nadie@test.co"));
        verifyNoMoreInteractions(mailer);
    }

    @Test
    void googleLinksExistingAccountOrCreatesOneWithChosenRole() {
        when(google.verify("tok-ana")).thenReturn(new GoogleTokenVerifier.GoogleUser("ana@test.co", "Ana G"));
        assertEquals(3L, auth.google(new AccountRequests.GoogleLogin("tok-ana", "RESTAURANT_ADMIN")).user().id(),
                "cuenta existente: se reutiliza y no cambia su rol");

        when(repository.findByEmail("leo@test.co")).thenReturn(Optional.empty());
        when(google.verify("tok-leo")).thenReturn(new GoogleTokenVerifier.GoogleUser("leo@test.co", "Leo"));
        AuthResponse leo = auth.google(new AccountRequests.GoogleLogin("tok-leo", "RESTAURANT_ADMIN"));
        assertEquals("RESTAURANT_ADMIN", leo.user().role());
        assertEquals("leo@test.co", leo.user().email());
    }

    @Test
    void nobodyCanSelfAssignSystemAdmin() {
        assertEquals(Role.CLIENT, AuthService.selfServiceRole(null));
        assertThrows(BadRequestException.class, () -> AuthService.selfServiceRole("SYSTEM_ADMIN"));
        assertThrows(BadRequestException.class, () -> AuthService.selfServiceRole("hacker"));

        RegisterRequest request = new RegisterRequest();
        request.setName("Mala");
        request.setEmail("mala@test.co");
        request.setPassword("12345678");
        request.setRole("system_admin");
        assertThrows(BadRequestException.class, () -> auth.register(request));
    }
}
